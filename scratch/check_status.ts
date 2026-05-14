import { db } from "../src/lib/db";
import { queues } from "../src/lib/queue/queues";

async function checkStatus() {
  console.log("Checking Database...");
  const generatingProjects = await db.project.count({
    where: { status: "GENERATING" }
  });
  console.log(`Active Projects: ${generatingProjects}`);

  const activeShots = await db.shot.count({
    where: { status: { in: ["GENERATING_IMAGE", "GENERATING_VIDEO", "PENDING"] } }
  });
  console.log(`Active/Pending Shots: ${activeShots}`);

  console.log("\nChecking BullMQ Queues...");
  for (const [name, queue] of Object.entries(queues)) {
    const active = await queue.getActiveCount();
    const waiting = await queue.getWaitingCount();
    const delayed = await queue.getDelayedCount();
    console.log(`Queue [${name}]: ${active} active, ${waiting} waiting, ${delayed} delayed`);
  }

  process.exit(0);
}

checkStatus().catch(console.error);
