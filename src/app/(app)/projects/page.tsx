import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { DatabaseUnavailableNotice } from "@/components/system/DatabaseUnavailableNotice";
import { isPrismaDbUnreachable } from "@/lib/is-db-unreachable";
import type { ProjectStatus } from "@prisma/client";
import { ProjectsClient } from "./ProjectsClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let projects;
  try {
    projects = await db.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 24,
      include: { _count: { select: { scenes: true } } },
    });
  } catch (err) {
    if (!isPrismaDbUnreachable(err)) throw err;
    return (
      <div className="flex h-screen bg-bg">
        <Sidebar projectCount={0} />
        <DatabaseUnavailableNotice />
      </div>
    );
  }

  const counts = projects.reduce<Record<ProjectStatus, number>>(
    (acc, p) => {
      acc[p.status]++;
      return acc;
    },
    { DRAFT: 0, GENERATING: 0, PAUSED: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0 },
  );

  const serializedProjects = projects.map((p) => ({
    ...p,
    totalCost: p.totalCost ? p.totalCost.toNumber() : null,
  }));

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar projectCount={projects.length} />
      <ProjectsClient projects={serializedProjects as any} counts={counts} />
    </div>
  );
}
