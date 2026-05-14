import { db } from "../src/lib/db";

async function checkProjectStatus(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          scenes: true,
          characters: true,
        }
      }
    }
  });

  if (!project) {
    console.log("Project not found");
    return;
  }

  console.log("--- Project Status ---");
  console.log(`ID: ${project.id}`);
  console.log(`Status: ${project.status}`);
  console.log(`Pipeline Stage: ${project.pipelineStage}`);
  console.log(`Scenes Count: ${project._count.scenes}`);
  console.log(`Characters Count: ${project._count.characters}`);
  console.log("----------------------");
  
  const recentEvents = await db.projectEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  
  console.log("--- Recent Events ---");
  recentEvents.forEach(e => console.log(`[${e.createdAt.toISOString()}] ${e.type}: ${e.message}`));
}

const PID = "cmp3m47yk000114fvmlgf8w8v";
checkProjectStatus(PID)
  .catch(console.error)
  .finally(() => process.exit());
