import path from "path";
import { createReadStream, stat } from "fs";
import { promisify } from "util";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statAsync = promisify(stat);

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

function resolveUnderLocalRoot(segments: string[]): { fullPath: string; key: string } | null {
  if (!env.LOCAL_ASSETS_DIR || segments.length === 0) return null;
  const root = path.isAbsolute(env.LOCAL_ASSETS_DIR)
    ? path.resolve(env.LOCAL_ASSETS_DIR)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), env.LOCAL_ASSETS_DIR);
  const decoded = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const key = decoded.join("/");
  if (!key || key.includes("..")) return null;
  const full = path.resolve(root, ...decoded);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return { fullPath: full, key };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const resolved = resolveUnderLocalRoot(segments);
  if (!resolved) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const st = await statAsync(resolved.fullPath);
    if (!st.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = createReadStream(resolved.fullPath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentTypeForKey(resolved.key),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
