import { pollTencentVODTask } from "./src/lib/ai/image";

async function run() {
  try {
    const taskId = '1426771765-AigcImageTask-a84b419d465c6fcb43604e8560ee915ct';
    console.log("Polling task:", taskId);
    const result = await pollTencentVODTask(taskId);
    console.log("Result:", result);
  } catch (error: any) {
    console.error("Test Failed:", error);
  }
}

run();
