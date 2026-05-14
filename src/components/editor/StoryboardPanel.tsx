import type { Scene, Shot } from "@prisma/client";
import { Check, Clock3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getProjectUi, shotTypeLabel } from "@/lib/i18n/project-ui";

type SceneWithShots = Scene & { shots: Shot[] };

export function StoryboardPanel({ scenes, lang }: { scenes: SceneWithShots[]; lang: string }) {
  const ui = getProjectUi(lang);

  if (scenes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="space-y-2">
          <div className="font-mono text-xs tracking-widest text-fg-subtle">{ui.storyboardPanel.emptyTitle}</div>
          <p className="text-sm text-fg-muted">{ui.storyboardPanel.emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-6">
      {scenes.map((scene) => {
        const ready = scene.shots.filter((s) => s.status === "READY").length;
        const total = scene.shots.length;
        const allDone = ready === total && total > 0;
        return (
          <div key={scene.id} className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-accent-purple">
                {scene.order.toString().padStart(2, "0")}
              </span>
              <span className="text-sm font-medium">
                {scene.location} {scene.timeOfDay && `— ${scene.timeOfDay}`}
              </span>
              <Badge color={allDone ? "green" : total === 0 ? "neutral" : "amber"}>
                {total === 0
                  ? ui.storyboardPanel.pending
                  : allDone
                    ? `${total}/${total} ${ui.storyboardPanel.allGenerated}`
                    : `${ui.storyboardPanel.generating} ${ready}/${total}`}
              </Badge>
              <div className="flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {scene.shots.map((shot) => (
                <ShotCard key={shot.id} shot={shot} lang={lang} />
              ))}
              {scene.shots.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-border-strong p-4 text-center font-mono text-xs text-fg-subtle">
                  {ui.storyboardPanel.notGenerated}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShotCard({ shot, lang }: { shot: Shot; lang: string }) {
  const ui = getProjectUi(lang);
  const borderClass =
    shot.status === "READY"
      ? "border-accent-green/50"
      : shot.status === "FAILED"
        ? "border-accent-red/50"
        : shot.status === "GENERATING_IMAGE" || shot.status === "GENERATING_VIDEO"
          ? "border-accent-amber/50"
          : "border-border-subtle";

  return (
    <div className={`overflow-hidden rounded-lg border bg-bg-card ${borderClass}`}>
      <div className="relative h-28 bg-bg">
        {shot.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : shot.status === "GENERATING_IMAGE" || shot.status === "GENERATING_VIDEO" ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-fg-muted">
            <Loader2 className="h-5 w-5 animate-spin text-accent-amber" />
            <span className="font-mono text-[9px]">{ui.storyboardPanel.generatingShort}</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-fg-subtle">
            <Clock3 className="h-4 w-4" />
            <span className="font-mono text-[9px] tracking-widest">{ui.storyboardPanel.queued}</span>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9px]">
          {shot.status === "READY" && <Check className="h-2.5 w-2.5 text-accent-green" />}
          {`${shot.id.slice(-3)}`}
        </div>
      </div>
      <div className="space-y-1 p-2.5">
        <div className="truncate text-[11px] font-medium">{shotTypeLabel(lang, shot.type)}</div>
        <div className="font-mono text-[9px] text-fg-subtle">
          {shot.duration}s {shot.cameraMove && `· ${shot.cameraMove}`}
        </div>
      </div>
    </div>
  );
}
