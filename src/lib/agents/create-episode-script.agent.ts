import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateStructured, type TextModelKey } from "@/lib/ai/text";
import { DramaEpisodeScriptSchema, type DramaEpisodeScript } from "@/lib/orchestrator/schemas";
import { projectLocale } from "@/lib/i18n/project-ui";

const EPISODE_SCRIPT_SYSTEM_EN = `You are a short drama (短剧) script generator. Generate the final JSON episode script with per-scene visual descriptions, shot types, camera movements, lighting, mood, dialogue, and action.

## Input
- Normalized scene descriptions with location, time, characters, props
- Character visual prompts for continuity reference

## Output Rules
Each scene must have:
- visual.description: Vivid narrative description of what the camera sees (Chinese narrative style, not keyword list)
- visual.shotType: Cinematic shot type (WIDE/MEDIUM/CLOSE_UP/ESTABLISHING/POV/OTS)
- visual.cameraMovement: Camera motion (push-in, pull-out, tracking, crane, handheld, steadicam, pan, tilt, or null)
- visual.lighting: Lighting condition (natural morning light, warm tungsten, cold fluorescent, dramatic chiaroscuro, golden hour, etc.)
- visual.mood: Emotional atmosphere (tense, romantic, suspenseful, melancholic, joyful, etc.)
- dialogue[]: Array of {character, line} for dialogue scenes
- action: Description of physical action and blocking
- charactersInScene: Array of character names present
- durationSeconds: 15

CRITICAL: Return ONLY valid JSON.`;

const EPISODE_SCRIPT_SYSTEM_ZH = `你是短剧剧本生成器。生成最终的 JSON 格式分镜剧本，每场包含视觉描述、镜头类型、运镜、光线、氛围、对白和动作。

## 输入
- 规范化的场景描述（含地点、时间、角色、道具）
- 角色视觉提示（供连续性参考）

## 输出规则
每场必须包含：
- visual.description：画面叙事描述（中文叙事风格，非关键词列表）
- visual.shotType：镜头类型（WIDE/MEDIUM/CLOSE_UP/ESTABLISHING/POV/OTS）
- visual.cameraMovement：运镜方式（push-in/pull-out/tracking/crane/handheld/steadicam/pan/tilt 或 null）
- visual.lighting：光线条件（晨光/暖钨丝灯/冷荧光灯/戏剧性明暗/黄金时刻等）
- visual.mood：情绪氛围（紧张/浪漫/悬疑/忧郁/欢快等）
- dialogue[]：对话数组 {character, line}
- action：动作与走位描述
- charactersInScene：出场角色名数组
- durationSeconds：15

关键：只输出合法 JSON。`;

export async function createEpisodeScript(
  projectId: string,
  episodeNumber: number = 1,
  model?: TextModelKey,
): Promise<DramaEpisodeScript> {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      characters: true,
      scenes: {
        where: { episodeNumber },
        orderBy: { order: "asc" },
        include: { props: true },
      },
    },
  });

  const isZh = projectLocale(project.language) !== "en";
  const system = isZh ? EPISODE_SCRIPT_SYSTEM_ZH : EPISODE_SCRIPT_SYSTEM_EN;

  const charContext = project.characters
    .map((c: { name: string; visualPrompt?: string | null; description: string | null }) => `@${c.name}:\n  visual: ${c.visualPrompt || c.description || ""}`)
    .join("\n\n");

  const sceneContext = project.scenes
    .map(
      (s: { location: string; timeOfDay?: string | null; scriptText: string; props: { name: string }[] }, i: number) =>
        `Scene ${i + 1}: ${s.location}${s.timeOfDay ? ` (${s.timeOfDay})` : ""}\n` +
        `Description: ${s.scriptText}\n` +
        `Props: ${s.props.map((p: { name: string }) => p.name).join(", ") || "none"}`,
    )
    .join("\n\n");

  const prompt = isZh
    ? `第 ${episodeNumber} 集\n\n角色（视觉连续性参考）：\n${charContext}\n\n场次：\n${sceneContext}\n\n为每场生成完整的视觉描述、镜型、运镜、光线、氛围、对白和动作。`
    : `Episode ${episodeNumber}\n\nCharacters (visual continuity reference):\n${charContext}\n\nScenes:\n${sceneContext}\n\nGenerate complete visual description, shot type, camera movement, lighting, mood, dialogue, and action for each scene.`;

  const result = await generateStructured({
    schema: DramaEpisodeScriptSchema,
    system,
    prompt,
    temperature: 0.4,
    model,
  });

  logger.info(
    { projectId, episode: episodeNumber, scenes: result.scenes.length },
    "[create-episode-script] script generation complete",
  );

  return result;
}
