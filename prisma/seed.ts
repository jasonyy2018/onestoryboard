import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Production seed: no demo data.
  // The system uses a single shared user created on first project creation.
  console.log("✅ Seed complete (production mode — no demo data).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
