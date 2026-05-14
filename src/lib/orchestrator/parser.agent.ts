import { generateStructured, type TextModelKey } from "@/lib/ai/text";
import { ParsedScriptSchema, type ParsedScript } from "./schemas";
import { projectLocale } from "@/lib/i18n/project-ui";

const PARSER_CORE_EN = `You are a screenwriter's assistant.
Your task is to parse or adapt text into structured screenplay data for a SHORT DRAMA (短剧) production.

## Production constraints (obey strictly)
- Each episode targets exactly 2 minutes of screen time = 8 shots × 15 seconds each.
- Each scene will be broken into shots downstream. To hit 8 shots/episode:
  - Aim for 3–5 scenes per episode (2–3 shots per scene).
  - Never create more than 6 scenes per episode — it leaves too few shots per scene to tell the story.
  - Never create fewer than 2 scenes per episode — it creates overly long scenes.
  - Merge short consecutive beats in the same location into one scene.
  - Split only when location, time of day, or dramatic tension clearly changes.
- Each scene's scriptText must be dense enough to support 2–3 shots of action/dialogue.

Rules for Adaptation (Novel to Script):
- Convert descriptive narration into dramatic dialogue and actions.
- Target a short-drama structure with high tension and fast pacing.
- Ensure every scene has a clear goal and emotional beat.

Structured Import Rules:
- If you see markers like [[EPISODE X]] or [[CHAPTER X]], treat them as HARD BOUNDARIES.
- All content after [[EPISODE 1]] belongs to episode 1, until [[EPISODE 2]] appears.
- Use the provided episode/chapter numbers in the "episodeNumber" field.

Conventions:
- Scenes start with EXT./INT./EST. headers.
- Characters are sometimes prefixed with @NAME (uppercase).
- Props are sometimes prefixed with #NAME (uppercase).
- Dialogue is shown after a centered character name in caps.

Be precise. Do not hallucinate scenes. Use the order they appear in the source.

CRITICAL: Return ONLY valid JSON. No conversational filler.
`;

const PARSER_CORE_ZH = `你是编剧助理。
任务：将文本解析或改编为短剧制作用的结构化剧本数据。

## 制片约束（严格遵守）
- 每集目标时长恰好 2 分钟 = 8 个镜头 × 15 秒/镜头。
- 每个场次在下游会被拆分为若干镜头。为确保每集达到 8 个镜头：
  - 每集场次数建议 3–5 个（每场对应 2–3 个镜头）。
  - 每集场次不得超过 6 个——否则每场只剩 1 个镜头，无法叙事。
  - 每集场次不得少于 2 个——否则单场过长，节奏失控。
  - 同一地点、同一时段内连续发生的情节合并为一场。
  - 仅在地点、时间、戏剧张力明显转换时才拆分新场。
- 每场 scriptText 须足够饱满，能支撑 2–3 个镜头的动作与对白。

改编规则（小说→剧本）：
- 把叙述性描写改写为对白与可视动作。
- 面向短剧：节奏快、冲突强、每场有明确目标与情绪点。

结构化导入规则：
- 若出现 [[EPISODE X]] 或 [[CHAPTER X]] 等标记，视为硬性分界。
- [[EPISODE 1]] 之后直至 [[EPISODE 2]] 出现前的内容均属第 1 集。
- 在字段 episodeNumber 中写入正确的集/章编号。

体例：
- 场次以 EXT./INT./EST. 抬头。
- 角色名可带 @NAME（大写）前缀。
- 道具可带 #NAME（大写）前缀。
- 对白在居中的大写角色名之后书写。

务必精确，禁止凭空增加场次。严格保持原文顺序。

关键：只输出合法 JSON，不要任何寒暄或解释文字。
`;

const PARSER_APPEND_EN = `CRITICAL LANGUAGE RULE: ALL field values (scriptText, location, description, personality, background, visualPrompt, timeOfDay, props, character names, etc.) MUST be written in English — even if the source text is in Chinese or another language. Translate everything into natural English. JSON keys must remain in English: "scenes", "characters", "name", "description", "personality", "background", "visualPrompt", "location", "timeOfDay", "scriptText", "props", "episodeNumber", "order".

Character Guidelines:
- ETHNICITY & REGIONAL STYLE: For English output, characters default to Western appearance unless the text clearly specifies otherwise.
- SETTING ADHERENCE: Strictly match the story's time and space.
  * If post-apocalyptic: clothing weathered, dirty, practical; faces tired or alert; no pristine fashion.
  * If modern office: business casual / workwear, may be slightly disheveled for late night.
- Tune "visualPrompt" to these environments for realism.
- If a character is named "System" or a non-human AI, describe ONLY as non-humanoid interface, orb of light, floating data screen, or abstract UI — never a human body.`;

