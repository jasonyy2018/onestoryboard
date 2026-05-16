import Link from "next/link";
import { Film, Plus, Play } from "lucide-react";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/Badge";
import { RelativeTime } from "@/components/ui/RelativeTime";

export const dynamic = "force-dynamic";

export default async function SeriesListPage() {
  const allSeries = await db.series.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { episodes: true, characters: true } },
      episodes: {
        select: { status: true, duration: true },
      },
    },
  });

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="flex h-16 items-center gap-4 border-b border-border-subtle px-8">
          <div>
            <h1 className="text-lg font-semibold">剧集系列</h1>
            <p className="font-mono text-[11px] text-fg-muted">{allSeries.length} 个系列</p>
          </div>
          <div className="flex-1" />
          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-purple px-4 text-sm font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 新建系列
          </Link>
        </header>

        <div className="p-8">
          {allSeries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong p-16 text-center">
              <Film className="h-10 w-10 text-fg-subtle" />
              <h3 className="font-medium">暂无剧集系列</h3>
              <p className="text-sm text-fg-muted">在新建项目时选择「连载剧集」或「整部导入」即可创建系列</p>
              <Link
                href="/projects/new"
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-purple px-4 text-sm font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" /> 新建系列
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allSeries.map((s) => {
                const totalDuration = s.episodes.reduce((sum, e) => sum + (e.duration ?? 0), 0);
                const completedEps = s.episodes.filter((e) => e.status === "COMPLETED").length;
                const generatingEps = s.episodes.filter((e) => e.status === "GENERATING").length;
                return (
                  <Link
                    key={s.id}
                    href={`/series/${s.id}`}
                    className="group rounded-xl border border-border-subtle bg-bg-elevated p-5 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-amber/10">
                        <Film className="h-5 w-5 text-accent-amber" />
                      </div>
                      <Badge color={s.mode === "SERIAL" ? "cyan" : "amber"}>
                        {s.mode === "SERIAL" ? "连载" : "整部"}
                      </Badge>
                    </div>
                    <h3 className="mt-3 font-semibold">{s.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-muted">
                      <span>{s._count.episodes} 集</span>
                      <span className="text-fg-subtle">·</span>
                      <span className="text-accent-green">{completedEps} 完成</span>
                      {generatingEps > 0 && (
                        <>
                          <span className="text-fg-subtle">·</span>
                          <span className="text-accent-amber">{generatingEps} 生成中</span>
                        </>
                      )}
                      <span className="text-fg-subtle">·</span>
                      <span>{s._count.characters} 角色</span>
                      {totalDuration > 0 && (
                        <>
                          <span className="text-fg-subtle">·</span>
                          <span>{Math.floor(totalDuration / 60)}m{totalDuration % 60}s</span>
                        </>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <RelativeTime date={s.updatedAt} className="font-mono text-[10px] text-fg-subtle" />
                      <span className="inline-flex items-center gap-1 rounded-md bg-bg-card px-2.5 py-1 text-xs text-fg-muted group-hover:text-accent-purple">
                        <Play className="h-3 w-3" /> 查看
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
