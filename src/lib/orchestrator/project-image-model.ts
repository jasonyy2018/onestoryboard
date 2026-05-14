import type { ImageModelKey } from "@/lib/ai/image";
import { env } from "@/lib/env";

const ALL_IMAGE_KEYS: readonly ImageModelKey[] = [
  "tencent-og-low",
  "tencent-og-medium",
  "tencent-og-high",
  "wan2.7-image-pro",
  "wan2.7-image",
] as const;

function isImageModelKey(s: string): s is ImageModelKey {
  return (ALL_IMAGE_KEYS as readonly string[]).includes(s);
}

/**
 * wan2.7 仅作 OG 不可用时的备用，不作为主力模型。
 * 旧项目若仍保存 wan2.7-* 自动迁移为 tencent-og-medium。
 */
export function migrateWanToTencentOg(modelKey: ImageModelKey): ImageModelKey {
  return modelKey === "wan2.7-image-pro" || modelKey === "wan2.7-image"
    ? "tencent-og-medium"
    : modelKey;
}

export function resolveProjectImageModelKey(modelConfig: Record<string, unknown>): ImageModelKey {
  const img = modelConfig.imageModel;
  if (typeof img === "string" && isImageModelKey(img)) return migrateWanToTencentOg(img);
  const def = env.DEFAULT_IMAGE_MODEL;
  if (isImageModelKey(def)) return migrateWanToTencentOg(def);
  return "tencent-og-medium";
}

export function resolveStoryboardImageModelKey(modelConfig: Record<string, unknown>): ImageModelKey {
  const sb = modelConfig.storyboardImageModel;
  if (typeof sb === "string" && isImageModelKey(sb)) return migrateWanToTencentOg(sb);
  return resolveProjectImageModelKey(modelConfig);
}

export function coerceImageModelKey(
  modelKey: string | undefined,
  modelConfig: Record<string, unknown>,
): ImageModelKey {
  if (typeof modelKey === "string" && isImageModelKey(modelKey)) return migrateWanToTencentOg(modelKey);
  return resolveProjectImageModelKey(modelConfig);
}
