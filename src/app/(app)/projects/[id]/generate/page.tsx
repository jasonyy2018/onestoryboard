import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { startGeneration } from "@/app/actions/projects";

export const dynamic = "force-dynamic";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();

  // 如果已经在生成或已完成，直接跳转到进度/结果页
  if (project.status === "GENERATING" || project.status === "PAUSED") {
    redirect(`/projects/${id}/progress`);
  }
  if (project.status === "COMPLETED") {
    redirect(`/projects/${id}/result`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-1 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-purple/10">
            <svg className="h-6 w-6 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{project.title}</h1>
          <p className="text-sm text-fg-muted">
            已就绪 · {project.episodeCount} 集 · 中文
          </p>
        </div>

        {/* Pipeline preview */}
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 space-y-3">
          <div className="font-mono text-[10px] tracking-widest text-fg-subtle uppercase mb-4">
            生成流程
          </div>
          {[
            { icon: "01", label: "剧本解析", desc: "Doubao 2.0 · 拆解场次与角色" },
            { icon: "02", label: "故事板生图", desc: "腾讯 OG Image 2 · 12宫格制片板" },
            { icon: "03", label: "视频生成", desc: "Seedance 2.0 · 15秒镜头 · 含原生音频" },
            { icon: "04", label: "视频合成", desc: "FFmpeg · 按集合并输出 MP4" },
          ].map((step) => (
            <div key={step.icon} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-purple/10 font-mono text-[10px] font-bold text-accent-purple">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{step.label}</div>
                <div className="font-mono text-[10px] text-fg-muted truncate">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Script preview */}
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
          <div className="font-mono text-[10px] tracking-widest text-fg-subtle uppercase mb-2">
            剧本预览
          </div>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-fg-muted">
            {project.rawScript.slice(0, 400)}{project.rawScript.length > 400 ? "\n…" : ""}
          </pre>
        </div>

        {/* CTA */}
        <form action={startGeneration.bind(null, id)}>
          <button
            type="submit"
            className="flex w-full h-12 items-center justify-center gap-2.5 rounded-xl bg-accent-purple text-sm font-bold text-white shadow-lg shadow-accent-purple/25 transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            一键生成短剧
          </button>
        </form>

        <p className="text-center font-mono text-[10px] text-fg-subtle">
          生成完成后自动跳转至结果页 · 可随时查看进度
        </p>
      </div>
    </div>
  );
}
