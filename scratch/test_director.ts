import "dotenv/config";
import { runParseAndStoryboard } from "../src/lib/orchestrator/director";
import { db } from "../src/lib/db";

async function test() {
  const projectId = "cmp2ncqrk0001eye2t64nbi1i";
  console.log("Starting runParseAndStoryboard for", projectId);
  try {
    const result = await runParseAndStoryboard(projectId);
    console.log("Success:", result);
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    await db.$disconnect();
  }
}

test();
