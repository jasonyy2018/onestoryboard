import type { ReactNode } from "react";
import type { PipelineStage, ProjectStatus, ShotStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import type { ProjectUi } from "@/lib/i18n/project-ui";

type FlowShot = {
  status: ShotStatus;
  imagePrompt: string | null;
  videoPrompt: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
};

export type ProgressGenerationFlowProps = {
  lang: "en" | "zh";
  ui: ProjectUi["progress"];
  pipelineStage: PipelineStage;
  projectStatus: ProjectStatus;
  shots: FlowShot[];
};

type NodeState = "pending" | "active" | "done";

function deriveNodeStates(
  pipelineStage: PipelineStage,
  projectStatus: ProjectStatus,
  shots: FlowShot[],
): { prompt: NodeState; image: NodeState; video: NodeState } {
  const n = shots.length;
  const generating = projectStatus === "GENERATING";
  const anyImg = shots.some((s) => s.status === "GENERATING_IMAGE");
  const anyVid = shots.some((s) => s.status === "GENERATING_VIDEO");
  const allPrompt =
    n > 0 &&
    shots.every(
      (s) =>
        (s.imagePrompt ?? "").trim().length > 0 && (s.videoPrompt ?? "").trim().length > 0,
    );
  const allImg = n > 0 && shots.every((s) => !!s.imageUrl);
  const allVid =
    n > 0 && shots.every((s) => s.status === "READY" && !!s.videoUrl);

  if (projectStatus === "COMPLETED") {
    return { prompt: "done", image: "done", video: "done" };
  }

  let prompt: NodeState = "pending";
  if (allPrompt) prompt = "done";
  else if (
    generating &&
    (pipelineStage === "PARSING" ||
      pipelineStage === "ASSET_GENERATION" ||
      pipelineStage === "STORYBOARDING" ||
      (n > 0 && !allPrompt))
  ) {
    prompt = "active";
  }

  let image: NodeState = "pending";
  if (allImg) image = "done";
  else if (
    anyImg ||
    (generating && allPrompt && !allImg) ||
    (generating && pipelineStage === "ASSET_GENERATION" && n > 0 && allPrompt)
  ) {
    image = "active";
  } else if (allPrompt && !allImg && !generating && n > 0) {
    image = "pending";
  }

  let video: NodeState = "pending";
  if (allVid) {
    video = "done";
  } else if (
    anyVid ||
    pipelineStage === "COMPOSING" ||
    (generating && allImg && !allVid)
  ) {
    video = "active";
  }

  return { prompt, image, video };
}

function FlowConnector({ tone, active }: { tone: "amber" | "emerald"; active: boolean }) {
  const stroke = tone === "amber" ? "rgb(251 191 36)" : "rgb(52 211 153)";
  return (
    <div
      className={cn(
        "relative flex w-7 shrink-0 items-center justify-center self-stretch sm:w-10",
        active ? "opacity-100" : "opacity-35",
      )}
      aria-hidden
    >
      <svg viewBox="0 0 40 100" className="h-full min-h-[100px] w-full max-h-[200px]" preserveAspectRatio="none">
        <path
          d="M 2 50 C 14 20, 26 80, 38 50"
          fill="none"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function FlowPanel(props: {
  title: string;
  hint: string;
  state: NodeState;
  paused: boolean;
  statusLabel: { pending: string; active: string; done: string };
  children: ReactNode;
}) {
  const { title, hint, state, paused, statusLabel, children } = props;
  const badge =
    state === "done" ? statusLabel.done : state === "active" ? statusLabel.active : statusLabel.pending;
  return (
    <section
      className={cn(
        "flex min-h-[148px] min-w-0 flex-1 flex-col border border-border-subtle bg-bg-card/90 p-3 sm:p-4",
        state === "active" && !paused && "ring-1 ring-amber-400/45 shadow-[0_0_24px_-8px_rgba(251,191,36,0.35)]",
        state === "done" && "border-accent-green/25 bg-accent-green/[0.04]",
      )}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {title}
          </p>
          <p className="truncate text-[11px] text-fg-muted">{hint}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px]",
            state === "done" && "bg-accent-green/15 text-accent-green",
            state === "active" && "bg-amber-500/15 text-amber-200",
            state === "pending" && "bg-bg-elevated text-fg-muted",
          )}
        >
          {badge}
        </span>
      </header>
      <div className="min-h-[88px] flex-1 overflow-hidden rounded-lg border border-border-subtle/80 bg-bg/80">
        {children}
      </div>
    </section>
  );
}

