import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clapperboard, LayoutGrid } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { StoryboardRichView } from "@/components/pipeline/StoryboardRichView";
import { buildStoryboardRows } from "@/components/pipeline/storyboard-types";
import { getProjectUi, projectStatusLabel } from "@/lib/i18n/project-ui";
import { regenerateStructuredPrompts } from "@/app/actions/ecp";

export const dynamic = "force-dynamic";

export default async function ProjectStoryboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      language: true,
      scenes: {
        orderBy: [{ episodeNumber: "asc" }, { order: "asc" }],
        include: {
          shots: {
            orderBy: { order: "asc" },
            include: {
              characters: {
                include: { character: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const rows = buildStoryboardRows(project.scenes as any);
  const ui = getProjectUi(project.language);
  const loc = project.language;

  const canRegenerateEcp = project.scenes.length > 0 && project.status !== "GENERATING";
  const regenerateEcpTitle = !canRegenerateEcp
    ? project.scenes.length === 0
      ? ui.editor.regenerateStructuredPromptsNeedScenes
      : ui.editor.regenerateStructuredPromptsWaitGenerating
    : ui.editor.regenerateStructuredPromptsTitle;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border-subtle bg-bg/95 px-4 py-3 backdrop-blur sm:px-8">
        <Link
          href={`/editor/${id}`}
          className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {ui.storyboardPage.backEditor}
        </Link>
        <span className="text-fg-subtle">|</span>
        <Link
          href={`/projects/${id}/progress`}
          className="text-sm text-fg-muted hover:text-fg"
        >
          {ui.storyboardPage.progress}
        </Link>
        <span className="text-fg-subtle">|</span>
        <Link href={`/projects/${id}/result`} className="text-sm text-fg-muted hover:text-fg">
          {ui.storyboardPage.result}
        </Link>
        <span className="text-fg-subtle">|</span>
        <form action={regenerateStructuredPrompts.bind(null, id)} className="inline shrink-0" title={regenerateEcpTitle}>
          <button
            type="submit"
            disabled={!canRegenerateEcp}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-45 sm:px-3"
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{ui.editor.regenerateStructuredPrompts}</span>
            <span className="sm:hidden">ECP</span>
          </button>
        </form>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Clapperboard className="h-4 w-4 text-accent-purple" />
          <span className="font-semibold">{project.title}</span>
          <Badge color={project.status === "GENERATING" ? "amber" : "neutral"}>
            {projectStatusLabel(loc, project.status)}
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <StoryboardRichView projectTitle={project.title} rows={rows} lang={loc} />
      </div>
    </div>
  );
}
