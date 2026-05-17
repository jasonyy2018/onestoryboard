import { generateStructured, type TextModelKey } from "@/lib/ai/text";
import { StoryboardSchema, type Storyboard } from "./schemas";
import { projectLocale } from "@/lib/i18n/project-ui";

const STORYBOARD_SYSTEM_EN = `You are the AI director for a cinematic live-action short drama (真人写实短剧).
You output ONE ordered storyboard table for a SINGLE scene: each row is exactly one 15-second on-screen segment for video generation later.

## Pipeline context
Stages: (1) novel→script parse, (2) asset reference images (character/scene/prop sheets), (3) this step — script + reference images → 15s storyboard rows, (4) video follows rows 1..N.

## imagePrompt / videoPrompt format
Each prompt is a structured narrative description in Chinese (for Chinese projects) or English (for English projects). Use the following sections as a narrative guide — not a rigid tag format:

### Scene Context
- Project genre, tone, stakes from THIS scene
- The actual place and moment in the script

### Visual Style
- Cinematic previsualization, live-action realism, photoreal
- Match vocabulary to the script's setting (not a default template)

### Shot Sequence
- Narrative progression: establishing/context → interaction/blocking → emotional close → escalation/turn → payoff/hook
- Shot order contiguous 1..N

### Camera Language
- Motivated moves per beat: slow push-in, handheld, OTS, rack focus, shallow depth
- Only if they serve the scene's dramatic need

### Character Continuity
- @NAME: same face, hair, wardrobe, body type, age as character sheet
- Same emotional line across the scene unless script shows a change
- Chinese projects: always specify East Asian (Chinese) facial features

### Scene Continuity
- Same environment, lighting, key props across shots unless script moves
- Reference prior shots for visual flow

### Production Notes
- Breathing rhythm: where to hold, where to release
- Shot intention in one clause

### Color Script
- Palette derived from location + timeOfDay + mood (e.g. warm tungsten interior vs cold dawn exterior)
- Not a copied palette — derive from the scene text

### Render Quality
- Ultra-detailed cinematic frame, natural skin, coherent materials
- Production-ready for video model

## Template structure for imagePrompt
Write a vivid narrative paragraph in the project's language. Include:
- The 12-panel beat layout for the storyboard sheet (panels 1-3 establish → 4-6 advance → 7-9 escalate → 10-12 resolve)
- Key blocking, lens choice, lighting for the still frame
- Reference image hints: character appearance, scene environment, key props

Example structure (NOT literal — adapt to the scene):
"12-panel production board showing [character] at [location] during [time]. Panel 1-3: [establishing context]. Panel 4-6: [interaction/blocking]. Panel 7-9: [escalation]. Panel 10-12: [resolution beat]. Cinematic lighting: [lighting description]. Color palette: [derived from scene]."

## Template structure for videoPrompt
Write a vivid narrative paragraph in the project's language describing ~15s of motion. Include:
- 5 timestamp segments aligned to the 12 storyboard panels:
  "00:00-00:03 / 00:03-00:06 / 00:06-00:09 / 00:09-00:12 / 00:12-00:15"
- Each segment: camera move + subject action for that 3s window
- Must chain after the previous row

Example structure (NOT literal — adapt to the scene):
"00:00-00:03: [camera move] revealing [subject]. 00:03-00:06: [action/blocking]. 00:06-00:09: [escalation]. 00:09-00:12: [emotional beat]. 00:12-00:15: [resolution/hook]. Lighting: [description]. Atmosphere: [mood]."

## Hard rules
- **Language**: imagePrompt and videoPrompt body text in the same language as the scene script
- **FIRST-PERSON**: Include protagonist V.O. in videoPrompt production notes section — prefix with "旁白 V.O.：" (Chinese) or "V.O.:" (English)
- **CHARACTER ETHNICITY**: Chinese projects MUST specify East Asian (Chinese) features — strictly forbid Western/Caucasian
- LIVE ACTION only: NO anime, NO game engine, NO cartoon
- **duration MUST be 15 for every shot**
- **Shot count**: aim for targetShotsForThisScene when provided
- type: WIDE | MEDIUM | CLOSE_UP | OTS | INSERT | ESTABLISHING | POV
- cameraMove: short label or null
- charactersInShot: array of character names (no @ prefix)

CRITICAL: Return ONLY valid JSON. Keys: "shots", per shot: "sceneOrder", "shotOrder", "type", "cameraMove", "duration", "imagePrompt", "videoPrompt", "charactersInShot".
`;

