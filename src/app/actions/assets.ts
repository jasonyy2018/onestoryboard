"use server";

import { triggerAssetIngestion } from "@/lib/orchestrator/assets";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Called when the user manually confirms all assets look good.
 * Sets modelConfig.assetsConfirmed = true so the director's waitForCharacterAudits
 * loop can exit immediately and proceed to storyboarding.
 */
export async function confirmAssetsReady(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const config = (project.modelConfig as Record<string, unknown>) ?? {};
  await db.project.update({
    where: { id: projectId },
    data: { modelConfig: { ...config, assetsConfirmed: true } },
  });
  revalidatePath(`/editor/${projectId}`);
}

export async function ingestCharacterAsset(characterId: string) {
  const char = await db.character.findUniqueOrThrow({
    where: { id: characterId }
  });

  if (!char.refImageUrl) throw new Error("Character has no reference image");

  await triggerAssetIngestion({
    projectId: char.projectId,
    id: char.id,
    name: char.name,
    url: char.refImageUrl,
  });

  revalidatePath(`/assets/characters`);
  revalidatePath(`/projects/${char.projectId}/editor`);
}
