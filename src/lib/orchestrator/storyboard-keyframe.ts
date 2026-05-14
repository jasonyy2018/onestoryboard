/**
 * Prompt helpers for EL.CINE storyboard keyframe images (wording only).
 * 分镜表图固定为多格真人制片板；该图作为视频生成的首张参考图（见 shot.worker）。
 * Part 1 完整锁来自仓库根目录 `prompts/part1-storyboard.{zh,en}.md`。
 */

import { loadPromptTemplate, resolvePromptLocale } from "@/lib/prompts/load-template";
import { textSuggestsUndeadOrSfxMakeup } from "@/lib/orchestrator/character-tone";

export function storyboardKeyframeAspectRatio(aspect?: string): "16:9" | "9:16" | "1:1" | "4:3" {
  const a = aspect || "16:9";
  const base =
    a === "9:16" || a === "16:9" || a === "1:1" || a === "4:3" || a === "21:9" ? a : "16:9";
  if (base === "9:16" || base === "1:1" || base === "21:9") return "16:9";
  return base as "16:9" | "4:3";
}

export function storyboardKeyframeNegative(lang: string, imagePrompt?: string): string {
  const undead = imagePrompt && textSuggestsUndeadOrSfxMakeup(imagePrompt);
  if (undead) {
    return lang === "zh"
      ? "动漫化角色，Q版人物，三渲二卡通，游戏 UI，条漫对话框，低画质，无关物体，画面噪点，非档案级质感，现代物体，软件截图，NLE时间线"
      : "anime or chibi characters, 3d cartoon render, game UI, webcomic speech bubbles, low quality, unrelated objects, noisy framing, off-model noise, modern objects, software screenshot, NLE timeline";
  }
  return lang === "zh"
    ? "动漫化角色，Q版人物，三渲二卡通，游戏引擎渲染，条漫对话框，潮流插画-only人物，低画质，畸形，无关物体，现代物体，水彩，铅笔素描，软件截图，NLE时间线，界面UI，多余手指，畸形手部"
    : "anime or chibi characters, 3d cartoon render, game engine toon, webcomic speech bubbles, illustration-only cast, low quality, deformed, unrelated objects, modern objects, watercolor, pencil sketch, software screenshot, NLE timeline, UI overlay, extra fingers, deformed hands";
}

export function storyboardKeyframeUserPrompt(imagePrompt: string, lang: string): string {
  const body = imagePrompt.trim();
  const locale = resolvePromptLocale(lang);
  const file = locale === "zh" ? "part1-storyboard.zh.md" : "part1-storyboard.en.md";
  try {
    return loadPromptTemplate(file, { LOCK_TEXT: body });
  } catch {
    const fallbackZh = `【分镜表图 · 真人多格制片板】\n${body}`;
    const fallbackEn = `[Storyboard panel · live-action sheet]\n${body}`;
    return locale === "zh" ? fallbackZh : fallbackEn;
  }
}
