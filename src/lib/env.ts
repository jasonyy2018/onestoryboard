import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Validated env. Fails fast at startup if required keys are missing.
 * Reference any env value via `env.X` instead of `process.env.X`.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    // Storage (one of)
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    /**
     * Dev / self-host without cloud blob: write assets under this directory and serve via
     * GET /api/local-assets/... (see persistAsset). Relative paths resolve from process.cwd().
     */
    LOCAL_ASSETS_DIR: z.string().optional(),

    // AI keys — only Volcengine (Doubao text + Seedance video) and Tencent (OG image) are used

    // 国内 AI 平台
    ALIBABA_DASHSCOPE_API_KEY: z.string().optional(),
    TENCENT_SECRET_ID: z.string().optional(),
    TENCENT_SECRET_KEY: z.string().optional(),
    TENCENT_VOD_SUB_APP_ID: z.coerce.number().int().optional(),
    /** 设为 1 时，CreateAigcImageTask 关闭 Input/Output 合规检查并关闭 EnhancePrompt，仅作敏感题材调试（生产慎用）。 */
    TENCENT_AIGC_RELAX_COMPLIANCE: z.string().optional(),
    /**
     * DescribeAigcImageTask 轮询次数上限（每次间隔见 TENCENT_AIGC_IMAGE_POLL_INTERVAL_MS）。
     * OG/2K 高峰可能超过数分钟；默认 200 约 8+ 分钟。
     */
    TENCENT_AIGC_IMAGE_POLL_MAX_ATTEMPTS: z.coerce.number().int().min(30).max(600).default(200),
    /** 两次拉取任务状态之间的等待毫秒数，默认 2500。 */
    TENCENT_AIGC_IMAGE_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).max(15000).default(2500),
    VOLCENGINE_ARK_API_KEY: z.string().optional(),
    VOLCENGINE_ACCESS_KEY_ID: z.string().optional(),
    VOLCENGINE_SECRET_ACCESS_KEY: z.string().optional(),
    DOUBAO_ENDPOINT_ID: z.string().optional(),

    // Defaults — locked: doubao text, tencent-og-medium image, seedance-2.0-fast video
    DEFAULT_TEXT_MODEL: z.string().default("doubao-seed-2-0"),
    DEFAULT_IMAGE_MODEL: z.string().default("tencent-og-medium"),
    DEFAULT_VIDEO_MODEL: z.string().default("seedance-2.0-fast"),

    // Worker tuning — both image and video pipelines default to 5 parallel tasks.
    /** BullMQ shot worker concurrency: how many shots (image→video) run in parallel. */
    WORKER_SHOT_CONCURRENCY: z.coerce.number().int().min(1).default(5),
    /** Parallel reference-image tasks inside the asset-generation stage (chars + scenes + props). */
    PIPELINE_IMAGE_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(5),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    LOCAL_ASSETS_DIR: process.env.LOCAL_ASSETS_DIR,
    ALIBABA_DASHSCOPE_API_KEY: process.env.ALIBABA_DASHSCOPE_API_KEY,
    TENCENT_SECRET_ID: process.env.TENCENT_SECRET_ID,
    TENCENT_SECRET_KEY: process.env.TENCENT_SECRET_KEY,
    TENCENT_VOD_SUB_APP_ID: process.env.TENCENT_VOD_SUB_APP_ID,
    TENCENT_AIGC_RELAX_COMPLIANCE: process.env.TENCENT_AIGC_RELAX_COMPLIANCE,
    TENCENT_AIGC_IMAGE_POLL_MAX_ATTEMPTS: process.env.TENCENT_AIGC_IMAGE_POLL_MAX_ATTEMPTS,
    TENCENT_AIGC_IMAGE_POLL_INTERVAL_MS: process.env.TENCENT_AIGC_IMAGE_POLL_INTERVAL_MS,
    VOLCENGINE_ARK_API_KEY: process.env.VOLCENGINE_ARK_API_KEY,
    VOLCENGINE_ACCESS_KEY_ID: process.env.VOLCENGINE_ACCESS_KEY_ID,
    VOLCENGINE_SECRET_ACCESS_KEY: process.env.VOLCENGINE_SECRET_ACCESS_KEY,
    DOUBAO_ENDPOINT_ID: process.env.DOUBAO_ENDPOINT_ID,
    DEFAULT_TEXT_MODEL: process.env.DEFAULT_TEXT_MODEL,
    DEFAULT_IMAGE_MODEL: process.env.DEFAULT_IMAGE_MODEL,
    DEFAULT_VIDEO_MODEL: process.env.DEFAULT_VIDEO_MODEL,
    WORKER_SHOT_CONCURRENCY: process.env.WORKER_SHOT_CONCURRENCY,
    PIPELINE_IMAGE_CONCURRENCY: process.env.PIPELINE_IMAGE_CONCURRENCY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
