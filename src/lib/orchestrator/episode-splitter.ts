/**
 * 按集/章标记拆分完整剧本文本。
 * 独立文件以避免被 "use server" 约束。
 *
 * 支持格式：
 *   [[EPISODE 1]], [[CHAPTER 2]], [[EP3]]
 *   第1集：, 第一集：, 第2章：
 */
export function splitByEpisodeMarker(rawScript: string): string[] {
  // Unicode escapes avoid Next.js Turbopack highlight.rs multibyte panic
  // \u7b2c = 第, \u96c6 = 集, \u7ae0 = 章, \uff1a = ：
  const markerRe = new RegExp(
    "(?=\\[\\[(?:EPISODE|CHAPTER|EP|" +
      "\u7b2c\\s*\\d+\\s*[\u96c6\u7ae0]" +
      ")\\s*\\d*\\]\\]|\\[EP\\d+\\]|^\u7b2c\\s*[" +
      "\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\\d" +
      "]+\\s*[\u96c6\u7ae0][\uff1a:\uff1a])",
    "im",
  );

  const parts = rawScript.split(markerRe).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return [rawScript.trim()];
  return parts;
}
