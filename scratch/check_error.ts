import { db } from "../src/lib/db";

async function checkProjectError(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { errorMessage: true, status: true, pipelineStage: true }
  });

  console.log(JSON.stringify(project, null, 2));
}

const PID = "cmp3m47yk000114fvmlgf8w8v";
checkProjectError(PID)
  .catch(console.error)
  .finally(() => process.exit());
