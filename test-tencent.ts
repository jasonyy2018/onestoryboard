import { generateImage } from "./src/lib/ai/image";

async function run() {
  try {
    console.log("Testing Tencent OG Image Generation...");
    const result = await generateImage(
      {
        prompt: "A beautiful landscape of cyberpunk city at night, neon lights, 4k resolution",
        size: "1K"
      },
      "tencent-og-low"
    );
    console.log("Success:", result);
  } catch (error: any) {
    console.error("Test Failed:", error);
  }
}

run();
