"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelProjectJobs } from "@/lib/queue/flows";
import { regenerateStructuredPromptsOnly } from "@/lib/orchestrator/director";

/**
 * 保留场次与 MRI，删除所有分镜行并重跑 ECP（结构化 imagePrompt / videoPrompt）。
 * 独立文件，避免在 `projects.ts` 顶层引用 orchestrator 影响 client/server 边界打包。
 */
export async function regenerateStructuredPrompts(projectId: string) {
  await cancelProjectJobs(projectId);
  await regenerateStructuredPromptsOnly(projectId);
  revalidatePath(`/editor/${projectId}`);
  revalidatePath(`/projects/${projectId}/storyboard`);
  revalidatePath(`/projects/${projectId}/progress`);
  revalidatePath(`/projects/${projectId}/result`);
  redirect(`/editor/${projectId}`);
}
