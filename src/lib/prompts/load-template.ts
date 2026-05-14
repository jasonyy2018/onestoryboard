import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(process.cwd(), "prompts");

export type PromptLocale = "zh" | "en";

export function resolvePromptLocale(language: string | undefined | null): PromptLocale {
  return language === "en" ? "en" : "zh";
}

/**
 * Load a markdown prompt from /prompts and replace {{KEY}} placeholders.
 */
export function loadPromptTemplate(
  fileName: string,
  vars: Record<string, string>,
): string {
  const fullPath = join(PROMPTS_DIR, fileName);
  if (!existsSync(fullPath)) {
    throw new Error(`Prompt template missing: ${fullPath}`);
  }
  let text = readFileSync(fullPath, "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    text = text.split(`{{${key}}}`).join(value);
  }
  return text;
}
