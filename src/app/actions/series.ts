"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { dispatchPipeline } from "@/lib/queue/flows";
import {
  createSeriesWithFirstEpisode,
  createSeriesFromFullScript,
  appendEpisodeToSeries,
} from "@/lib/orchestrator/series";

const DEMO_USER_ID = "system";

const BaseModelConfig = {
  narrativeStyle: "FIRST_PERSON",
  textModel: "doubao-seed-2-0",
  imageModel: "tencent-og-medium",
  storyboardImageModel: "tencent-og-medium",
  videoModel: "seedance-2.0-fast",
  aspectRatio: "9:16",
  resolution: "1080p",
};

// ── 新建剧集系列（模式 B：连载，只含第 1 集）──────────────────────────
const CreateSeriesSchema = z.object({
  title: z.string().min(1).max(120),
  rawScript: z.string().min(20),
  inputType: z.enum(["SCRIPT", "NOVEL"]).default("SCRIPT"),
  language: z.enum(["zh", "en"]).default("zh"),
});

export async function createSerialSeries(formData: FormData) {
  const { title, rawScript, inputType, language } = CreateSeriesSchema.parse({
    title: formData.get("title"),
    rawScript: formData.get("rawScript"),
    inputType: formData.get("inputType"),
    language: formData.get("language"),
  });

  const { seriesId, projectId } = await createSeriesWithFirstEpisode({
    title,
    language,
    rawScript,
    inputType,
    modelConfig: BaseModelConfig,
  });

  // 立即触发第 1 集生成
  await db.project.update({
    where: { id: projectId },
    data: { status: "GENERATING", pipelineStage: "PARSING", startedAt: new Date() },
  });
  await dispatchPipeline(projectId);

  revalidatePath("/projects");
  redirect(`/series/${seriesId}`);
}

// ── 新建剧集系列（模式 A：整部导入，自动拆集）────────────────────────
const CreateFullSeriesSchema = z.object({
  title: z.string().min(1).max(120),
  rawScript: z.string().min(20),
  inputType: z.enum(["SCRIPT", "NOVEL"]).default("NOVEL"),
  language: z.enum(["zh", "en"]).default("zh"),
});

export async function createFullSeries(formData: FormData) {
  const { title, rawScript, inputType, language } = CreateFullSeriesSchema.parse({
    title: formData.get("title"),
    rawScript: formData.get("rawScript"),
    inputType: formData.get("inputType"),
    language: formData.get("language"),
  });

  const { seriesId, projectIds } = await createSeriesFromFullScript({
    title,
    language,
    rawScript,
    inputType,
    modelConfig: BaseModelConfig,
  });

  // 触发所有集生成（并发上限由 WORKER_SHOT_CONCURRENCY 控制）
  for (const pid of projectIds) {
    await db.project.update({
      where: { id: pid },
      data: { status: "GENERATING", pipelineStage: "PARSING", startedAt: new Date() },
    });
    await dispatchPipeline(pid);
  }

  revalidatePath("/projects");
  redirect(`/series/${seriesId}`);
}

// ── 追加新集 ────────────────────────────────────────────────────────
const AppendEpisodeSchema = z.object({
  seriesId: z.string(),
  rawScript: z.string().min(20),
  inputType: z.enum(["SCRIPT", "NOVEL"]).default("SCRIPT"),
});

export async function appendEpisode(formData: FormData) {
  const { seriesId, rawScript, inputType } = AppendEpisodeSchema.parse({
    seriesId: formData.get("seriesId"),
    rawScript: formData.get("rawScript"),
    inputType: formData.get("inputType"),
  });

  const { projectId } = await appendEpisodeToSeries({
    seriesId,
    rawScript,
    inputType,
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "GENERATING", pipelineStage: "PARSING", startedAt: new Date() },
  });
  await dispatchPipeline(projectId);

  revalidatePath(`/series/${seriesId}`);
  redirect(`/projects/${projectId}/progress`);
}

// ── 获取 Series 详情（含所有集）────────────────────────────────────
export async function getSeriesDetail(seriesId: string) {
  return db.series.findUnique({
    where: { id: seriesId },
    include: {
      episodes: {
        orderBy: { seriesEpisodeNumber: "asc" },
        select: {
          id: true,
          title: true,
          seriesEpisodeNumber: true,
          status: true,
          pipelineStage: true,
          duration: true,
          thumbnailUrl: true,
          finalVideoUrl: true,
          totalCost: true,
          completedAt: true,
          updatedAt: true,
          errorMessage: true,
        },
      },
      characters: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          refImageUrl: true,
          volcengineStatus: true,
        },
      },
    },
  });
}
