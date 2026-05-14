import { Check, FileText, LayoutGrid, Image as ImageIcon, Film, Workflow } from "lucide-react";
import type { PipelineStage, ProjectStatus } from "@prisma/client";
import { formatPipelineStepLabel, getProjectUi } from "@/lib/i18n/project-ui";

const STAGE_KEYS = ["PARSING", "ASSET_GENERATION", "STORYBOARDING", "COMPOSING"] as const;

function resolveStepState(
  currentStage: PipelineStage,
  projectStatus?: ProjectStatus,
): { activeIdx: number; allComplete: boolean } {
  if (currentStage === "PARSING") return { activeIdx: 0, allComplete: false };
  if (currentStage === "ASSET_GENERATION") return { activeIdx: 1, allComplete: false };
  if (currentStage === "STORYBOARDING") return { activeIdx: 2, allComplete: false };
  if (currentStage === "COMPOSING" || currentStage === "AUDIO") return { activeIdx: 3, allComplete: false };
  if (currentStage === "DONE") {
    if (projectStatus === "COMPLETED") return { activeIdx: 3, allComplete: true };
    return { activeIdx: 3, allComplete: false };
  }
  return { activeIdx: -1, allComplete: false };
}

export function PipelineStepper({
  currentStage,
  projectStatus,
  lang,
}: {
  currentStage: PipelineStage;
  projectStatus?: ProjectStatus;
  /** `project.language`：zh / en */
  lang: string;
}) {
  const ui = getProjectUi(lang);
  const { activeIdx, allComplete } = resolveStepState(currentStage, projectStatus);
  const stages = ui.pipeline.stages;

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-elevated p-6">
      <header className="mb-5 flex items-center gap-2">
        <Workflow className="h-4 w-4 text-accent-purple" />
        <h2 className="text-sm font-semibold">{ui.pipeline.title}</h2>
        <div className="flex-1" />
        <span className="font-mono text-[11px] text-fg-muted">
          {formatPipelineStepLabel(lang, activeIdx, STAGE_KEYS.length)}
        </span>
      </header>

      <div className="flex items-start gap-0">
        {STAGE_KEYS.map((key, idx) => {
          const stage = stages[idx]!;
          const isDone = allComplete || (activeIdx >= 0 && idx < activeIdx);
          const isActive = !allComplete && activeIdx === idx;
          const Icon = [FileText, ImageIcon, LayoutGrid, Film][idx]!;

          return (
            <div key={key} className="flex flex-1 items-start">
              <div className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                    isDone
                      ? "border-accent-green bg-bg-card"
                      : isActive
                        ? "border-transparent bg-accent-amber"
                        : "border-border-strong bg-bg-card"
                  }`}
                >
                  {isDone ? (
                    <Check className="h-5 w-5 text-accent-green" />
                  ) : (
                    <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-fg-subtle"}`} />
                  )}
                </div>
                <div
                  className={`text-center text-xs font-medium ${
                    isDone || isActive ? "text-fg" : "text-fg-muted"
                  }`}
                >
                  {stage.label}
                </div>
                <div className="text-center font-mono text-[10px] text-fg-muted">{stage.hint}</div>
                <div
                  className={`font-mono text-[10px] ${
                    isDone
                      ? "text-accent-green"
                      : isActive
                        ? "text-accent-amber"
                        : "text-fg-muted"
                  }`}
                >
                  {isDone ? ui.pipeline.done : isActive ? ui.pipeline.running : ui.pipeline.pending}
                </div>
              </div>
              {idx < STAGE_KEYS.length - 1 && (
                <div
                  className={`mt-6 h-0.5 w-12 ${
                    allComplete || idx < activeIdx
                      ? "bg-accent-green"
                      : idx === activeIdx
                        ? "bg-accent-amber"
                        : "bg-border-strong"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
