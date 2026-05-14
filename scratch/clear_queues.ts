import "dotenv/config";
import { createBullConnection } from "../src/lib/queue/connection";
import { QUEUE_NAMES } from "../src/lib/queue/queues";
import { Queue } from "bullmq";

async function clear() {
  const connection = createBullConnection();
  for (const name of Object.values(QUEUE_NAMES)) {
    console.log(`Clearing queue: ${name}`);
    const q = new Queue(name, { connection });
    await q.obliterate({ force: true });
    await q.close();
  }
  await connection.quit();
  console.log("All queues cleared.");
}

clear().catch(console.error);
