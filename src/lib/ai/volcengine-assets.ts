import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import crypto from "crypto";

const SERVICE = "ark";
const REGION = "cn-beijing";
const VERSION = "2024-01-01";
const HOST = "open.volcengineapi.com"; // Universal RPC host

/**
 * Volcengine AK/SK Signer (AWS V4 style)
 */
function sign(options: {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  ak: string;
  sk: string;
  now: Date;
}) {
  const { method, path, query, headers, body, ak, sk, now } = options;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  // 1. Canonical Headers & Signed Headers
  const headerEntries = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), v.trim()])
    .sort(([a = ""], [b = ""]) => a < b ? -1 : a > b ? 1 : 0);

  const canonicalHeaders = headerEntries
    .map(([k, v]) => `${k}:${v}`)
    .join("\n") + "\n";

  const signedHeaders = headerEntries
    .map(([k]) => k)
    .join(";");

  // 3. Canonical Query
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // 4. Payload Hash
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");

  // 5. Canonical Request
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "HMAC-SHA256",
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/request`,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const kDate = crypto.createHmac("sha256", sk).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(REGION).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(SERVICE).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("request").digest();
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `HMAC-SHA256 Credential=${ak}/${dateStamp}/${REGION}/${SERVICE}/request, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function volcCall(action: string, body: any) {
  const ak = env.VOLCENGINE_ACCESS_KEY_ID;
  const sk = env.VOLCENGINE_SECRET_ACCESS_KEY;
  if (!ak || !sk) throw new Error("Volcengine AK/SK not configured");

  const effectiveSk = sk;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const payload = JSON.stringify(body);
  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Host": HOST,
    "X-Date": amzDate,
    "X-Content-Sha256": payloadHash,
  };

  const authorization = sign({
    method: "POST",
    path: "/",
    query: { Action: action, Version: VERSION },
    headers,
    body: payload,
    ak,
    sk: effectiveSk,
    now
  });

  const url = `https://${HOST}/?Action=${action}&Version=${VERSION}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "host": HOST,
        "x-date": amzDate,
        "x-content-sha256": payloadHash,
        "authorization": authorization
      },
      body: payload
    });

    const data = await res.json();
    
    if (data.ResponseMetadata?.Error) {
      console.error(">>> VOLCENGINE ERROR RESPONSE:", JSON.stringify(data, null, 2));
      logger.error({
        action,
        error: data.ResponseMetadata.Error,
        requestId: data.ResponseMetadata.RequestId
      }, "Volcengine Asset API Error Details");
      throw new Error(`Volcengine Asset API Error [${data.ResponseMetadata.Error.Code}]: ${data.ResponseMetadata.Error.Message}`);
    }
    
    return data.Result;
  } catch (error: any) {
    console.error(">>> VOLCENGINE REQUEST FAILED:", error.message);
    throw error;
  }
}

export async function createAssetGroup(name: string, description: string = "") {
  return volcCall("CreateAssetGroup", {
    Name: name,
    Description: description,
    GroupType: "AIGC"
  });
}

export async function createAsset(args: {
  groupId: string;
  url: string;
  assetType: "Image" | "Video" | "Audio";
  name?: string;
}) {
  return volcCall("CreateAsset", {
    GroupId: args.groupId,
    URL: args.url,
    AssetType: args.assetType,
    Name: args.name || ""
  });
}

export async function getAsset(assetId: string) {
  return volcCall("GetAsset", {
    Id: assetId
  });
}

export async function pollAssetStatus(assetId: string): Promise<string> {
  const asset = await getAsset(assetId);
  return asset.Status; // Processing, Active, Failed
}
