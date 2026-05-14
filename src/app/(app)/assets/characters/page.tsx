import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { CharacterGrid } from "@/components/assets/CharacterGrid";

export const dynamic = "force-dynamic";

export default async function GlobalCharactersPage() {
  const projectsWithCharacters = await db.project.findMany({
    where: {
      characters: { some: {} }
    },
    include: {
      characters: true
    },
    orderBy: { updatedAt: "desc" }
  });

  const projectCount = await db.project.count();

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar projectCount={projectCount} />
      
      <main className="flex-1 overflow-y-auto bg-bg p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">全局角色库</h1>
            <p className="text-fg-muted">跨项目查看并管理您的所有角色资产</p>
          </div>
        </header>

        <div className="space-y-12">
          {projectsWithCharacters.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-card/50 text-fg-muted">
              暂无项目角色数据
            </div>
          ) : (
            projectsWithCharacters.map((project) => (
              <section key={project.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-accent-purple">{project.title}</span>
                    <span className="text-xs text-fg-subtle">({project.characters.length} 角色)</span>
                  </div>
                  <Link 
                    href={`/editor/${project.id}`}
                    className="flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent-purple"
                  >
                    <span>进入编辑器</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <CharacterGrid characters={project.characters} />
              </section>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
