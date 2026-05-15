"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { dispatchPipeline, cancelProjectJobs } from "@/lib/queue/flows";

const CreateProjectSchema = z.object({
  title: z.string().min(1).max(120),
  rawScript: z.string().min(20),
  episodeCount: z.coerce.number().int().min(1).max(50).default(1),
  inputType: z.enum(["SCRIPT", "NOVEL"]).default("SCRIPT"),
  language: z.enum(["zh", "en"]).default("zh"),
});

const DEMO_USER_ID = "system";

export async function createProject(formData: FormData) {
  const { title, rawScript, episodeCount, inputType, language } = CreateProjectSchema.parse({
    title: formData.get("title"),
    rawScript: formData.get("rawScript"),
    episodeCount: formData.get("episodeCount"),
    inputType: formData.get("inputType"),
    language: formData.get("language"),
  });

  // Single-user production mode: upsert a shared system user.
  // Replace with real auth session lookup when multi-user auth is added.
  const user = await db.user.upsert({
    where: { email: "system@onestoryboard.local" },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "system@onestoryboard.local",
      name: "System",
      plan: "PRO",
      credits: 999999,
    },
  });

  const project = await db.project.create({
    data: {
      title,
      rawScript,
      episodeCount,
      language,
      userId: user.id,
      status: "DRAFT",
      modelConfig: {
        inputType,
        narrativeStyle: "FIRST_PERSON",
        textModel: "doubao-seed-2-0",
        imageModel: "tencent-og-medium",
        storyboardImageModel: "tencent-og-medium",
        videoModel: "seedance-2.0-fast",
        aspectRatio: "9:16",
        resolution: "1080p",
      },
    },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}/generate`);
}

export async function updateScript(projectId: string, rawScript: string) {
  await db.project.update({
    where: { id: projectId },
    data: { rawScript, updatedAt: new Date() },
  });
  revalidatePath(`/editor/${projectId}`);
}

export async function startGeneration(projectId: string) {
  await db.project.update({
    where: { id: projectId },
    data: {
      status: "GENERATING",
      pipelineStage: "PARSING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });
  await dispatchPipeline(projectId);
  revalidatePath(`/projects/${projectId}/progress`);
  redirect(`/projects/${projectId}/progress`);
}
export async function deleteProject(projectId: string) {
  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
}

export async function reparseProject(projectId: string) {
  // Clear prior structure so dispatchPipeline sees hasShots=false and always re-queues parse.
  await db.scene.deleteMany({ where: { projectId } });
  await db.character.deleteMany({ where: { projectId } });

  await db.project.update({
    where: { id: projectId },
    data: { status: "DRAFT", pipelineStage: "PARSING" },
  });

  await dispatchPipeline(projectId);
  revalidatePath(`/editor/${projectId}`);
  revalidatePath(`/projects/${projectId}/progress`);
  redirect(`/projects/${projectId}/progress`);
}

export async function pauseGeneration(projectId: string) {
  await db.project.update({
    where: { id: projectId },
    data: { status: "PAUSED" },
  });
  revalidatePath(`/projects/${projectId}/progress`);
}

export async function resumeGeneration(projectId: string) {
  const shotCount = await db.shot.count({ where: { scene: { projectId } } });

  await db.project.update({
    where: { id: projectId },
    data: {
      status: "GENERATING",
      errorMessage: null,
      // Failed runs can leave pipelineStage past PARSING with zero shots; reset so UX matches dispatch logic.
      ...(shotCount === 0 ? { pipelineStage: "PARSING" as const } : {}),
    },
  });

  await dispatchPipeline(projectId);
  revalidatePath(`/projects/${projectId}/progress`);
}

export async function cancelGeneration(projectId: string) {
  await db.project.update({
    where: { id: projectId },
    data: { status: "CANCELLED", pipelineStage: "IDLE" },
  });
  await cancelProjectJobs(projectId);
  revalidatePath(`/projects/${projectId}/progress`);
}

export async function updateModelConfig(projectId: string, config: any) {
  const { episodeCount, language, ...modelConfig } = config;

  await db.project.update({
    where: { id: projectId },
    data: { 
      episodeCount: episodeCount ? parseInt(episodeCount) : 1,
      language: language || "zh",
      modelConfig: modelConfig,
      updatedAt: new Date() 
    },
  });
  revalidatePath(`/editor/${projectId}`);
}

import { triggerAssetIngestion } from "@/lib/orchestrator/assets";

export async function updateCharacterRefImage(characterId: string, refImageUrl: string) {
  const char = await db.character.update({
    where: { id: characterId },
    data: { refImageUrl },
  });
  await triggerAssetIngestion({
    projectId: char.projectId,
    id: char.id,
    name: char.name,
    url: refImageUrl,
  });
  revalidatePath(`/editor/${char.projectId}`);
}

export async function updateSceneRefImage(sceneId: string, refImageUrl: string) {
  const scene = await db.scene.update({
    where: { id: sceneId },
    data: {
      refImageUrl,
      volcengineAssetId: null,
      volcengineStatus: null,
    },
  });
  revalidatePath(`/editor/${scene.projectId}`);
}

export async function updatePropRefImage(propId: string, refImageUrl: string) {
  const prop = await db.prop.findUniqueOrThrow({
    where: { id: propId },
    include: { scene: true }
  });
  await db.prop.update({
    where: { id: propId },
    data: {
      refImageUrl,
      volcengineAssetId: null,
      volcengineStatus: null,
    },
  });
  revalidatePath(`/editor/${prop.scene.projectId}`);
}

import {
  generateCharacterReference,
  generateSceneReference,
  generatePropReference,
  resubmitFailedCharacterAudits,
} from "@/lib/orchestrator/assets";
import { runPool } from "@/lib/orchestrator/pipeline-concurrency";

/**
 * Batch-generate all missing reference images for a project (characters + scenes + props)
 * using the same runPool concurrency as the director's ASSET_GENERATION stage.
 * Individual failures are swallowed so the others can still complete.
 */
export async function generateAllProjectAssets(projectId: string) {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { characters: true, scenes: { include: { props: true } } },
  });
  const config = (project.modelConfig as any) || {};
  const conc = 5;

  const charsMissing = project.characters.filter((c) => !c.refImageUrl);
  if (charsMissing.length > 0) {
    await runPool(charsMissing, conc, async (c) => {
      try { await generateCharacterReference(c.id, config.imageModel); } catch { /* logged inside */ }
    });
  }

  type Task = { kind: "scene" | "prop"; id: string };
  const tasks: Task[] = [];
  for (const scene of project.scenes) {
    if (!scene.refImageUrl) tasks.push({ kind: "scene", id: scene.id });
    for (const prop of scene.props) {
      if (!prop.refImageUrl) tasks.push({ kind: "prop", id: prop.id });
    }
  }
  if (tasks.length > 0) {
    await runPool(tasks, conc, async (t) => {
      try {
        if (t.kind === "scene") await generateSceneReference(t.id, config.imageModel);
        else await generatePropReference(t.id, config.imageModel);
      } catch { /* logged inside */ }
    });
  }

  // Re-submit any character Volcengine audits that are missing or failed
  await resubmitFailedCharacterAudits(projectId);

  revalidatePath(`/editor/${projectId}`);
}

export async function regenerateCharacterAsset(characterId: string) {
  const char = await db.character.findUnique({ where: { id: characterId }, include: { project: true } });
  if (!char) throw new Error("Character not found");
  const config = (char.project.modelConfig as any) || {};
  const url = await generateCharacterReference(characterId, config.imageModel);
  revalidatePath(`/editor/${char.projectId}`);
  return url;
}

export async function regenerateSceneAsset(sceneId: string) {
  const scene = await db.scene.findUnique({ where: { id: sceneId }, include: { project: true } });
  if (!scene) throw new Error("Scene not found");
  const config = (scene.project.modelConfig as any) || {};
  const url = await generateSceneReference(sceneId, config.imageModel);
  revalidatePath(`/editor/${scene.projectId}`);
  return url;
}

export async function regeneratePropAsset(propId: string) {
  const prop = await db.prop.findUnique({ where: { id: propId }, include: { scene: { include: { project: true } } } });
  if (!prop) throw new Error("Prop not found");
  const config = (prop.scene.project.modelConfig as any) || {};
  const url = await generatePropReference(propId, config.imageModel);
  revalidatePath(`/editor/${prop.scene.projectId}`);
  return url;
}
