import { env } from "@/lib/env";
import { withRetry } from "@/lib/ai/retry";

export interface VideoGenInput {
  prompt: string;
  refImageUrls?: string[];
  volcengineAssetIds?: string[];
  duration?: number;
  ratio?: string;
  generateAudio?: boolean;
  cameraMove?: string;
  locale?: string;
}

export interface VideoGenResult {
  url: string;
  cost: number;
  model: string;
  taskId?: string;
}

export type VideoModelKey = "seedance-2.0-fast";

const COST_PER_SECOND: Record<VideoModelKey, number> = {
  "seedance-2.0-fast": 0.08,
};

const MODEL_ID = "doubao-seedance-2-0-fast-260128";

async function createSeedanceTask(input: VideoGenInput): Promise<VideoGenResult> {
  const apiKey = env.VOLCENGINE_ARK_API_KEY;
  if (!apiKey) throw new Error("VOLCENGINE_ARK_API_KEY is not configured");

  const duration = Math.min(Math.max(input.duration ?? 8, 4), 30);

  const content: object[] = [];

  const useZh = !input.locale || input.locale === "zh";
  const moveLabel = useZh ? "镜头运动" : "Camera movement";
  const promptText = input.cameraMove
    ? `${input.prompt}。${moveLabel}：${input.cameraMove}`
    : input.prompt;
  content.push({ type: "text", text: promptText });

  for (const url of input.refImageUrls ?? []) {
    content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
  }
  for (const assetId of input.volcengineAssetIds ?? []) {
    content.push({ type: "image_url", image_url: { url: `asset://${assetId}` }, role: "reference_image" });
  }

  const body = {
    model: MODEL_ID,
    content,
    generate_audio: input.generateAudio ?? true,
    ratio: input.ratio ?? "16:9",
    duration,
    watermark: false,
  };

  const res = await fetch(
    "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new Error(`Volcengine Ark API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    id?: string;
    status?: string;
    error?: { code: string; message: string };
  };

  if (data.error) throw new Error(`Seedance error [${data.error.code}]: ${data.error.message}`);

  return {
    url: "",
    cost: duration * COST_PER_SECOND["seedance-2.0-fast"],
    model: "seedance-2.0-fast",
    taskId: data.id,
  };
}

export async function pollSeedanceTask(taskId: string): Promise<{ url: string; status: string }> {
  const apiKey = env.VOLCENGINE_ARK_API_KEY;
  if (!apiKey) throw new Error("VOLCENGINE_ARK_API_KEY is not configured");

  const res = await fetch(
    `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );

  if (!res.ok) throw new Error(`Seedance poll error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    status?: string;
    content?: Array<{ type: string; video_url?: { url: string } }>;
    error?: { code: string; message: string };
  };

  if (data.error) throw new Error(`Seedance task error [${data.error.code}]: ${data.error.message}`);

  const status = data.status ?? "pending";
  const url = status === "succeeded"
    ? (data.content?.find((c) => c.type === "video_url")?.video_url?.url ?? "")
    : "";

  return { url, status };
}

export async function generateVideo(input: VideoGenInput): Promise<VideoGenResult> {
  return withRetry(
    () => createSeedanceTask(input),
    { context: "video:seedance-2.0-fast", retries: 2, minTimeout: 3000 },
  );
}