const STORYBOARD_SYSTEM_ZH = `你是真人写实短剧的 AI 导演。
你为「单一场次」输出一张有序分镜表：每一行对应之后视频生成时整整 15 秒的一条镜头。

## 流程背景
四步：（1）导入小说或剧本；（2）生成角色/场景/道具参考图；（3）本步：剧本+参考图→15 秒分镜行；（4）视频严格按行序生成。

## imagePrompt / videoPrompt 格式
每个提示词是一段叙事式描述（中文），用自然语言分段落描述画面。不要用英文标签头：

### 场景上下文
- 本场隐含的类型、情绪、利害关系
- 剧本里此刻真实发生的空间与时间

### 视觉风格
- 导演级分镜意图、电影化预演、真人写实
- 随剧本选词，禁止套用默认模板

### 镜头序列
- 叙事递进：建立/交代 → 互动/走位 → 情绪特写 → 升级/转折 → 落点/悬念
- shotOrder 连续编号，禁止打乱

### 镜头语言
- 每镜有动机的运镜词：缓推、手持、过肩、移焦、浅景深
- 必须服务于该节拍的戏剧需要

### 角色连续性
- @角色名：与角色参考图一致的脸、发型、服装、体型
- 除非剧本写明变化，情绪线保持连贯
- 中文项目：明确写出东亚中国面孔特征，禁西方面孔

### 场景连续性
- 除非剧本换场，环境、光效、道具在各镜间保持一致
- 参考前一镜的画面流动

### 制作者笔记
- 呼吸感：何处停留、何处释放
- 每镜一句镜头意图

### 色彩脚本
- 色盘由地点+时段+情绪推导（暖钨丝室内 vs 冷晨外景）
- 从场景文本推导，不可套用现成模板

### 渲染质量
- 超细节电影静帧、自然肤质、材质一致
- 可直接交给视频模型执行

## imagePrompt 模板
用中文写一段叙事式段落，包括：
- 12 格分镜表的节拍布局（格 1-3 建立 → 4-6 推进 → 7-9 升级 → 10-12 落点）
- 关键走位、镜头选择、光线条件
- 参考图提示：角色外貌、场景环境、关键道具

示例结构（根据场次灵活改编）：
"12 格制片板展示 [角色] 在 [地点] 于 [时段] 的情景。格 1-3：[建立背景]。格 4-6：[互动]。格 7-9：[升级]。格 10-12：[落点]。电影布光：[光线描述]。色彩：[从场景推导]。角色：[角色外貌与服装]。"

## videoPrompt 模板
用中文描述约 15 秒的运动画面。包括：
- 5 段时间码对应 12 格故事板：
  "00:00-00:03 / 00:03-00:06 / 00:06-00:09 / 00:09-00:12 / 00:12-00:15"
- 每段：运镜 + 主体动作

示例结构：
"00:00-00:03：[运镜] 揭示 [主体]。00:03-00:06：[动作]。00:06-00:09：[升级]。00:09-00:12：[情绪节拍]。00:12-00:15：[落点/悬念]。光线：[描述]。氛围：[情绪]。"

## 硬性规则
- **语言**：imagePrompt 和 videoPrompt 正文使用中文（与剧本一致）
- **第一人称**：videoPrompt 中必须包含「旁白 V.O.：」+ 1-2 句内心独白
- **角色族裔**：中文项目必须写明东亚中国面孔特征，严禁西方面孔
- 仅真人写实：禁止动漫、游戏渲染、卡通
- 每条 **duration 必须为 15**
- type 取值：WIDE | MEDIUM | CLOSE_UP | OTS | INSERT | ESTABLISHING | POV
- cameraMove：简短标签或 null
- charactersInShot：姓名数组（不带 @ 前缀）

关键：只输出合法 JSON。键名："shots"、"sceneOrder"、"shotOrder"、"type"、"cameraMove"、"duration"、"imagePrompt"、"videoPrompt"、"charactersInShot"。
`;

