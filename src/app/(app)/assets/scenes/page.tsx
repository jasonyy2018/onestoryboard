import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Map, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function GlobalScenesPage() {
  const projectsWithScenes = await db.project.findMany({
    where: {
      scenes: { some: {} }
    },
    include: {
      scenes: {
        orderBy: { order: "asc" }
      }
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
            <h1 className="text-2xl font-bold tracking-tight">全局场景库</h1>
            <p className="text-fg-muted">按项目分类管理您的所有拍摄场景</p>
          </div>
        </header>

        <div className="space-y-12">
          {projectsWithScenes.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-card/50 text-fg-muted">
              暂无场景数据
            </div>
          ) : (
            projectsWithScenes.map((project) => (
              <section key={project.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-accent-purple">{project.title}</span>
                    <span className="text-xs text-fg-subtle">({project.scenes.length} 场景)</span>
                  </div>
                  <Link 
                    href={`/editor/${project.id}`}
                    className="flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent-purple"
                  >
                    <span>进入编辑器</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {project.scenes.map((scene) => (
                    <div 
                      key={scene.id} 
                      className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card transition-all hover:border-accent-purple/30 hover:shadow-lg hover:shadow-accent-purple/5"
                    >
                      <div className="relative aspect-video w-full bg-bg">
                        {scene.refImageUrl ? (
                          <Image
                            src={scene.refImageUrl}
                            alt={scene.location}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-fg-subtle">
                            <Map className="h-8 w-8 opacity-20" />
                            <span className="text-[10px] uppercase tracking-widest">No Scene Image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold text-accent-purple uppercase tracking-wider">
                            Scene {scene.order}
                          </div>
                          {scene.timeOfDay && (
                            <div className="text-[10px] font-medium text-fg-subtle uppercase">
                              {scene.timeOfDay}
                            </div>
                          )}
                        </div>
                        <div className="mt-1 font-bold truncate">{scene.location}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
