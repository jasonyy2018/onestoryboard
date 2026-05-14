/**
 * 冒烟：仅验证腾讯云点播 CreateAigcImageTask（OG）能否创建任务并轮询到结果。
 * 用法（项目根目录）：npx tsx scripts/smoke-tencent-og.ts
 * 依赖根目录 .env 中的 TENCENT_SECRET_ID / TENCENT_SECRET_KEY / TENCENT_VOD_SUB_APP_ID
 */
import "dotenv/config";
import { generateImage, pollTencentVODTask } from "@/lib/ai/image";

async function main() {
  const need = ["TENCENT_SECRET_ID", "TENCENT_SECRET_KEY", "TENCENT_VOD_SUB_APP_ID"] as const;
  for (const k of need) {
    if (!process.env[k]) {
      console.error(`Missing env ${k}`);
      process.exit(1);
    }
  }

  console.log("[smoke] CreateAigcImageTask via generateImage(model=tencent-og-medium) …");
  const created = await generateImage(
    {
      prompt: "电影静帧：黄昏天台一角，暖色路灯，写实摄影，无字幕无水印",
      negativePrompt: "低画质, 畸形, 水印, 字幕",
      aspectRatio: "16:9",
      size: "2K",
      n: 1,
    },
    "tencent-og-medium",
  );

  console.log("[smoke] create:", { model: created.model, taskId: created.taskId, url: created.url || null });

  if (!created.taskId) {
    console.error("[smoke] no taskId — CreateAigcImageTask did not return TaskId");
    process.exit(2);
  }

  const max = 45;
  const intervalMs = 2000;
  for (let i = 0; i < max; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
    const p = await pollTencentVODTask(created.taskId);
    console.log(`[smoke] poll ${i + 1}/${max}: status=${p.status} urls=${p.urls.length}`);
    if (p.status === "success" && p.urls[0]) {
      console.log("[smoke] OK first image url prefix:", p.urls[0].slice(0, 96) + "…");
      process.exit(0);
    }
    if (p.status === "failed") {
      console.error("[smoke] task failed:", p.failDetail ?? "(no detail)");
      process.exit(3);
    }
  }

  console.error("[smoke] timeout waiting for image");
  process.exit(4);
}

main().catch((e) => {
  console.error("[smoke] error:", e instanceof Error ? e.message : e);
  process.exit(99);
});
