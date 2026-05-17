import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateStructured, type TextModelKey } from "@/lib/ai/text";
import { AssetExtractionSchema, type AssetExtraction } from "@/lib/orchestrator/schemas";
import { filterSensitiveWords } from "@/lib/orchestrator/safety";
import { projectLocale } from "@/lib/i18n/project-ui";

const ANALYZE_ASSETS_SYSTEM_EN = `You are a professional novel character and world-building analyst specializing in short drama (短剧) video production.

## Core Rules

1. **Visual descriptions only**: Extract ONLY visual appearance, clothing, accessories, color palette. NO personality, relationships, or plot backstory.
2. **Character extraction**: Identify characters with substantive appearances (at least 2 mentions or dialogue).
3. **Scene extraction**: Identify recurring environments with visual characteristics.
4. **Prop extraction**: Identify recurring items with visual significance.
5. **Incremental**: Skip already existing entries.

## Character description rules
- description: Concise 2-3 sentence visual overview
- visualPrompt: Detailed visual description for image generation (ethnicity, facial features, body type, clothing style/colors, key accessories, age range, hair style/color)

## Scene description rules
- name: Location name as it appears in text
- location: Same as name
- description: Space structure, environment atmosphere, lighting characteristics, color reference

## Prop description rules
- name: Prop name as it appears in text
- description: Appearance details, material, size reference, color features

CRITICAL: Return ONLY valid JSON. No conversational filler.`;

const ANALYZE_ASSETS_SYSTEM_ZH = `你是专业的短剧小说角色与世界观分析师。

## 核心规则

1. **仅提取视觉信息**：只提取外貌、服装、配饰、色彩关键词。不提取性格、关系、剧情背景。
2. **角色提取**：识别有实质出场的角色（至少 2 次提及或有对话）。
3. **场景提取**：识别重复出现或具有视觉特征的环境。
4. **道具提取**：识别重复出现或具有视觉特征的物品。
5. **增量追加**：已有记录跳过。

## 角色描述规则
- description：2-3 句精炼视觉概览（中文）
- visualPrompt：详细的视觉描述用于生图（族裔、五官、体型、服装款式/颜色、关键配饰、年龄段、发型/发色）

## 场景描述规则
- name：原文中的地点名
- location：与 name 相同
- description：空间结构、环境氛围、光线特征、色调参考

## 道具描述规则
- name：原文中的道具名
- description：外观细节、材质、尺寸参考、色彩特征

关键：只输出合法 JSON。不要任何寒暄。`;

export async function analyzeAssets(
  projectId: string,
  model?: TextModelKey,
): Promise<AssetExtraction> {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const isZh = projectLocale(project.language) !== "en";

  // Collect existing entries to skip
  const existingChars = await db.character.findMany({
    where: { projectId },
    select: { name: true },
  });
  const existingScenes = await db.scene.findMany({
    where: { projectId },
    select: { location: true },
  });
  const existingProps = await db.prop.findMany({
    where: { scene: { projectId } },
    select: { name: true },
  });

  const existingCharNames = new Set(existingChars.map((c: { name: string }) => c.name));
  const existingSceneLocations = new Set(existingScenes.map((s: { location: string }) => s.location));
  const existingPropNames = new Set(existingProps.map((p: { name: string }) => p.name));

  const system = isZh ? ANALYZE_ASSETS_SYSTEM_ZH : ANALYZE_ASSETS_SYSTEM_EN;

  const systemPrompt = isZh
    ? `已有角色（跳过）：${[...existingCharNames].join("、") || "无"}\n已有场景（跳过）：${[...existingSceneLocations].join("、") || "无"}\n已有道具（跳过）：${[...existingPropNames].join("、") || "无"}\n\n请分析以下小说，提取角色/场景/道具的视觉信息，输出的 JSON 只包含「新增」项。\n\n${project.rawScript}`
    : `Existing characters (skip): ${[...existingCharNames].join(", ") || "none"}\nExisting scenes (skip): ${[...existingSceneLocations].join(", ") || "none"}\nExisting props (skip): ${[...existingPropNames].join(", ") || "none"}\n\nAnalyze the following novel text, extract visual-only character/scene/prop information. Output JSON should contain ONLY new entries not in the skip lists.\n\n${project.rawScript}`;

  const result = await generateStructured({
    schema: AssetExtractionSchema,
    system,
    prompt: systemPrompt,
    temperature: 0.2,
    model,
  });

  // Persist to DB — only new entries
  const newChars = result.characters.filter((c: { name: string }) => !existingCharNames.has(c.name));
  const newScenes = result.scenes.filter((s: { location: string }) => !existingSceneLocations.has(s.location));
  const newProps = result.props.filter((p: { name: string }) => !existingPropNames.has(p.name));

  if (newChars.length > 0) {
    await db.character.createMany({
      data: newChars.map((c: { name: string; description?: string; visualPrompt?: string }) => ({
        projectId,
        name: filterSensitiveWords(c.name),
        description: filterSensitiveWords(c.description || ""),
        visualPrompt: filterSensitiveWords(c.visualPrompt || ""),
      })),
    });
  }

  if (newScenes.length > 0) {
    await db.scene.createMany({
      data: newScenes.map((s: { name: string; location: string; description: string }) => ({
        projectId,
        episodeNumber: 1,
        order: 0,
        location: filterSensitiveWords(s.location),
        scriptText: filterSensitiveWords(s.description),
        timeOfDay: null,
      })),
    });
  }

  logger.info(
    { projectId, newChars: newChars.length, newScenes: newScenes.length, newProps: newProps.length },
    "[analyze-assets] extraction complete",
  );

  return result;
}
