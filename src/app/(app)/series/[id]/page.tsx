import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Plus, Film, CheckCircle2, Clock, AlertCircle, Loader2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { AppendEpisodeDialog } from "@/components/series/AppendEpisodeDialog";
import type { ProjectStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const series = await db.series.findUnique({
    where: { id },
    include: {
      episodes: {
        orderBy: { seriesEpisodeNumber: "asc" },
        select: {
          id: true,
          title: true,
          seriesEpisodeNumber: true,
          status: true,
          pipelineStage: true,
          duration: true,
          thumbnailUrl: true,
          finalVideoUrl: true,
          totalCost: true,
          completedAt: true,
          updatedAt: true,
          errorMessage: true,
        },
      },
      characters: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, refImageUrl: true, volcengineStatus: true },
      },
    },
  });

  if (!series) notFound();

  const isZh = series.language === "zh";
  const totalEpisodes = series.episodes.length;
  const completedCount = series.episodes.filter((e) => e.status === "COMPLETED").length;
  const generatingCount = series.episodes.filter((e) => e.status === "GENERATING").length;
  const totalDuration = series.episodes.reduce((s, e) => s + (e.duration ?? 0), 0);
  const totalCost = series.episodes.reduce((s, e) => s + Number(e.totalCost ?? 0), 0);

  const labels = {
    back: isZh ? "返回项目列表" : "Back to Projects",
    series: isZh ? "剧集系列" : "Series",
    mode: series.mode === "FULL"
      ? (isZh ? "整部导入" : "Full Import")
      : (isZh ? "连载追加" : "Serial"),
    episodes: isZh ? "集" : "ep",
    completed: isZh ? "已完成" : "completed",
    generating: isZh ? "生成中" : "generating",
    totalDuration: isZh ? "总时长" : "Total Duration",
    totalCost: isZh ? "总花费" : "Total Cost",
    characterPool: isZh ? "全剧角色池" : "Character Pool",
    appendEpisode: isZh ? "追加新集" : "Append Episode",
    noEpisodes: isZh ? "暂无集数" : "No episodes yet",
    epTitle: (n: number) => isZh ? `第 ${n} 集` : `Episode ${n}`,
    viewProgress: isZh ? "查看进度" : "View Progress",
    viewResult: isZh ? "查看成片" : "View Result",
    editEpisode: isZh ? "编辑" : "Edit",
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border-subtle bg-bg/95 px-6 backdrop-blur">
        <Link
          href="/projects"
          className="flex h-8 w-8 items-center justify-center rounded text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-accent-purple" />
          <span className="font-semibold">{series.title}</span>
          <Badge color="purple">{labels.series}</Badge>
          <Badge color={series.mode === "SERIAL" ? "cyan" : "amber"}>{labels.mode}</Badge>
        </div>
        <div className="flex-1" />
        {/* 连载模式才显示追加集 */}
        {series.mode === "SERIAL" && (
          <AppendEpisodeDialog seriesId={series.id} language={series.language} />
        )}
      </header>

      <div className="mx-auto max-w-6xl space-y-8 p-8">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={isZh ? "总集数" : "Episodes"} value={`${totalEpisodes}`} />
          <StatCard label={labels.completed} value={`${completedCount}`} accent="green" />
          <StatCard label={labels.totalDuration} value={totalDuration ? formatDuration(totalDuration) : "—"} />
          <StatCard label={labels.totalCost} value={totalCost > 0 ? `$${totalCost.toFixed(2)}` : "—"} />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Episodes list */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{isZh ? "各集状态" : "Episodes"}</h2>
              {generatingCount > 0 && (
                <span className="flex items-center gap-1 font-mono text-[11px] text-accent-amber">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {generatingCount} {isZh ? "集生成中" : "generating"}
                </span>
              )}
            </div>

            {series.episodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-12 text-center text-fg-muted">
                <Film className="h-8 w-8 text-fg-subtle" />
                <p className="text-sm">{labels.noEpisodes}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {series.episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    ep={ep}
                    labels={labels}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Character pool sidebar */}
          <aside className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent-purple" />
              <h2 className="font-semibold">{labels.characterPool}</h2>
              <span className="font-mono text-xs text-fg-muted">{series.characters.length}</span>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
              {series.characters.length === 0 ? (
                <p className="text-center text-sm text-fg-muted">
                  {isZh ? "第 1 集生成后自动填充" : "Auto-populated after Episode 1"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {series.characters.map((c) => (
                    <li key={c.id} className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-card">
                        {c.refImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.refImageUrl} alt={c.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-fg-subtle">
                            ?
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="font-mono text-[10px] text-fg-muted">
                          {c.volcengineStatus === "Active"
                            ? (isZh ? "✓ 已入库" : "✓ Active")
                            : c.refImageUrl
                              ? (isZh ? "待审核" : "Pending")
                              : (isZh ? "未生成" : "No ref")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function EpisodeRow({
  ep,
  labels,
}: {
  ep: {
    id: string;
    title: string;
    seriesEpisodeNumber: number | null;
    status: ProjectStatus;
    pipelineStage: string;
    duration: number | null;
    thumbnailUrl: string | null;
    finalVideoUrl: string | null;
    totalCost: any;
    completedAt: Date | null;
    updatedAt: Date;
    errorMessage: string | null;
  };
  labels: any;
}) {
  const href =
    ep.status === "DRAFT" || ep.status === "FAILED"
      ? `/editor/${ep.id}`
      : ep.status === "GENERATING" || ep.status === "PAUSED"
        ? `/projects/${ep.id}/progress`
        : `/projects/${ep.id}/result`;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-bg-elevated p-4 transition-colors hover:border-border-strong">
      {/* Thumbnail */}
      <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-bg-card">
        {ep.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ep.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-5 w-5 text-fg-subtle" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-fg-muted">
            {labels.epTitle(ep.seriesEpisodeNumber ?? "?")}
          </span>
          <EpisodeStatusBadge status={ep.status} />
        </div>
        <p className="truncate text-sm font-medium">{ep.title}</p>
        <div className="flex items-center gap-3 font-mono text-[10px] text-fg-muted">
          {ep.duration && <span>{formatDuration(ep.duration)}</span>}
          {Number(ep.totalCost) > 0 && <span>${Number(ep.totalCost).toFixed(2)}</span>}
          <RelativeTime date={ep.updatedAt} />
        </div>
        {ep.errorMessage && (
          <p className="truncate font-mono text-[10px] text-accent-red">{ep.errorMessage}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <Link
          href={href}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-accent-purple px-3 text-xs font-medium text-white"
        >
          <Play className="h-3 w-3" />
          {ep.status === "COMPLETED" ? labels.viewResult : ep.status === "GENERATING" ? labels.viewProgress : labels.editEpisode}
        </Link>
      </div>
    </div>
  );
}

function EpisodeStatusBadge({ status }: { status: ProjectStatus }) {
  switch (status) {
    case "COMPLETED": return <Badge color="green"><CheckCircle2 className="mr-1 h-2.5 w-2.5" />完成</Badge>;
    case "GENERATING": return <Badge color="amber"><Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />生成中</Badge>;
    case "FAILED": return <Badge color="red"><AlertCircle className="mr-1 h-2.5 w-2.5" />失败</Badge>;
    case "PAUSED": return <Badge color="cyan"><Clock className="mr-1 h-2.5 w-2.5" />暂停</Badge>;
    default: return <Badge>草稿</Badge>;
  }
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "green" }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <p className="font-mono text-[10px] text-fg-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent === "green" ? "text-accent-green" : ""}`}>
        {value}
      </p>
    </div>
  );
}
