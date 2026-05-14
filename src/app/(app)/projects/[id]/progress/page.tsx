import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProgressClient } from "@/components/pipeline/ProgressClient";
import type { ProgressClientShot } from "@/components/pipeline/ProgressClient";

export const dynamic = "force-dynamic";

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      scenes: {
        orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
        include: {
          shots: {
            orderBy: { order: "asc" },
            include: {
              characters: {
                include: { character: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!project) notFound();

  const initialShots: ProgressClientShot[] = project.scenes.flatMap((s) =>
    s.shots.map((sh) => ({
      shotId: sh.id,
      episodeNumber: s.episodeNumber,
      sceneOrder: s.order,
      sceneLocation: (s as any).location ?? "",
      shotOrder: sh.order,
      type: (sh as any).type ?? "",
      cameraMove: (sh as any).cameraMove ?? null,
      status: sh.status,
      imagePrompt: sh.imagePrompt ?? null,
      videoPrompt: sh.videoPrompt ?? null,
      imageUrl: sh.imageUrl ?? null,
      videoUrl: sh.videoUrl ?? null,
      errorMsg: (sh as any).errorMsg ?? null,
    }))
  );

  return (
    <ProgressClient
      project={{
        id: project.id,
        title: project.title,
        status: project.status,
        pipelineStage: project.pipelineStage,
        language: project.language,
        startedAt: project.startedAt,
      }}
      initialShots={initialShots}
    />
  );
}
