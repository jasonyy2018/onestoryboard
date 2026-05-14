"use client";

import type { ShotStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getProjectUi } from "@/lib/i18n/project-ui";

export type ShotFlowItem = {
  shotId: string;
  episodeNumber: number;
  sceneOrder: number;
  sceneLocation: string;
  shotOrder: number;
  type: string;
  cameraMove: string | null;
  status: ShotStatus;
  imagePrompt: string | null;
  videoPrompt: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  errorMsg: string | null;
};

export type ShotFlowGridProps = {
  shots: ShotFlowItem[];
  lang?: string;
};

const STATUS_LABEL: Record<string, Record<ShotStatus | string, string>> = {
  zh: {
    PENDING: "排队中",
    GENERATING_IMAGE: "生图中…",
    IMAGE_READY: "图已就绪",
    GENERATING_VIDEO: "生视频中…",
    READY: "完成",
    FAILED: "失败",
  },
  en: {
    PENDING: "Queued",
    GENERATING_IMAGE: "Generating image…",
    IMAGE_READY: "Image ready",
    GENERATING_VIDEO: "Generating video…",
    READY: "Done",
    FAILED: "Failed",
  },
};

function statusLabel(status: ShotStatus, lang: string) {
  return STATUS_LABEL[lang]?.[status] ?? status;
}

function statusColor(status: ShotStatus) {
  if (status === "READY") return "text-accent-green border-accent-green/40";
  if (status === "FAILED") return "text-accent-red border-accent-red/40";
  if (status === "GENERATING_IMAGE" || status === "IMAGE_READY" || status === "GENERATING_VIDEO")
    return "text-amber-300 border-amber-400/40";
  return "text-fg-muted border-border-strong";
}

function StageCell({
  state,
  children,
  spinning,
  className,
}: {
  state: "empty" | "active" | "done";
  children: React.ReactNode;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[72px] flex-1 items-center justify-center overflow-hidden rounded-lg border bg-bg",
        state === "done" && "border-accent-green/30 bg-accent-green/[0.04]",
        state === "active" && "border-amber-400/40 shadow-[0_0_12px_-4px_rgba(251,191,36,0.3)]",
        state === "empty" && "border-border-subtle opacity-40",
        className,
      )}
    >
      {spinning && (
        <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      )}
      {children}
    </div>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div className={cn("mx-1 flex shrink-0 items-center text-lg leading-none", active ? "text-fg-muted" : "text-border-strong")}>
      →
    </div>
  );
}

