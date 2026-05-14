import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Box, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function GlobalPropsPage() {
  const projectsWithProps = await db.project.findMany({
    where: {
      scenes: { some: { props: { some: {} } } }
    },
    include: {
      scenes: {
        where: { props: { some: {} } },
        include: { props: true }
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
            <h1 className="text-2xl font-bold tracking-tight">全局道具库</h1>
            <p className="text-fg-muted">跨项目浏览并管理所有剧情道具资产</p>
          </div>
        </header>

        <div className="space-y-12">
          {projectsWithProps.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-card/50 text-fg-muted">
              暂无道具数据
            </div>
          ) : (
            projectsWithProps.map((project) => (
              <section key={project.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-accent-purple">{project.title}</span>
                  </div>
                  <Link 
                    href={`/editor/${project.id}`}
                    className="flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent-purple"
                  >
                    <span>进入编辑器</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {project.scenes.flatMap(s => s.props).map((prop) => (
                    <div 
                      key={prop.id} 
                      className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card transition-all hover:border-accent-purple/30 hover:shadow-lg hover:shadow-accent-purple/5"
                    >
                      <div className="relative aspect-square w-full bg-bg">
                        {prop.refImageUrl ? (
                          <Image
                            src={prop.refImageUrl}
                            alt={prop.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-fg-subtle">
                            <Box className="h-6 w-6 opacity-20" />
                            <span className="text-[10px] uppercase tracking-widest">No Image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="font-medium text-xs truncate">{prop.name}</div>
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
