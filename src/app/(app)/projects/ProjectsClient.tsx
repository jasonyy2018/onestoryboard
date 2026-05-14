"use client";

import Link from "next/link";
import { Search, Bell, Play, BookOpen, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { Project, ProjectStatus } from "@prisma/client";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { deleteProject } from "@/app/actions/projects";

export function ProjectsClient({
  projects,
  counts,
}: {
  projects: (Project & { _count: { scenes: number } })[];
  counts: Record<ProjectStatus, number>;
}) {
  const { t } = useTranslation();

  return (
    <main className="flex flex-1 flex-col">
      {/* Topbar */}
      <header className="flex h-16 items-center gap-4 border-b border-border-subtle px-8">
        <div>
          <h1 className="text-lg font-semibold">{t.projects.title}</h1>
          <p className="font-mono text-[11px] text-fg-muted">
            {projects.length} {t.sidebar.projects} · {counts.GENERATING} {t.projects.status.GENERATING}
          </p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            placeholder={t.projects.searchPlaceholder}
            className="h-9 w-72 rounded-md border border-border-subtle bg-bg-elevated pl-9 pr-16 text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent-purple"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-bg-card px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
            ⌘K
          </kbd>
        </div>
        <Bell className="h-[18px] w-[18px] text-fg-muted" />
      </header>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-8">
        {/* Hero */}
        <section className="flex items-center gap-6 rounded-xl border border-border-subtle bg-bg-elevated p-6">
          <div className="flex-1 space-y-2">
            <Badge color="cyan">NEW · Multi-model orchestrator v2</Badge>
            <h2 className="text-2xl font-semibold">Turn your script into video.</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">
              Paste a screenplay, the Director Agent extracts scenes, characters & shots,
              then orchestrates GPT-5, Flux, Runway and ElevenLabs in parallel.
            </p>
            <div className="flex gap-2 pt-2">
              <Link
                href="/projects/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-purple px-4 text-sm font-medium text-white"
              >
                <Play className="h-3.5 w-3.5" /> {t.projects.newProject}
              </Link>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong px-4 text-sm">
                <BookOpen className="h-3.5 w-3.5" /> View Templates
              </button>
            </div>
          </div>
          <div className="w-72 shrink-0 rounded-md border border-border-subtle bg-bg-card p-4">
            <div className="font-mono text-[10px] tracking-widest text-fg-subtle">
              GENERATION CREDITS
            </div>
            <div className="mt-1 flex items-end gap-1.5">
              <span className="text-3xl font-semibold">2,840</span>
              <span className="font-mono text-xs text-fg-subtle">/ 5,000</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
              <div className="h-full w-[57%] rounded-full bg-accent-cyan" />
            </div>
            <div className="mt-2 font-mono text-[10px] text-fg-subtle">Resets in 18 days</div>
          </div>
        </section>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <FilterChip active count={projects.length}>All</FilterChip>
          <FilterChip dot="amber" count={counts.GENERATING}>{t.projects.status.GENERATING}</FilterChip>
          <FilterChip dot="green" count={counts.COMPLETED}>{t.projects.status.COMPLETED}</FilterChip>
          <FilterChip dot="red" count={counts.FAILED}>{t.projects.status.FAILED}</FilterChip>
          <div className="flex-1" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} sceneCount={p._count.scenes} t={t} />
          ))}
          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-16 text-center">
              <FileText className="h-8 w-8 text-fg-subtle" />
              <h3 className="font-medium">{t.projects.emptyState}</h3>
              <Link
                href="/projects/new"
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-purple px-4 text-sm font-medium text-white"
              >
                <Play className="h-3.5 w-3.5" /> {t.projects.newProject}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function FilterChip({
  children,
  count,
  dot,
  active,
}: {
  children: React.ReactNode;
  count: number;
  dot?: "amber" | "green" | "red";
  active?: boolean;
}) {
  return (
    <button
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs ${
        active ? "border-accent-purple bg-bg-card text-fg" : "border-border-subtle text-fg-muted"
      }`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            dot === "amber" ? "bg-accent-amber" : dot === "green" ? "bg-accent-green" : "bg-accent-red"
          }`}
        />
      )}
      <span>{children}</span>
      <span className="font-mono text-[10px] text-fg-subtle">{count}</span>
    </button>
  );
}

function ProjectCard({ project, sceneCount, t }: { project: Project; sceneCount: number, t: any }) {
  const href =
    project.status === "DRAFT"
      ? `/editor/${project.id}`
      : project.status === "GENERATING"
        ? `/projects/${project.id}/progress`
        : `/projects/${project.id}/result`;

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated transition-colors hover:border-border-strong"
    >
      <div className="relative h-44 bg-bg-card">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-subtle">
            <FileText className="h-8 w-8" />
            <span className="font-mono text-[10px] tracking-widest">DRAFT · script only</span>
          </div>
        )}
        <div className="absolute bottom-2.5 left-2.5">
          <StatusBadge status={project.status} t={t} />
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm("确定要删除此项目吗？")) deleteProject(project.id);
          }}
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="truncate font-semibold">{project.title}</h3>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-fg-muted">
          <span>{sceneCount} {t.projects.scenes}</span>
          <span className="text-fg-subtle">·</span>
          <span>{project.duration ? formatDuration(project.duration) : "Not generated"}</span>
          <span className="text-fg-subtle">·</span>
          <RelativeTime date={project.updatedAt} />
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status, t }: { status: ProjectStatus, t: any }) {
  switch (status) {
    case "GENERATING":
      return <Badge color="amber">{t.projects.status.GENERATING}</Badge>;
    case "COMPLETED":
      return <Badge color="green">{t.projects.status.COMPLETED}</Badge>;
    case "FAILED":
      return <Badge color="red">{t.projects.status.FAILED}</Badge>;
    default:
      return <Badge>{t.projects.status.DRAFT}</Badge>;
  }
}
