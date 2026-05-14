import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Settings2, Sparkles, FileText, LayoutGrid, RefreshCw, UserCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { ScriptEditor } from "@/components/editor/ScriptEditor";
import { StoryboardPanel } from "@/components/editor/StoryboardPanel";
import { ModelSettings } from "@/components/editor/ModelSettings";
import { AssetsPanel } from "@/components/editor/AssetsPanel";
import { startGeneration, reparseProject } from "@/app/actions/projects";
import { regenerateStructuredPrompts } from "@/app/actions/el-cine";
import { getProjectUi, projectLocale, projectStatusLabel } from "@/lib/i18n/project-ui";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: {
          shots: { orderBy: { order: "asc" } },
          props: true,
        },
      },
      characters: {
        orderBy: { name: "asc" },
      },
    },
  });
  if (!project) notFound();

  const ui = getProjectUi(project.language);
  const loc = project.language;
  const isEn = projectLocale(loc) === "en";
  const totalShots = project.scenes.reduce((sum, s) => sum + s.shots.length, 0);
  const allProps = project.scenes.flatMap((s) => s.props);

  const episodeDisplay = isEn ? `${project.episodeCount} ${ui.editor.episodes}` : `${project.episodeCount}${ui.editor.episodes}`;

  const canRegenerateElCine = project.scenes.length > 0 && project.status !== "GENERATING";
  const regenerateElCineTitle = !canRegenerateElCine
    ? project.scenes.length === 0
      ? ui.editor.regenerateStructuredPromptsNeedScenes
      : ui.editor.regenerateStructuredPromptsWaitGenerating
    : ui.editor.regenerateStructuredPromptsTitle;

  return (
    <div className="flex h-screen bg-bg">
      <aside className="flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-border-subtle bg-bg-elevated py-4">
        <Link href="/projects" className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-purple shadow-lg shadow-accent-purple/20">
          <Sparkles className="h-[18px] w-[18px] text-white" />
        </Link>
        <div className="my-2 h-px w-8 bg-border-subtle" />

        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-card text-accent-purple">
          <FileText className="h-[18px] w-[18px]" />
        </button>

        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-hover">
          <LayoutGrid className="h-[18px] w-[18px]" />
        </button>

        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-hover">
          <UserCircle2 className="h-[18px] w-[18px]" />
        </button>

        <div className="flex-1" />

        <ModelSettings
          projectId={id}
          currentConfig={project.modelConfig as any}
          episodeCount={project.episodeCount}
          language={project.language}
          trigger={
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-hover">
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
          }
        />
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex min-h-15 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-6 py-3">
          <Link href="/projects" className="flex h-8 w-8 items-center justify-center rounded text-fg-muted hover:text-fg">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1 font-mono text-[10px] text-fg-subtle">
              <span>{ui.editor.breadcrumbProjects}</span>
              <span>/</span>
              <span>{project.id.slice(0, 10)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{project.title}</span>
              <div className="flex items-center gap-1.5">
                <Badge color={project.status === "DRAFT" ? "cyan" : "amber"}>
                  {projectStatusLabel(loc, project.status)}
                </Badge>
                <Badge color="purple">{episodeDisplay}</Badge>
                <Badge color="cyan">{isEn ? ui.modelSettings.langEn : ui.modelSettings.langZh}</Badge>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-fg-muted">
            <Check className="h-3 w-3 text-accent-green" />
            {ui.editor.saved}
          </div>
          <ModelSettings
            projectId={id}
            currentConfig={project.modelConfig as any}
            episodeCount={project.episodeCount}
            language={project.language}
          />
          <form action={reparseProject.bind(null, id)} className="mr-1">
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-3 text-xs font-medium text-fg-muted hover:bg-bg-hover hover:text-fg"
            >
              <RefreshCw className="h-3 w-3" /> {ui.editor.reparseScript}
            </button>
          </form>
          <form action={regenerateStructuredPrompts.bind(null, id)} className="mr-1 shrink-0" title={regenerateElCineTitle}>
            <button
              type="submit"
              disabled={!canRegenerateElCine}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-3 text-xs font-medium text-fg-muted hover:bg-bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-45"
            >
              <LayoutGrid className="h-3 w-3 shrink-0" /> {ui.editor.regenerateStructuredPrompts}
            </button>
          </form>
          <form action={startGeneration.bind(null, id)}>
            <button
              type="submit"
              disabled={project.status === "GENERATING"}
              className="inline-flex h-8 items-center gap-1.5 rounded bg-accent-purple px-3.5 text-xs font-medium text-white disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" /> {ui.editor.generateVideo}
            </button>
          </form>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-[480px] shrink-0 flex-col border-r border-border-subtle">
            <div className="flex h-11 items-center gap-2 border-b border-border-subtle px-5">
              <FileText className="h-3.5 w-3.5 text-accent-purple" />
              <span className="text-sm font-medium">{ui.editor.scriptEditorTitle}</span>
              <span className="font-mono text-xs text-fg-subtle">·</span>
              <span className="font-mono text-xs text-fg-muted">
                {project.scenes.length} {ui.editor.scenesCount}
              </span>
            </div>
            <ScriptEditor projectId={project.id} initialValue={project.rawScript} lang={loc} />
          </div>

          <div className="flex flex-1 flex-col bg-bg">
            <div className="flex h-11 items-center gap-2 border-b border-border-subtle px-5">
              <LayoutGrid className="h-3.5 w-3.5 text-accent-purple" />
              <span className="text-sm font-medium">{ui.editor.storyboardTitle}</span>
              <span className="font-mono text-xs text-fg-subtle">·</span>
              <span className="font-mono text-xs text-fg-muted">
                {totalShots} {ui.editor.shotsCount}
              </span>
              {totalShots > 0 && (
                <>
                  <span className="text-fg-subtle">·</span>
                  <Link
                    href={`/projects/${id}/storyboard`}
                    className="text-xs font-medium text-accent-purple hover:underline"
                  >
                    {ui.editor.openStoryboard}
                  </Link>
                </>
              )}
            </div>
            <StoryboardPanel scenes={JSON.parse(JSON.stringify(project.scenes))} lang={loc} />
          </div>

          <div className="w-80 border-l border-border-subtle">
            <AssetsPanel
              projectId={id}
              characters={JSON.parse(JSON.stringify(project.characters))}
              scenes={JSON.parse(JSON.stringify(project.scenes))}
              props={JSON.parse(JSON.stringify(allProps))}
              lang={loc}
              pipelineStage={project.pipelineStage}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
