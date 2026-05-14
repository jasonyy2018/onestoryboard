import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Share2, RefreshCw, Download, Clapperboard, Film, Image as ImageIcon, Package } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import { getProjectUi, projectLocale, projectStatusLabel, shotTypeLabel } from "@/lib/i18n/project-ui";

export type EpisodeFinalRow = { episodeNumber: number; videoUrl: string; durationSec: number };

function parseEpisodeFinals(raw: unknown): EpisodeFinalRow[] | null {
  if (raw == null || !Array.isArray(raw)) return null;
  const out: EpisodeFinalRow[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as EpisodeFinalRow).episodeNumber === "number" &&
      typeof (item as EpisodeFinalRow).videoUrl === "string" &&
      typeof (item as EpisodeFinalRow).durationSec === "number"
    ) {
      out.push(item as EpisodeFinalRow);
    }
  }
  return out.length > 0 ? out : null;
}

export const dynamic = "force-dynamic";

export default async function ResultPage({
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
        include: { shots: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!project) notFound();

  const loc = project.language;
  const ui = getProjectUi(loc);
  const isEn = projectLocale(loc) === "en";

  if (project.status !== "COMPLETED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-8 text-center">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{ui.result.notReadyTitle}</h2>
          <p className="text-sm text-fg-muted">
            {ui.result.notReadyStatus}: {projectStatusLabel(loc, project.status)}
          </p>
          <Link
            href={`/projects/${id}/progress`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-purple px-4 text-sm font-medium text-white"
          >
            {ui.result.viewProgress}
          </Link>
        </div>
      </div>
    );
  }

  const allShots = project.scenes.flatMap((s) => s.shots);
  const episodeMasters = parseEpisodeFinals(
    (project as typeof project & { episodeFinals?: unknown }).episodeFinals,
  );
  const generationDuration =
    project.startedAt && project.completedAt
      ? Math.round((project.completedAt.getTime() - project.startedAt.getTime()) / 1000)
      : null;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex h-15 items-center gap-4 border-b border-border-subtle px-8 py-3">
        <Link href="/projects" className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="h-3.5 w-3.5" /> {ui.result.backProjects}
        </Link>
        <div className="h-5 w-px bg-border-subtle" />
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{project.title}</span>
            <Badge color="green">{ui.result.completed}</Badge>
          </div>
          <div className="font-mono text-[11px] text-fg-muted">
            {generationDuration &&
              `${ui.result.generatedIn} ${formatDuration(generationDuration)}`}{" "}
            · {isEn ? `${allShots.length} ${ui.result.shots}` : `${allShots.length}${ui.result.shots}`} ·{" "}
            {project.duration ? formatDuration(project.duration) : "—"} {ui.result.runtime}
          </div>
        </div>
        <div className="flex-1" />
        <Link
          href={`/projects/${id}/storyboard`}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle px-3 text-xs text-fg-muted hover:border-accent-purple/50 hover:text-accent-purple"
        >
          <Clapperboard className="h-3 w-3" /> {ui.result.storyboard}
        </Link>
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle px-3 text-xs">
          <Share2 className="h-3 w-3 text-fg-muted" /> {ui.result.share}
        </button>
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle px-3 text-xs">
          <RefreshCw className="h-3 w-3 text-fg-muted" /> {ui.result.rerender}
        </button>
        {(project.finalVideoUrl && (!episodeMasters || episodeMasters.length <= 1)) ||
        (episodeMasters && episodeMasters.length > 1) ? (
          <a
            href={
              episodeMasters && episodeMasters.length > 1
                ? episodeMasters[0]!.videoUrl
                : project.finalVideoUrl!
            }
            download
            className="inline-flex h-8 items-center gap-1.5 rounded bg-accent-purple px-3.5 text-xs font-medium text-white"
          >
            <Download className="h-3 w-3" /> {ui.result.downloadMp4}
          </a>
        ) : null}
      </header>

      <div className="flex flex-1 gap-6 overflow-hidden p-8">
        <div className="flex flex-1 flex-col gap-5">
          {episodeMasters && episodeMasters.length > 1 ? (
            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
              <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-medium">{ui.result.episodeExportsTitle}</h2>
                <p className="font-mono text-[10px] text-fg-muted">{ui.result.multiEpisodeHint}</p>
              </header>
              <ul className="grid gap-4 lg:grid-cols-2">
                {episodeMasters.map((ep) => (
                  <li
                    key={ep.episodeNumber}
                    className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {ui.result.episodeVideoTemplate.replace("{n}", String(ep.episodeNumber))}
                      </span>
                      <span className="font-mono text-[10px] text-fg-muted">
                        {formatDuration(ep.durationSec)}
                      </span>
                    </div>
                    <video src={ep.videoUrl} controls className="aspect-video w-full rounded-md bg-black" />
                    <a
                      href={ep.videoUrl}
                      download
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-border-subtle text-xs font-medium hover:border-accent-purple/50"
                    >
                      <Download className="h-3 w-3" /> {ui.result.downloadMp4}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
              {project.finalVideoUrl ? (
                <video
                  src={project.finalVideoUrl}
                  controls
                  poster={project.thumbnailUrl ?? undefined}
                  className="aspect-video w-full bg-black"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-black text-fg-subtle">
                  {ui.result.finalMissing}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
            <header className="mb-3 flex items-center gap-2">
              <Film className="h-3.5 w-3.5 text-accent-cyan" />
              <h2 className="text-sm font-medium">{ui.result.timeline}</h2>
              <div className="flex-1" />
              <span className="font-mono text-[10px] text-fg-subtle">{ui.result.timelineHint}</span>
            </header>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {allShots.map((shot, i) => (
                <div
                  key={shot.id}
                  className="flex min-w-[80px] flex-col gap-1 rounded border border-border-subtle bg-bg-card p-2"
                >
                  <div className="font-mono text-[9px] text-accent-purple">
                    {ui.result.shotN} {i + 1}
                  </div>
                  <div className="font-mono text-[8px] text-fg-muted truncate">{shotTypeLabel(loc, shot.type)}</div>
                  <div className="font-mono text-[8px] text-fg-subtle">{shot.duration}s</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="flex w-[340px] shrink-0 flex-col gap-4 overflow-y-auto">
          <Card title={ui.result.projectInfo}>
            <Row label={ui.result.duration} value={project.duration ? formatDuration(project.duration) : "—"} />
            <Row label={ui.result.resolution} value="1920×1080" />
            <Row label={ui.result.frameRate} value="30 fps" />
            <Row label={ui.result.fileSize} value="—" />
            <Row label={ui.result.cost} value={`$${Number(project.totalCost).toFixed(2)}`} />
          </Card>

          <Card title={ui.result.export}>
            <ExportRow
              icon={<Clapperboard className="h-3.5 w-3.5 text-accent-purple" />}
              label={ui.result.exportMp41080}
              hint={ui.result.exportMp41080Hint}
            />
            <ExportRow
              icon={<Film className="h-3.5 w-3.5 text-accent-cyan" />}
              label={ui.result.exportMp44k}
              hint={ui.result.exportMp44kHint}
              hintColor="cyan"
            />
            <ExportRow
              icon={<ImageIcon className="h-3.5 w-3.5 text-fg-muted" />}
              label={ui.result.exportGif}
              hint={ui.result.exportGifHint}
            />
            <ExportRow
              icon={<Package className="h-3.5 w-3.5 text-fg-muted" />}
              label={ui.result.exportBundle}
              hint={ui.result.exportBundleHint}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="font-mono text-[10px] tracking-widest text-fg-subtle">{title}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between font-mono text-xs">
      <span className="text-fg-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ExportRow({
  icon,
  label,
  hint,
  hintColor,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  hintColor?: "cyan";
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-md border border-border-subtle bg-bg-card px-2.5 py-2 text-left text-xs hover:border-border-strong"
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      <span
        className={`font-mono text-[10px] ${
          hintColor === "cyan" ? "text-accent-cyan" : "text-fg-muted"
        }`}
      >
        {hint}
      </span>
    </button>
  );
}
