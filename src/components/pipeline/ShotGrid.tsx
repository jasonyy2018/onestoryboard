import type { Scene, Shot, ShotStatus } from "@prisma/client";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getProjectUi } from "@/lib/i18n/project-ui";

type SceneWithShots = Scene & { shots: Shot[] };

export function ShotGrid({ scenes, lang }: { scenes: SceneWithShots[]; lang: string }) {
  const ui = getProjectUi(lang);
  const allShots = scenes.flatMap((s) => s.shots.map((sh) => ({ ...sh, sceneOrder: s.order })));
  const active = allShots.filter(
    (s) =>
      s.status === "GENERATING_IMAGE" ||
      s.status === "GENERATING_VIDEO" ||
      s.status === "IMAGE_READY",
  ).length;
  const done = allShots.filter((s) => s.status === "READY").length;
  const queued = allShots.filter((s) => s.status === "PENDING" || s.status === "FAILED").length;

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-elevated p-6">
      <header className="mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent-cyan" />
        <h2 className="text-sm font-semibold">{ui.shotGrid.title}</h2>
        <div className="flex-1" />
        <Badge color="amber">
          {active} {ui.shotGrid.active}
        </Badge>
        <Badge color="green">
          {done} {ui.shotGrid.done}
        </Badge>
        <Badge color="neutral">
          {queued} {ui.shotGrid.queued}
        </Badge>
      </header>

      <div className="space-y-1.5">
        <div className="font-mono text-[10px] tracking-widest text-fg-subtle">{ui.shotGrid.subtitle}</div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {allShots.map((shot) => (
            <ShotCell key={shot.id} shot={shot} cellLabels={ui.shotGrid.cell} />
          ))}
          {allShots.length === 0 &&
            Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-md border border-border-subtle bg-bg-card"
              />
            ))}
        </div>
      </div>
    </section>
  );
}

function ShotCell({
  shot,
  cellLabels,
}: {
  shot: Shot & { sceneOrder: number };
  cellLabels: Record<string, string>;
}) {
  const { borderClass, accent, label } = stylesFor(shot.status, cellLabels);
  return (
    <div
      className={`flex h-14 flex-col gap-1 rounded-md border bg-bg-card px-2 py-1.5 ${borderClass}`}
    >
      <div className={`font-mono text-[9px] ${accent}`}>
        {shot.sceneOrder}.{shot.order}
      </div>
      <div className="font-mono text-[8px] text-fg-muted">{label}</div>
      <div className="mt-auto h-0.5 rounded-full bg-bg">
        <div className={`h-full rounded-full ${progressColor(shot.status)}`} style={{ width: `${progressWidth(shot.status)}%` }} />
      </div>
    </div>
  );
}

function stylesFor(status: ShotStatus, cellLabels: Record<string, string>) {
  const label = cellLabels[status] ?? status;
  switch (status) {
    case "READY":
      return { borderClass: "border-accent-green/60", accent: "text-accent-green", label };
    case "GENERATING_IMAGE":
      return { borderClass: "border-accent-amber/60", accent: "text-accent-amber", label };
    case "GENERATING_VIDEO":
      return { borderClass: "border-accent-amber/60", accent: "text-accent-amber", label };
    case "IMAGE_READY":
      return { borderClass: "border-accent-cyan/60", accent: "text-accent-cyan", label };
    case "FAILED":
      return { borderClass: "border-accent-red/60", accent: "text-accent-red", label };
    default:
      return { borderClass: "border-border-strong", accent: "text-fg-muted", label };
  }
}

function progressColor(status: ShotStatus) {
  if (status === "READY") return "bg-accent-green";
  if (status === "FAILED") return "bg-accent-red";
  if (status === "GENERATING_IMAGE" || status === "GENERATING_VIDEO") return "bg-accent-amber";
  return "bg-border-strong";
}

function progressWidth(status: ShotStatus) {
  if (status === "READY") return 100;
  if (status === "GENERATING_VIDEO") return 70;
  if (status === "IMAGE_READY") return 50;
  if (status === "GENERATING_IMAGE") return 25;
  return 5;
}
