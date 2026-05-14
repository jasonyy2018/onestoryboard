import { generateCharacterReference } from "../src/lib/orchestrator/assets";

async function test() {
  const charId = "cmp3onisb000mxxmby7hdw6s9"; // 孟序
  console.log("Testing generation for:", charId);
  try {
    const url = await generateCharacterReference(charId);
    console.log("Success! URL:", url);
  } catch (err) {
    console.error("Failed:", err);
  }
}

test();
