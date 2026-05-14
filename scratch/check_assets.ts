import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const characters = await prisma.character.findMany({
    take: 5,
    select: {
      name: true,
      refImageUrl: true,
      personality: true,
      visualPrompt: true,
    }
  });

  console.log("Characters:");
  console.log(JSON.stringify(characters, null, 2));

  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: {
      id: true,
      title: true,
      pipelineStage: true,
    }
  });
  console.log("Latest Project:");
  console.log(JSON.stringify(projects, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
