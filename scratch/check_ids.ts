import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projectId = "cmp3nxitv000113h3l8lc1ecu";
  const characters = await prisma.character.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
    }
  });

  console.log(`Characters for ${projectId}:`);
  console.log(JSON.stringify(characters, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
