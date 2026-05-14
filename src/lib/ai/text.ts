import { env } from "@/lib/env";
import { withRetry } from "@/lib/ai/retry";
import type { ZodTypeAny, z } from "zod";

export type TextModelKey = "doubao-seed-2-0";

async function callDoubao(args: {
  prompt: string;
  system?: string;
  temperature?: number;
}): Promise<string> {
  const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.VOLCENGINE_ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DOUBAO_ENDPOINT_ID || "doubao-seed-2-0-lite-260428",
      messages: [
        ...(args.system ? [{ role: "system", content: args.system }] : []),
        { role: "user", content: args.prompt },
      ],
      temperature: args.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Doubao API HTTP error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();

  let text = "";
  if (data.choices && data.choices[0]?.message?.content) {
    text = data.choices[0].message.content;
  } else if (data.output && data.output[1]?.content?.[0]?.text) {
    text = data.output[1].content[0].text;
  } else {
    throw new Error(`Failed to parse Doubao response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  // Strip markdown code fences
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    text = jsonMatch[1]!;
  } else if (text.includes("```")) {
    text = text.replace(/```(json)?/g, "").trim();
  }

  // Fallback: extract first { ... } block
  if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    const start = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (start !== -1 && last !== -1 && last > start) {
      text = text.substring(start, last + 1);
    }
  }

  return text.trim();
}

export async function generateStructured<S extends ZodTypeAny>(args: {
  schema: S;
  prompt: string;
  system?: string;
  model?: TextModelKey;
  temperature?: number;
}): Promise<z.infer<S>> {
  return withRetry(
    async () => {
      const text = await callDoubao({
        prompt: args.prompt,
        system: args.system,
        temperature: args.temperature,
      });
      const parsed = JSON.parse(text);
      return args.schema.parse(parsed) as z.infer<S>;
    },
    { context: "text:doubao:structured", retries: 3, minTimeout: 2000 },
  );
}

export async function generatePlainText(args: {
  prompt: string;
  system?: string;
  model?: TextModelKey;
  temperature?: number;
}): Promise<string> {
  return withRetry(
    async () => callDoubao({
      prompt: args.prompt,
      system: args.system,
      temperature: args.temperature,
    }),
    { context: "text:doubao:plain", retries: 3, minTimeout: 2000 },
  );
}
