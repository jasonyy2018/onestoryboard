import { env } from "@/lib/env";
import { withRetry } from "@/lib/ai/retry";
import type { ZodTypeAny, z } from "zod";

// export type TextModelKey = "doubao-seed-2-0"; // disabled: switched to DeepSeek V3 Flash
export type TextModelKey = "deepseek-v3-flash";

// async function callDoubao(...) — disabled: switched to DeepSeek V3 Flash via Volcengine ARK
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
      // model: env.DOUBAO_ENDPOINT_ID || "doubao-seed-2-0-lite-260428", // disabled
      model: env.DOUBAO_ENDPOINT_ID || "deepseek-v3-2-251201",
      messages: [
        ...(args.system ? [{ role: "system", content: args.system }] : []),
        { role: "user", content: args.prompt },
      ],
      temperature: args.temperature ?? 0.7,
      max_tokens: 8192,
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

function repairJSON(raw: string): string {
  let text = raw.trim();

  try { JSON.parse(text); return text; } catch {}

  // Fix trailing commas before closing brackets/braces
  text = text.replace(/,(\s*[}\]])/g, "$1");
  try { JSON.parse(text); return text; } catch {}

  // Fix unquoted object keys
  text = text.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  try { JSON.parse(text); return text; } catch {}

  // Fix unterminated final string value
  const unclosed = text.match(/:\s*"((?:[^"\\]|\\.)*)$/);
  if (unclosed) {
    text += '"';
    try { JSON.parse(text); return text; } catch {}
  }

  // Strip non-JSON prefix/suffix heuristically
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const inner = text.slice(braceStart, braceEnd + 1);
    try { JSON.parse(inner); return inner; } catch {}
  }

  throw new SyntaxError(
    `Unrepairable JSON from LLM.\nFirst 600 chars: ${raw.slice(0, 600)}\nLast 200 chars: ${raw.slice(-200)}`,
  );
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
      const repaired = repairJSON(text);
      const parsed = JSON.parse(repaired);

      if (Array.isArray(parsed)) {
        try {
      try {
        return args.schema.parse(parsed) as z.infer<S>;
      } catch {
        // LLM returned object missing optional-ish fields (e.g. episode).
        // Try filling common defaults before failing.
        const fixed: Record<string, unknown> = { ...parsed };
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          if (!("episode" in parsed)) fixed.episode = 1;
          if (!("scenes" in parsed) && "episode" in parsed) fixed.scenes = [];
          if (!("characters" in parsed) && ("scenes" in parsed || "name" in parsed)) fixed.characters = [];
        }
        try {
          return args.schema.parse(fixed) as z.infer<S>;
        } catch {}
        throw new Error(
          `LLM returned object but schema validation failed. ` +
          `Parsed keys: [${Object.keys(parsed as object).join(", ")}]. ` +
          `Zod error: ${(args.schema.safeParse(parsed) as { error: { message: string } }).error.message.slice(0, 300)}` +
          ` LLM preview: ${JSON.stringify(parsed).slice(0, 400)}`,
        );
      }
        } catch {}
        for (const key of ["scenes", "data", "items", "characters", "shots", "steps"]) {
          try {
            return args.schema.parse({ episode: 1, [key]: parsed }) as z.infer<S>;
          } catch {}
        }
        const first = parsed[0];
        if (first && typeof first === "object" && !Array.isArray(first)) {
          const keys = Object.keys(first);
          const isScene = keys.length >= 3 && !("name" in first);
          if (isScene) {
            try { return args.schema.parse({ episode: 1, scenes: parsed, characters: [] }) as z.infer<S>; } catch {}
          }
          if ("name" in first || "visualPrompt" in first) {
            try { return args.schema.parse({ episode: 1, scenes: [], characters: parsed }) as z.infer<S>; } catch {}
          }
          try { return args.schema.parse({ data: parsed }) as z.infer<S>; } catch {}
          try { return args.schema.parse({ items: parsed }) as z.infer<S>; } catch {}
        }
        const zodErr = args.schema.safeParse({ episode: 1, scenes: parsed });
        const detail = zodErr.success
          ? `Zod OK but was not returned`
          : `Zod error: ${zodErr.error.message.slice(0, 300)}`;
        throw new Error(
          `LLM returned array; schema expects object — none of the fallback keys matched. ` +
          `Array length: ${parsed.length}. First item keys: [${first && typeof first === "object" ? Object.keys(first).join(", ") : typeof first}]. ${detail}` +
          ` LLM preview: ${JSON.stringify(parsed).slice(0, 400)}`,
        );
      }

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