const PARSER_APPEND_ZH = `关键语言规则：所有字段值（scriptText、location、description、personality、background、visualPrompt、timeOfDay、props、角色名等）必须使用中文撰写——即便原文是英文或其他语言，也必须完整翻译为自然流畅的中文。JSON 键名必须仍为英文："scenes"、"characters"、"name"、"description"、"personality"、"background"、"visualPrompt"、"location"、"timeOfDay"、"scriptText"、"props"、"episodeNumber"、"order"。

角色指引：
- 族裔与地域风格：中文输出时，角色默认东亚（中国）面貌与着装语境，除非正文明确另有设定。
- 时空贴合：严格贴合故事的时代与空间。
  * 末世：服装破旧、脏污、实用；神态疲惫或警觉；禁止过于干净时尚。
  * 现代职场：商务休闲/工装，可略凌乱以表现熬夜等情境。
- 根据环境调整 visualPrompt 以保证可信。
- 若角色名为「系统」或非人 AI，仅描述为界面、光球、悬浮数据屏或抽象光效，禁止人类五官肢体描述。`;

export async function convertNovelToScript(
  novelContent: string,
  episodeCount: number,
  language: string = "zh",
  model?: TextModelKey,
  narrativeStyle: "THIRD_PERSON" | "FIRST_PERSON" = "THIRD_PERSON",
): Promise<ParsedScript> {
  return parseScript(novelContent, episodeCount, language, model, "NOVEL", narrativeStyle);
}

export async function parseScript(
  rawScript: string,
  episodeCount: number,
  language: string = "zh",
  model?: TextModelKey,
  inputType: "SCRIPT" | "NOVEL" = "SCRIPT",
  narrativeStyle: "THIRD_PERSON" | "FIRST_PERSON" = "THIRD_PERSON",
): Promise<ParsedScript> {
  const loc = projectLocale(language);
  const isEn = loc === "en";

  const styleContext =
    narrativeStyle === "FIRST_PERSON"
      ? isEn
        ? "Adapt the script to reflect a FIRST-PERSON narrative style, focusing on internal thoughts and the protagonist's direct perspective."
        : "将剧本处理为第一人称叙事，突出内心活动与主人公主观视角。"
      : isEn
        ? "Use a standard THIRD-PERSON objective narrative style."
        : "使用标准第三人称客观叙事。";

  const inputContext = inputType === "NOVEL"
    ? isEn
      ? "The input is a NOVEL. You must FIRST adapt it into a professional screenplay structure before parsing into JSON."
      : "输入为小说。必须先改编为专业剧本结构，再解析为 JSON。"
    : isEn
      ? "The input is a SCREENPLAY. Parse it directly into structured data."
      : "输入为剧本。直接解析为结构化数据。";

  const langLabel = isEn ? "English" : "中文";

  const exampleBlock = isEn
    ? `Output MUST follow this structure exactly:
{
  "scenes": [...],
  "characters": [
    {
      "name": "...",
      "description": "Short overview (2-3 sentences)",
      "personality": "...",
      "background": "...",
      "visualPrompt": "Detailed visual appearance: ethnicity, clothes, facial features, age, height. MUST match story setting. IF SYSTEM: abstract UI/light only."
    }
  ]
}`
    : `输出必须严格符合下列结构示例：
{
  "scenes": [...],
  "characters": [
    {
      "name": "...",
      "description": "两三句中文概览",
      "personality": "...",
      "background": "...",
      "visualPrompt": "中文详述外貌：族裔、服装、五官、年龄、体型，须与故事时空一致。若角色为「系统」或非人 AI：仅写抽象界面/光效。"
    }
  ]
}`;

  const prompt = isEn
    ? `${inputContext}\n${styleContext}\n\nParse or adapt the following into exactly ${episodeCount} episodes. OUTPUT LANGUAGE: English — translate ALL content into English regardless of the source language.\n\n${exampleBlock}\n\n${rawScript}`
    : `${inputContext}\n${styleContext}\n\n将以下内容解析或改编为恰好 ${episodeCount} 集。输出语言：中文——无论原文是何种语言，所有内容必须翻译为中文输出。\n\n${exampleBlock}\n\n${rawScript}`;

  return generateStructured({
    schema: ParsedScriptSchema,
    system: (isEn ? PARSER_CORE_EN : PARSER_CORE_ZH) + `\n\n${isEn ? PARSER_APPEND_EN : PARSER_APPEND_ZH}`,
    prompt,
    temperature: 0.2,
    model,
  });
}
