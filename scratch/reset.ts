import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const projectId = "cmp2ncqrk0001eye2t64nbi1i";
  await prisma.project.update({
    where: { id: projectId },
    data: { 
      status: "CANCELLED", 
      pipelineStage: "IDLE" 
    }
  });
  console.log("Project reset to CANCELLED");
}

main().catch(console.error).finally(() => prisma.$disconnect());
