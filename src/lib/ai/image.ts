import { env } from "@/lib/env";
import { withRetry } from "@/lib/ai/retry";
import { migrateWanToTencentOg } from "@/lib/orchestrator/project-image-model";
import { logger } from "@/lib/logger";

export interface ImageGenInput {
  prompt: string;
  negativePrompt?: string;
  refImageUrls?: string[];
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  size?: "1K" | "2K" | "4K";
  seed?: number;
  n?: number;
}

export interface ImageGenResult {
  urls: string[];
  url: string;
  cost: number;
  model: string;
  taskId?: string;
}

export type ImageModelKey =
  | "tencent-og-low"
  | "tencent-og-medium"
  | "tencent-og-high"
  | "wan2.7-image-pro"   // fallback only
  | "wan2.7-image";      // fallback only

const COST_TABLE: Record<ImageModelKey, number> = {
  "tencent-og-low": 0.015,
  "tencent-og-medium": 0.03,
  "tencent-og-high": 0.06,
  "wan2.7-image-pro": 0.02,
  "wan2.7-image": 0.01,
};

// ─── 阿里云百炼 万相2.7（OG 不可用时的备用）────────────────────

async function generateWithWanxiang(
  input: ImageGenInput,
  model: "wan2.7-image-pro" | "wan2.7-image",
): Promise<ImageGenResult> {
  const apiKey = env.ALIBABA_DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("ALIBABA_DASHSCOPE_API_KEY is not configured");

  const contentItems: Record<string, string>[] = [];
  if (input.refImageUrls?.length) {
    for (const url of input.refImageUrls) {
      contentItems.push({ image: url });
    }
  }
  const promptText = input.negativePrompt
    ? `${input.prompt}。负面提示：${input.negativePrompt}`
    : input.prompt;
  contentItems.push({ text: promptText });

  const body = {
    model,
    input: { messages: [{ role: "user", content: contentItems }] },
    parameters: {
      size: input.size ?? "2K",
      n: input.n ?? 1,
      watermark: false,
      ...(input.seed !== undefined && { seed: input.seed }),
    },
  };

  const res = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DashScope API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    output?: { choices?: Array<{ message: { content: Array<{ type: string; image?: string }> } }> };
    code?: string;
    message?: string;
  };

  if (data.code) throw new Error(`DashScope error [${data.code}]: ${data.message}`);

  const urls: string[] = [];
  for (const choice of data.output?.choices ?? []) {
    for (const item of choice.message.content) {
      if (item.type === "image" && item.image) urls.push(item.image);
    }
  }

  if (urls.length === 0) throw new Error("DashScope returned no images");

  return { urls, url: urls[0]!, cost: COST_TABLE[model as ImageModelKey] * urls.length, model };
}

// ─── 腾讯云 VOD TC3 签名 ─────────────────────────────────────

