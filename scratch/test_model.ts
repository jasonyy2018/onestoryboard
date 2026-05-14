
import { generatePlainText } from '../src/lib/ai/text';
import { env } from '../src/lib/env';

async function test() {
  console.log("Testing Doubao Seed 2.0...");
  try {
    console.log("Calling generatePlainText...");
    const text = await generatePlainText({
      prompt: "Hello, who are you?",
      model: "doubao-seed-2-0"
    });
    console.log("Response length:", text.length);
    console.log("Response:", text);
  } catch (err) {
    console.error("Model test failed:", err);
  }
}

test();