export function ProgressGenerationFlow({
  lang,
  ui,
  pipelineStage,
  projectStatus,
  shots,
}: ProgressGenerationFlowProps) {
  const { prompt, image, video } = deriveNodeStates(pipelineStage, projectStatus, shots);
  const paused = projectStatus === "PAUSED";
  const statusLabel = { pending: ui.flowPending, active: ui.flowActive, done: ui.flowDone };

  const previewBlocks =
    shots.length === 0
      ? null
      : shots.slice(0, 4).map((s, i) => {
          const num = String(i + 1).padStart(2, "0");
          const img = (s.imagePrompt ?? "").replace(/\s+/g, " ").trim();
          const vid = (s.videoPrompt ?? "").replace(/\s+/g, " ").trim();
          const max = lang === "en" ? 200 : 120;
          const imgT = img.slice(0, max) + (img.length > max ? "…" : "");
          const vidT = vid.slice(0, max) + (vid.length > max ? "…" : "");
          return { num, imgT, vidT };
        });

  const thumbs = shots.map((s) => s.imageUrl).filter(Boolean) as string[];
  const firstVideo = shots.find((s) => s.videoUrl)?.videoUrl ?? null;

  const connector1Active = prompt === "active" || image === "active" || (prompt === "done" && image !== "pending");
  const connector2Active = image === "active" || video === "active" || (image === "done" && video !== "pending");

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-sm font-medium text-fg">{ui.flowTitle}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{ui.flowCaption}</p>
      </div>
      <div className="flex flex-col rounded-2xl border border-border-subtle bg-bg-elevated/80 p-2 sm:flex-row sm:items-stretch sm:p-3">
        <FlowPanel
          title={ui.flowTwoPromptsTitle}
          hint={ui.flowTwoPromptsHint}
          state={prompt}
          paused={paused}
          statusLabel={statusLabel}
        >
          {shots.length === 0 ? (
            <p className="p-3 font-mono text-[11px] leading-relaxed text-fg-muted">{ui.flowNoShots}</p>
          ) : (
            <div className="max-h-[140px] space-y-2 overflow-y-auto p-2">
              {previewBlocks?.map((b) => (
                <div key={b.num} className="rounded border border-border-subtle/80 bg-bg/90 p-2">
                  <div className="mb-1 font-mono text-[9px] font-semibold text-fg-subtle">#{b.num}</div>
                  <div className="mb-1 font-mono text-[9px] text-accent-cyan">{ui.flowLabelImagePrompt}</div>
                  <div className="font-mono text-[9px] leading-snug text-fg-muted break-words">{b.imgT || "—"}</div>
                  <div className="mb-1 mt-1.5 font-mono text-[9px] text-accent-purple">{ui.flowLabelVideoPrompt}</div>
                  <div className="font-mono text-[9px] leading-snug text-fg-muted break-words">{b.vidT || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </FlowPanel>
        <div className="hidden sm:flex">
          <FlowConnector tone="amber" active={connector1Active} />
        </div>
        <div className="my-1 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent sm:hidden" />

        <FlowPanel
          title={ui.flowPanelImageTitle}
          hint={ui.flowPanelImageHint}
          state={image}
          paused={paused}
          statusLabel={statusLabel}
        >
          {thumbs.length === 0 ? (
            <div className="flex h-full min-h-[88px] items-center justify-center p-3 text-center font-mono text-[10px] text-fg-muted">
              {shots.length === 0 ? ui.flowNoShots : "—"}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 p-2">
              {thumbs.slice(0, 6).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-video w-full rounded object-cover"
                />
              ))}
            </div>
          )}
        </FlowPanel>
        <div className="hidden sm:flex">
          <FlowConnector tone="emerald" active={connector2Active} />
        </div>
        <div className="my-1 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent sm:hidden" />

        <FlowPanel title={ui.flowClipTitle} hint={ui.flowClipHint} state={video} paused={paused} statusLabel={statusLabel}>
          {firstVideo ? (
            <video
              key={firstVideo}
              src={firstVideo}
              className="h-full max-h-[120px] w-full object-cover"
              muted
              playsInline
              loop
              autoPlay
              controls={false}
            />
          ) : (
            <div className="flex h-full min-h-[88px] items-center justify-center p-3 text-center font-mono text-[10px] text-fg-muted">
              —
            </div>
          )}
        </FlowPanel>
      </div>
    </div>
  );
}
