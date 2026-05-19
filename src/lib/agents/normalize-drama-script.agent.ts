import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateStructured, generatePlainText, type TextModelKey } from "@/lib/ai/text";
import { NormalizedScriptSchema, type NormalizedScript } from "@/lib/orchestrator/schemas";
import { projectLocale } from "@/lib/i18n/project-ui";

const NORMALIZE_SYSTEM_EN = `You are a professional short drama (短剧) script editor. Transform the novel scene into structured visual scene descriptions.

## Short Drama Rhythm Rules
- Opening ~4s: strong hook, suspense, or crisis. No establishing shots.
- Every ~15s: a turning point (action/emotion/relationship/event reversal).
- Final shot: emotional peak, Close-up / Extreme Close-up.

## Output Rules
- Each scene is an independent visual picture
- sceneId format: E{episode}S{two-digit} (e.g., E1S01)
- duration: 15 seconds per scene
- sceneType: one of 剧情(drama), 动作(action), 对话(dialogue), 过渡(transition), 空镜(establishing)
- segmentBreak: true only for major scene transitions (time/location/mood change)
- Characters in scene: reference characters by @NAME
- description: vivid visual description in Chinese narrative style (not keyword lists)

CRITICAL: Return ONLY valid JSON. Output MUST be a JSON object with a "scenes" array, like:
{
  "scenes": [
    {
      "sceneId": "E1S01",
      "description": "...",
      "duration": 15,
      "sceneType": "剧情",
      "segmentBreak": false,
      "charactersInScene": ["@张三"]
    }
  ]
}`;

const NORMALIZE_SYSTEM_ZH = `你是专业的短剧剧本编辑。将小说场次改编为结构化的分镜场景表。

## 短剧节奏规则
- 开篇 ~4 秒：强冲击/悬念/危机切入，避免介绍性远景
- 每 ~15 秒：一次转折点（动作/情绪/关系/事件反转）
- 末镜：情绪极致瞬间，Close-up / Extreme Close-up

## 输出规则
- 每个场景是独立的视觉画面
- sceneId 格式：E{集数}S{两位序号}（如 E1S01）
- duration：每场 15 秒
- sceneType：剧情 / 动作 / 对话 / 过渡 / 空镜
- segmentBreak：仅在重大场景转换时标记 true（时间/地点/情绪变化）
- charactersInScene：用 @角色名 引用角色
- description：中文叙事式视觉描述（非关键词罗列）

关键：只输出合法 JSON。输出必须是一个包含"scenes"数组的 JSON 对象，格式如下：
{
  "scenes": [
    {
      "sceneId": "E1S01",
      "description": "...",
      "duration": 15,
      "sceneType": "剧情",
      "segmentBreak": false,
      "charactersInScene": ["@张三"]
    }
  ]
}`;

export async function normalizeDramaScript(
  projectId: string,
  episodeNumber: number = 1,
  model?: TextModelKey,
): Promise<NormalizedScript> {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      characters: true,
      scenes: {
        where: { episodeNumber },
        orderBy: { order: "asc" },
      },
    },
  });

  const isZh = projectLocale(project.language) !== "en";
  const system = isZh ? NORMALIZE_SYSTEM_ZH : NORMALIZE_SYSTEM_EN;

  const charContext = project.characters
    .map((c: { name: string; visualPrompt?: string | null; description: string | null }) => `@${c.name}: ${c.visualPrompt || c.description || ""}`)
    .join("\n");

  const sceneText = project.scenes
    .map(
      (s: { location: string; timeOfDay?: string | null; scriptText: string }, i: number) =>
        `Scene ${i + 1} — ${s.location}${s.timeOfDay ? ` (${s.timeOfDay})` : ""}\n${s.scriptText}`,
    )
    .join("\n\n");

  const prompt = isZh
    ? `角色信息（连续性锁定）：\n${charContext}\n\n请将以下小说场次改编为规范化的分镜场景表（第 ${episodeNumber} 集），输出格式严格参照 system prompt 中的 JSON 示例：\n\n${sceneText}`
    : `Characters (continuity lock):\n${charContext}\n\nNormalize the following scenes into structured shot tables (Episode ${episodeNumber}), output format MUST follow the JSON example in the system prompt:\n\n${sceneText}`;

  const result = await generateStructured({
    schema: NormalizedScriptSchema,
    system,
    prompt,
    temperature: 0.3,
    model,
  });

  // 注意：不再覆盖 scene.scriptText，保留原始剧本/小说文本作为后续 storyboard 的权威来源。
  // 规范化描述仅通过返回值输出，调用方可自行决定是否使用。
  // 原始 scriptText 不变，确保 storyboard 各阶段忠于原文。

  logger.info(
    { projectId, episode: episodeNumber, scenes: result.scenes.length },
    "[normalize-drama-script] normalization complete (original scriptText preserved)",
  );

  return result;
}
