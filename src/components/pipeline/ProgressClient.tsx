"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pause, X, Sparkles, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressGenerationFlow } from "@/components/pipeline/ProgressGenerationFlow";
import { ShotFlowGrid, type ShotFlowItem } from "@/components/pipeline/ShotFlowGrid";
import { ActivityLog } from "@/components/pipeline/ActivityLog";
import { pauseGeneration, resumeGeneration, cancelGeneration } from "@/app/actions/projects";
import { getProjectUi, pipelineStageLabel, projectStatusLabel } from "@/lib/i18n/project-ui";
import type { PipelineStage, ProjectStatus } from "@prisma/client";

export type ProgressClientProject = {
  id: string;
  title: string;
  status: ProjectStatus;
  pipelineStage: PipelineStage;
  language: string;
  startedAt: Date | null;
};

export type ProgressClientShot = ShotFlowItem;

interface Props {
  project: ProgressClientProject;
  initialShots: ProgressClientShot[];
}

/** Map raw SSE snapshot scenes→shots into ShotFlowItem[] */
function snapshotToShots(data: any): ProgressClientShot[] {
  if (!data?.scenes) return [];
  return (data.scenes as any[]).flatMap((s: any) =>
    (s.shots ?? []).map((sh: any) => ({
      shotId: sh.id,
      episodeNumber: s.episodeNumber ?? 1,
      sceneOrder: s.order ?? 1,
      sceneLocation: s.location ?? "",
      shotOrder: sh.order ?? 1,
      type: sh.type ?? "",
      cameraMove: sh.cameraMove ?? null,
      status: sh.status,
      imagePrompt: sh.imagePrompt ?? null,
      videoPrompt: sh.videoPrompt ?? null,
      imageUrl: sh.imageUrl ?? null,
      videoUrl: sh.videoUrl ?? null,
      errorMsg: sh.errorMsg ?? null,
    }))
  );
}

export function ProgressClient({ project: initialProject, initialShots }: Props) {
  const [project, setProject] = useState(initialProject);
  const [shots, setShots] = useState<ProgressClientShot[]>(initialShots);

  const loc = project.language;
  const ui = getProjectUi(loc);
  const readyCount = shots.filter((s) => s.status === "READY").length;

  // SSE: receive snapshot updates and refresh shots + project state
  useEffect(() => {
    const es = new EventSource(`/api/projects/${initialProject.id}/events`);

    es.addEventListener("snapshot", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data);
      if (!data) return;
      // Update project meta
      setProject((prev) => ({
        ...prev,
        status: data.status ?? prev.status,
        pipelineStage: data.pipelineStage ?? prev.pipelineStage,
      }));
      // Update shots list (parse→storyboard will add shots progressively)
      const newShots = snapshotToShots(data);
      setShots(newShots);
    });

    es.addEventListener("done", () => es.close());
    return () => es.close();
  }, [initialProject.id]);

  const isPaused = project.status === "PAUSED";
  const isFailed = project.status === "FAILED";
  const isCompleted = project.status === "COMPLETED";
  const isCancelled = project.status === "CANCELLED";
  const canResume = isPaused || isFailed;

  return (
    <div className="flex h-screen flex-col bg-bg">
      {/* Topbar */}
      <header className="flex h-15 items-center gap-4 border-b border-border-subtle px-8 py-3">
        <Link
          href={`/editor/${initialProject.id}`}
          className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {ui.progress.backEditor}
        </Link>
        <div className="h-5 w-px bg-border-subtle" />
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{project.title}</span>
            <Badge
              color={
                project.status === "GENERATING"
                  ? "amber"
                  : project.status === "COMPLETED"
                    ? "green"
                    : "red"
              }
            >
              {projectStatusLabel(loc, project.status)}
            </Badge>
            {project.pipelineStage !== "IDLE" && project.pipelineStage !== "DONE" && (
              <span className="font-mono text-[10px] text-fg-muted">
                {pipelineStageLabel(loc, project.pipelineStage)}
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-fg-muted">
            {project.startedAt &&
              `${ui.progress.started} ${new Date(project.startedAt).toLocaleTimeString(
                loc === "en" ? "en-US" : "zh-CN",
              )}`}{" "}
            · {readyCount}/{shots.length} {ui.progress.shotsReady}
          </div>
        </div>
        <div className="flex-1" />

        <Link
          href={`/projects/${initialProject.id}/storyboard`}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-accent-purple/50 bg-bg-card px-3 text-xs font-medium text-accent-purple hover:bg-accent-purple/10"
        >
          <Clapperboard className="h-3.5 w-3.5" />
          {ui.progress.storyboardLink}
        </Link>

        {canResume ? (
          <form action={resumeGeneration.bind(null, initialProject.id)}>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-accent-purple px-3 text-xs text-accent-purple"
            >
              <Sparkles className="h-3 w-3" /> {ui.progress.resumePipeline}
            </button>
          </form>
        ) : (
          <form action={pauseGeneration.bind(null, initialProject.id)}>
            <button
              type="submit"
              disabled={project.status !== "GENERATING"}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle px-3 text-xs disabled:opacity-50"
            >
              <Pause className="h-3 w-3" /> {ui.progress.pausePipeline}
            </button>
          </form>
        )}

        <form action={cancelGeneration.bind(null, initialProject.id)}>
          <button
            type="submit"
            disabled={isCompleted || isCancelled}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-accent-red px-3 text-xs text-accent-red disabled:opacity-50"
          >
            <X className="h-3 w-3" /> {ui.progress.cancel}
          </button>
        </form>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 space-y-6 overflow-y-auto p-8">
          <ProgressGenerationFlow
            lang={loc === "en" ? "en" : "zh"}
            ui={ui.progress}
            pipelineStage={project.pipelineStage}
            projectStatus={project.status}
            shots={shots.map((s) => ({
              status: s.status,
              imagePrompt: s.imagePrompt,
              videoPrompt: s.videoPrompt,
              imageUrl: s.imageUrl,
              videoUrl: s.videoUrl,
            }))}
          />
          <ShotFlowGrid shots={shots} lang={loc} />
        </main>
        <aside className="flex w-[380px] shrink-0 flex-col border-l border-border-subtle bg-bg-elevated">
          <ActivityLog projectId={initialProject.id} lang={loc} />
        </aside>
      </div>
    </div>
  );
}
