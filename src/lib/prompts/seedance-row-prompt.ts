import { loadPromptTemplate, resolvePromptLocale } from "@/lib/prompts/load-template";

/**
 * Wraps the per-shot ECP row body with the canonical Part 2 (Seedance) brief
 * from /prompts/part2-seedance.{zh,en}.md — used before cinematic safety wrap.
 */
export function wrapSeedancePart2Template(rowScript: string, language: string): string {
  const locale = resolvePromptLocale(language);
  const file = locale === "zh" ? "part2-seedance.zh.md" : "part2-seedance.en.md";
  return loadPromptTemplate(file, { ROW_SCRIPT: rowScript.trim() });
}