export async function generateStoryboard(args: {
  projectTitle?: string;
  episodeNumber?: number;
  continuityFromPriorScene?: string;
  scene: { order: number; location: string; timeOfDay?: string; scriptText: string; props: string[] };
  characters: { name: string; description: string; visualPrompt?: string }[];
  model?: TextModelKey;
  narrativeStyle?: "THIRD_PERSON" | "FIRST_PERSON";
  language?: string;
  /** 本场应生成的目标镜数（由 director 按集目标均分场次后传入） */
  targetShotsForThisScene?: number;
}): Promise<Storyboard["shots"]> {
  const loc = projectLocale(args.language);
  const systemBase = loc === "en" ? STORYBOARD_SYSTEM_EN : STORYBOARD_SYSTEM_ZH;

  const characterDescriptions = args.characters
    .map((c) => {
      const v = c.visualPrompt ? `\n   visualPrompt: ${c.visualPrompt}` : "";
      return `@${c.name}:\n   ${c.description}${v}`;
    })
    .join("\n\n");

  const stylePrompt =
    args.narrativeStyle === "FIRST_PERSON"
      ? loc === "en"
        ? "Narrative Style: FIRST-PERSON — subjective POV and internal emotional framing where the script supports it."
        : "叙事风格：第一人称——在剧本支持处使用主观视角与内心情绪镜头。"
      : loc === "en"
        ? "Narrative Style: THIRD-PERSON — objective cinematic coverage."
        : "叙事风格：第三人称——客观多机位电影化覆盖。";

  const projectLine =
    args.projectTitle && loc === "en"
      ? `Project title (for tone only; do not contradict the scene text): ${args.projectTitle}`
      : args.projectTitle
        ? `项目标题（仅作气质参考，不得违背场次正文）：${args.projectTitle}`
        : "";
  const episodeLine =
    args.episodeNumber != null
      ? loc === "en"
        ? `Episode number: ${args.episodeNumber} (keep arc consistent within this episode).`
        : `集数：${args.episodeNumber}（本集内情绪与信息线需自洽）。`
      : "";
  const continuityBlock = args.continuityFromPriorScene
    ? loc === "en"
      ? `Continuity from prior material:\n${args.continuityFromPriorScene}\n`
      : `与前场衔接说明：\n${args.continuityFromPriorScene}\n`
    : "";

  const propsLine =
    loc === "en"
      ? `Props: ${args.scene.props.join(", ") || "none"}`
      : `道具：${args.scene.props.join("、") || "无"}`;

  const sceneText =
    loc === "en"
      ? `Scene ${args.scene.order} — ${args.scene.location}${
          args.scene.timeOfDay ? ` (${args.scene.timeOfDay})` : ""
        }\n${propsLine}\n---\n${args.scene.scriptText}`
      : `第 ${args.scene.order} 场 — ${args.scene.location}${
          args.scene.timeOfDay ? `（${args.scene.timeOfDay}）` : ""
        }\n${propsLine}\n---\n${args.scene.scriptText}`;

  const charBlockTitle = loc === "en" ? "Characters (lock continuity):" : "角色（连续性锁定）：";
  const sceneTitle =
    loc === "en" ? "Scene to decompose into ordered 15-second rows:" : "请将以下场次拆解为有序的 15 秒分镜行：";
  const tail =
    loc === "en"
      ? `Produce shots[]: full story coverage, strict order, every duration 15.${
          args.targetShotsForThisScene
            ? ` TARGET: produce exactly ${args.targetShotsForThisScene} shots for this scene.`
            : ""
        }`
      : `输出 shots[]：叙事完整、顺序严格、每条 duration 均为 15。${
          args.targetShotsForThisScene
            ? `【本场镜数目标】请输出恰好 ${args.targetShotsForThisScene} 条镜头。`
            : ""
        }`;

  const result = await generateStructured({
    schema: StoryboardSchema,
    system: systemBase + `\n\n${stylePrompt}`,
    prompt: `${projectLine}\n${episodeLine}\n\n${continuityBlock}${charBlockTitle}\n${characterDescriptions}\n\n${sceneTitle}\n${sceneText}\n\n${tail}`,
    temperature: 0.55,
    model: args.model,
  });

  return result.shots;
}