async function tencentVODSignedPost(
  action: string,
  payload: Record<string, unknown>,
): Promise<{ Response: Record<string, unknown> & { Error?: { Code: string; Message: string } } }> {
  const secretId = env.TENCENT_SECRET_ID;
  const secretKey = env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) throw new Error("Tencent Cloud credentials not configured");

  const host = "vod.tencentcloudapi.com";
  const service = "vod";
  const version = "2018-07-17";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().split("T")[0];
  const algorithm = "TC3-HMAC-SHA256";
  const bodyStr = JSON.stringify(payload);

  const crypto = await import("crypto");
  const hmac = (key: string | Buffer, data: string) =>
    crypto.createHmac("sha256", key).update(data).digest();

  const hashedPayload = crypto.createHash("sha256").update(bodyStr).digest("hex");
  const canonicalRequest = [
    "POST", "/", "",
    `content-type:application/json; charset=utf-8\nhost:${host}\n`,
    "content-type;host",
    hashedPayload,
  ].join("\n");

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm, String(timestamp), credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const secretDate = hmac(`TC3${secretKey!}`, date!);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = crypto.createHmac("sha256", secretSigning).update(stringToSign).digest("hex");

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

  const res = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": version,
      Authorization: authorization,
    },
    body: bodyStr,
  });

  if (!res.ok) throw new Error(`Tencent VOD API HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}

function extractAigcImageOutputUrls(output: unknown): string[] {
  if (!output || typeof output !== "object") return [];
  const o = output as Record<string, unknown>;
  if (Array.isArray(o.ImageUrls)) {
    return (o.ImageUrls as unknown[]).filter((u): u is string => typeof u === "string" && !!u);
  }
  if (typeof o.FileUrl === "string" && o.FileUrl.trim()) return [o.FileUrl.trim()];
  const files = o.FileInfos;
  if (!Array.isArray(files)) return [];
  const out: string[] = [];
  for (const item of files) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const u = f.FileUrl ?? f.Url ?? f.URL;
    if (typeof u === "string" && u.trim()) out.push(u.trim());
  }
  return out;
}

export async function pollTencentVODTask(
  taskId: string,
): Promise<{ urls: string[]; status: string; failDetail?: string }> {
  const subAppId = env.TENCENT_VOD_SUB_APP_ID;
  if (!subAppId) throw new Error("Tencent VOD credentials not fully configured");

  const data = await tencentVODSignedPost("DescribeTaskDetail", {
    SubAppId: Number(subAppId),
    TaskId: taskId,
  });

  if (data.Response.Error) {
    throw new Error(`Tencent VOD poll error [${data.Response.Error.Code}]: ${data.Response.Error.Message}`);
  }

  const resp = data.Response as Record<string, unknown>;
  const requestId = typeof resp.RequestId === "string" ? resp.RequestId : undefined;
  const task = (resp.AigcImageTask ?? resp.SceneAigcImageTask) as any;

  if (task?.ErrCode !== undefined && task.ErrCode !== 0) {
    throw new Error(`Tencent AIGC image task failed [${task.ErrCodeExt || task.ErrCode}]: ${task.Message || "unknown"}`);
  }

  const urls = extractAigcImageOutputUrls(task?.Output);
  const taskSt = String(task?.Status ?? "").toLowerCase();
  const topSt = String(resp.Status ?? "").toLowerCase();
  const status = taskSt || topSt || "processing";

  if (status === "failed" || status === "fail" || status === "aborted") {
    const failDetail = [
      task?.ErrCode != null && task.ErrCode !== 0 ? `ErrCode=${task.ErrCode}` : null,
      task?.ErrCodeExt ? `Ext=${task.ErrCodeExt}` : null,
      task?.Message ? `Msg=${task.Message}` : null,
      requestId ? `RequestId=${requestId}` : null,
    ].filter(Boolean).join(" | ");
    logger.warn({ taskId, status, failDetail: failDetail || undefined }, "[image] Tencent AIGC task not success");
    return { urls: [], status: "failed", failDetail: failDetail || `Status=${status}` };
  }

  if (urls.length > 0) return { urls, status: "success" };
  return { urls: [], status: "processing" };
}

async function generateWithTencentOG(
  input: ImageGenInput,
  modelKey: "tencent-og-low" | "tencent-og-medium" | "tencent-og-high",
): Promise<ImageGenResult> {
  const subAppId = env.TENCENT_VOD_SUB_APP_ID;
  if (!env.TENCENT_SECRET_ID || !env.TENCENT_SECRET_KEY || !subAppId) {
    throw new Error("Tencent Cloud VOD credentials not configured");
  }

  const modelVersion = modelKey.replace("tencent-og-", "image2_");
  const sizeTier = input.size ?? "2K";
  const ogResolutionMap: Record<string, "1080P" | "2K" | "4K"> = { "1K": "1080P", "2K": "2K", "4K": "4K" };
  const relax = env.TENCENT_AIGC_RELAX_COMPLIANCE === "1" || env.TENCENT_AIGC_RELAX_COMPLIANCE === "true";

  const outputConfig: Record<string, unknown> = {
    StorageMode: "Temporary",
    AspectRatio: input.aspectRatio || "16:9",
    PersonGeneration: "AllowAdult",
    InputComplianceCheck: relax ? "Disabled" : "Enabled",
    OutputComplianceCheck: relax ? "Disabled" : "Enabled",
    Resolution: ogResolutionMap[sizeTier] ?? "2K",
  };

  const body: Record<string, unknown> = {
    SubAppId: Number(subAppId),
    ModelName: "OG",
    ModelVersion: modelVersion,
    Prompt: input.prompt,
    EnhancePrompt: relax ? "Disabled" : "Enabled",
    OutputConfig: outputConfig,
  };

  if (input.negativePrompt) body.NegativePrompt = input.negativePrompt;
  if (input.refImageUrls?.length) {
    body.FileInfos = input.refImageUrls.slice(0, 3).map((url) => ({ Type: "Url", Url: url }));
  }

  const taskResp = await tencentVODSignedPost("CreateAigcImageTask", body);
  if (taskResp.Response.Error) {
    throw new Error(`Tencent API Error [${taskResp.Response.Error.Code}]: ${taskResp.Response.Error.Message}`);
  }
  const taskId = taskResp.Response.TaskId as string;
  if (!taskId) throw new Error("Tencent CreateAigcImageTask returned no TaskId");

  return { urls: [], url: "", cost: COST_TABLE[modelKey], model: modelKey, taskId };
}

// ─── 统一入口 ─────────────────────────────────────────────────

export async function generateImage(
  input: ImageGenInput,
  modelKey: ImageModelKey = env.DEFAULT_IMAGE_MODEL as ImageModelKey,
): Promise<ImageGenResult> {
  // wan2.7 keys are fallback only — always try tencent-og-medium first via migration
  const key = migrateWanToTencentOg(modelKey);

  const result = await withRetry(
    async () => {
      switch (key) {
        case "tencent-og-low":
        case "tencent-og-medium":
        case "tencent-og-high":
          return generateWithTencentOG(input, key);
        case "wan2.7-image-pro":
        case "wan2.7-image":
          return generateWithWanxiang(input, key);
        default:
          throw new Error(`Unknown image model: ${key}`);
      }
    },
    { context: `image:${key}`, retries: 2, minTimeout: 1500 },
  );

  // Tencent OG is async — poll until done; on failure fall back to wan2.7-image-pro
  if (result.taskId && !result.url) {
    const maxAttempts = env.TENCENT_AIGC_IMAGE_POLL_MAX_ATTEMPTS;
    const pollIntervalMs = env.TENCENT_AIGC_IMAGE_POLL_INTERVAL_MS;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, pollIntervalMs));
      const { urls, status, failDetail } = await pollTencentVODTask(result.taskId);

      if (status === "success" && urls.length > 0 && urls[0]) {
        result.urls = urls;
        result.url = urls[0]!;
        break;
      }
      if (status === "failed") {
        // Fallback to wan2.7-image-pro if OG fails
        if (key.startsWith("tencent-og") && env.ALIBABA_DASHSCOPE_API_KEY) {
          logger.warn({ taskId: result.taskId, failDetail }, "[image] OG failed, falling back to wan2.7-image-pro");
          return generateWithWanxiang(input, "wan2.7-image-pro");
        }
        throw new Error(failDetail ? `Tencent image generation failed: ${failDetail}` : "Tencent image generation failed");
      }
    }
    if (!result.url) {
      // Timeout fallback to wan
      if (key.startsWith("tencent-og") && env.ALIBABA_DASHSCOPE_API_KEY) {
        logger.warn({ taskId: result.taskId, attempts: maxAttempts }, "[image] OG timed out, falling back to wan2.7-image-pro");
        return generateWithWanxiang(input, "wan2.7-image-pro");
      }
      throw new Error(`Tencent image generation timed out after ${maxAttempts} polls. Task: ${result.taskId}`);
    }
  }

  return result;
}
