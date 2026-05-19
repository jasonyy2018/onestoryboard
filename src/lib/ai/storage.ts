import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { put } from "@vercel/blob";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

function resolvedLocalAssetsRoot(): string {
  const dir = env.LOCAL_ASSETS_DIR!;
  return path.isAbsolute(dir) ? path.resolve(dir) : path.resolve(process.cwd(), dir);
}

/** Join key to absolute file path; throws if key escapes the storage root. */
function localAssetFilePath(key: string): string {
  const root = resolvedLocalAssetsRoot();
  const normalizedKey = key.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!normalizedKey || normalizedKey.includes("..")) {
    throw new Error(`Unsafe asset key: ${key}`);
  }
  const segments = normalizedKey.split("/").filter(Boolean);
  const full = path.resolve(root, ...segments);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Unsafe asset key: ${key}`);
  }
  return full;
}

/**
 * Upload a buffer or remote URL to long-term storage.
 * Order: Vercel Blob → S3-compatible → local disk (LOCAL_ASSETS_DIR).
 */
export async function persistAsset(args: {
  key: string; // e.g. projects/abc/shots/1.1.mp4
  data: Buffer | ArrayBuffer | Blob;
  contentType: string;
}): Promise<string> {
  if (env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(args.key, args.data as Blob | Buffer, {
      access: "public",
      contentType: args.contentType,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return url;
  }

  if (env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    const s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: args.key,
        Body: Buffer.isBuffer(args.data)
          ? args.data
          : Buffer.from(args.data as ArrayBuffer),
        ContentType: args.contentType,
      }),
    );
    return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${args.key}`;
  }

  if (env.LOCAL_ASSETS_DIR) {
    const full = localAssetFilePath(args.key);
    await mkdir(path.dirname(full), { recursive: true });
    const buf = Buffer.isBuffer(args.data)
      ? args.data
      : Buffer.from(args.data as ArrayBuffer);
    await writeFile(full, buf);
    const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const urlPath = args.key
      .replace(/^[/\\]+/, "")
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .map((p) => encodeURIComponent(p))
      .join("/");
    return `${base}/api/local-assets/${urlPath}`;
  }

  throw new Error(
    "No storage configured: set BLOB_READ_WRITE_TOKEN, or S3_ENDPOINT+S3_BUCKET+S3_ACCESS_KEY_ID+S3_SECRET_ACCESS_KEY, or LOCAL_ASSETS_DIR (dev: e.g. .local-assets).",
  );
}

/** Download remote asset as buffer (for FFmpeg / re-upload). */
export async function fetchAsBuffer(url: string, timeoutMs = 5 * 60 * 1000): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch failed: ${url} → ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`fetchAsBuffer timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