function ShotRow({ shot, lang }: { shot: ShotFlowItem; lang: string }) {
  const isZh = lang !== "en";
  const ui = getProjectUi(lang);
  const imgLine = (shot.imagePrompt ?? "").replace(/\s+/g, " ").trim();
  const vidLine = (shot.videoPrompt ?? "").replace(/\s+/g, " ").trim();
  const imgShort = imgLine.slice(0, isZh ? 52 : 78) + (imgLine.length > (isZh ? 52 : 78) ? "…" : "");
  const vidShort = vidLine.slice(0, isZh ? 52 : 78) + (vidLine.length > (isZh ? 52 : 78) ? "…" : "");

  const imgState: "empty" | "active" | "done" =
    shot.imageUrl ? "done" : shot.status === "GENERATING_IMAGE" ? "active" : "empty";
  const vidState: "empty" | "active" | "done" =
    shot.videoUrl ? "done" : shot.status === "GENERATING_VIDEO" ? "active" : "empty";
  const dualReady = imgLine.length > 0 && vidLine.length > 0;
  const textState: "empty" | "active" | "done" = dualReady
    ? "done"
    : imgLine || vidLine || shot.status === "PENDING"
      ? "active"
      : "empty";

  return (
    <div className="flex items-stretch gap-0">
      {/* Shot label */}
      <div className={cn("w-14 shrink-0 self-center pr-2 text-right", shot.status === "FAILED" ? "text-accent-red" : "text-fg-muted")}>
        <div className="font-mono text-[10px] font-semibold">
          {isZh ? `场${shot.sceneOrder}` : `S${shot.sceneOrder}`}
          <br />
          {isZh ? `镜${shot.shotOrder}` : `T${shot.shotOrder}`}
        </div>
        <div className={cn("mt-0.5 font-mono text-[9px]", statusColor(shot.status))}>
          {statusLabel(shot.status, lang)}
        </div>
      </div>

      {/* Stage 1: 双提示词 */}
      <StageCell state={textState} className="min-h-[104px] items-stretch justify-start">
        {dualReady || imgLine || vidLine ? (
          <div className="flex h-full flex-col gap-1.5 p-2">
            <div>
              <div className="mb-0.5 font-mono text-[8px] font-semibold uppercase text-accent-cyan">
                ① {ui.progress.flowLabelImagePrompt}
              </div>
              <p className="font-mono text-[9px] leading-snug text-fg-muted break-words line-clamp-3">
                {imgShort || (isZh ? "（空）" : "(empty)")}
              </p>
            </div>
            <div>
              <div className="mb-0.5 font-mono text-[8px] font-semibold uppercase text-accent-purple">
                ② {ui.progress.flowLabelVideoPrompt}
              </div>
              <p className="font-mono text-[9px] leading-snug text-fg-muted break-words line-clamp-3">
                {vidShort || (isZh ? "（空）" : "(empty)")}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-[9px] text-fg-subtle">{isZh ? "待生成" : "Pending"}</span>
        )}
      </StageCell>

      <Arrow active={textState === "done"} />

      {/* Stage 2: 制片板图 */}
      <StageCell state={imgState} spinning={shot.status === "GENERATING_IMAGE"}>
        {shot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.imageUrl} alt="" className="h-full w-full object-cover rounded-lg" />
        ) : (
          <span className="text-[9px] text-fg-subtle">
            {shot.status === "GENERATING_IMAGE" ? (isZh ? "生图中…" : "Generating…") : "—"}
          </span>
        )}
      </StageCell>

      <Arrow active={imgState === "done"} />

      {/* Stage 3: Seedance 镜头视频 */}
      <StageCell state={vidState} spinning={shot.status === "GENERATING_VIDEO"}>
        {shot.videoUrl ? (
          <video
            src={shot.videoUrl}
            className="h-full w-full rounded-lg object-cover"
            muted
            playsInline
            loop
            autoPlay
          />
        ) : (
          <span className="text-[9px] text-fg-subtle">
            {shot.status === "GENERATING_VIDEO" ? (isZh ? "出片中…" : "Rendering…") : "—"}
          </span>
        )}
      </StageCell>

      {shot.errorMsg && (
        <div className="ml-2 self-center font-mono text-[9px] text-accent-red max-w-[80px] break-words">
          {shot.errorMsg.slice(0, 60)}
        </div>
      )}
    </div>
  );
}

/** 按场次分组；每镜「双提示词 → 制片板图 → Seedance 视频」 */
export function ShotFlowGrid({ shots, lang = "zh" }: ShotFlowGridProps) {
  const ui = getProjectUi(lang);
  const isZh = lang !== "en";
  if (shots.length === 0) return null;

  // Group by episode + scene
  const sceneMap = new Map<string, { label: string; shots: ShotFlowItem[] }>();
  for (const s of shots) {
    const key = `${s.episodeNumber}-${s.sceneOrder}`;
    if (!sceneMap.has(key)) {
      sceneMap.set(key, {
        label: isZh
          ? `第 ${s.episodeNumber} 集 · 场次 ${s.sceneOrder}（${s.sceneLocation}）`
          : `Ep${s.episodeNumber} · Scene ${s.sceneOrder} — ${s.sceneLocation}`,
        shots: [],
      });
    }
    sceneMap.get(key)!.shots.push(s);
  }

  const doneCount = shots.filter((s) => s.status === "READY").length;
  const total = shots.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-fg">
          {isZh ? `镜头进度` : `Shot progress`}
        </h2>
        <span className="font-mono text-[11px] text-fg-muted">
          {doneCount}/{total} {isZh ? "完成" : "done"}
        </span>
        {/* Column labels */}
        <div className="ml-auto hidden items-center gap-1 text-[10px] text-fg-subtle sm:flex">
          <span className="w-14" />
          <span className="flex-1 text-center">{ui.shotGrid.colDualPrompt}</span>
          <span className="w-4" />
          <span className="flex-1 text-center">{ui.shotGrid.colPanel}</span>
          <span className="w-4" />
          <span className="flex-1 text-center">{ui.shotGrid.colClip}</span>
        </div>
      </div>

      {/* Scenes */}
      {[...sceneMap.entries()].map(([key, group]) => (
        <div key={key} className="rounded-xl border border-border-subtle bg-bg-elevated/80">
          <div className="border-b border-border-subtle px-4 py-2 font-mono text-[10px] text-fg-muted">
            {group.label}
          </div>
          <div className="space-y-2 p-3">
            {group.shots.map((shot) => (
              <ShotRow key={shot.shotId} shot={shot} lang={lang} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
