import { generateStructured, type TextModelKey } from "@/lib/ai/text";
import { StoryboardSchema, type Storyboard } from "./schemas";
import { projectLocale } from "@/lib/i18n/project-ui";

const STORYBOARD_SYSTEM_EN = `You are the AI director for a cinematic live-action short drama (真人写实短剧).
You output ONE ordered storyboard table for a SINGLE scene: each row is exactly one 15-second on-screen segment for video generation later.
The storyboard image generated from this table uses a hand-drawn mixed-media pre-production document style — but the scenes depicted within each panel are live-action cinematic content.

## Pipeline context
Stages: (1) novel→script parse, (2) asset reference images (character/scene/prop sheets), (3) this step — script + reference images → 15s storyboard rows, (4) video follows rows 1..N.

## imagePrompt / videoPrompt format
Each prompt is a structured narrative description in Chinese (for Chinese projects) or English (for English projects). Use the following sections as a narrative guide — not a rigid tag format:

### Scene Context
- Project genre, tone, stakes from THIS scene
- The actual place and moment in the script

### Visual Style
- Hand-drawn animation storyboard aesthetic, cream/off-white paper, mixed media: graphite pencil sketches + red ink frame borders + blue movement arrows + photorealistic Pixar-style character portraits
- Match vocabulary to the script's setting (not a default template)

### Shot Sequence
- Narrative progression: establishing/context → interaction/blocking → emotional close → escalation/turn → payoff/hook
- Shot order contiguous 1..N

### Camera Language
- Expressed as handwritten labels (CU / MS / WS / LOW / OTS) on each storyboard panel
- Arrow indicators for camera and character movement

### Character Continuity
- @NAME: same face, hair, wardrobe, body type, age as character sheet
- Same emotional line across the scene unless script shows a change
- Chinese projects: always specify East Asian (Chinese) facial features

### Scene Continuity
- Same environment, key props across shots unless script moves
- Reference prior shots for visual flow

### Production Notes
- Breathing rhythm: where to hold, where to release
- Meditation-inspired action notes (e.g. "Inhale. Center. Calm mind.")
- Shot intention in one clause

### Color Script
- Palette derived from location + timeOfDay + mood (e.g. warm fire red-orange, earthy food brown, soft steam gray, metal kitchen dark slate, natural herbs sage green)
- Not a copied palette — derive from the scene text

### Render Quality
- Ultra-detailed mixed-media production storyboard: convincing paper texture, authentic pencil line variation, crisp red ink borders, readable handwritten text
- Production-ready for video model

## Template structure for imagePrompt
Write a vivid narrative paragraph in the project's language. Include:
- The 12-panel beat layout for the storyboard sheet (panels 1-3 establish → 4-6 advance → 7-9 escalate → 10-12 resolve) — **this is a visual/structural framework, NOT a plot requirement; do NOT invent story beats absent from the script**
- For each panel: shot label (e.g. "01 CLOSE-UP"), camera framing, action description, meditation-inspired action note
- Key blocking, lens choice, lighting for the still frame
- Reference image hints: character appearance, scene environment, key props
- **The 12 panels must exactly match the Timeline segments in videoPrompt** — same beats, same actions, same character positions, same scene state. They are two representations of the same 15-second window.
- **Character casting section** for the right-side panel: for every character in the scene, provide name, role title, personality traits (3-4 words), casting reference (actor name, age range, height), and a brief visual appearance description for both the pencil thumbnail sketch and the photorealistic Pixar-style portrait

Example structure (NOT literal — adapt to the scene):
"12-panel storyboard on cream paper showing [character] at [location] during [time]. Left grid — Panel 1-3: [establishing context with shot labels]. Panel 4-6: [interaction/blocking]. Panel 7-9: [escalation]. Panel 10-12: [resolution beat]. Blue movement arrows and red frame borders throughout. Right panel — Character Casting: [Character Name]: [traits]. Casting Reference: [Actor Name], Age: [range], Height: [height]. Bottom notes — Flow Intentions: [breathing philosophy]. Camera Notes: [shot strategy]. Color Palette: [5 swatches derived from scene mood]."

## Template structure for videoPrompt
Write a structured prompt in the project's language describing ~15s of motion, using clear section headers:

**Characters:** — For every character in the scene (including extras, background bystanders, unnamed crowd), provide a concise description: physical traits (build, face, eyes), clothing/uniform, posture, demeanor. Chinese projects MUST specify East Asian (Chinese) features. ALL characters (protagonist,配角, extras alike) must be East Asian — no Western/Caucasian faces allowed.

**Environment:** — Setting, lighting, key props, atmosphere. Match the script's location and time of day.

**Mood:** — Emotional tone, tension, power dynamics. 1-2 sentences.

**Timeline:** — Segmented by timestamp with camera framing and action. Use natural beat divisions (not rigid 3-second chunks). Each segment format: "0:00-0:02 (Framing) Action description. Character appearance for everyone on screen (including background extras)." Chinese projects MUST describe East Asian features in every segment where ANY person appears.

Must chain after the previous row — reference the prior segment's ending position/action.

**For NOVEL_VO narration mode (third-person cinematic + novel narrator)**: Add a "Narration:" section at the end with 1-2 sentences of novel-style descriptive text to be read as voice-over over the footage. Write in third-person literary style, matching the scene's mood. The camera uses third-person objective coverage (multi-angle), NOT protagonist's eyes. Example: "Narration: The knife glides through the air like a dancer's limb — precise, inevitable. In this kitchen, every motion carries the weight of a thousand repetitions."

Example structure (NOT literal — adapt to the scene):
"Characters:\nChef: Tall, lean, sharp eyes, defined jawline. Crisp white chef uniform, rolled sleeves. Calm, authoritative.\nCustomer: Large, exhausted, hunched, messy stained clothing.\n\nEnvironment: Open kitchen, central workstation, stainless steel, warm overhead lighting, steam rising.\n\nMood: Extreme precision and control. Chef's total dominance.\n\nTimeline:\n0:00-0:02 (Close-up) Chef pulls a knife, spins it once, swings toward camera. Sharp eyes locked.\n0:02-0:05 (Medium shot) Knife moves with razor precision across the cutting board. Ingredients scatter."

## Hard rules
- **Faithfulness to original script**: The script text labeled "ORIGINAL script" below is the sole source of truth. imagePrompt and videoPrompt MUST describe ONLY what is in that text — do NOT add, omit, reorder, or alter any events, dialogue, actions, or emotional beats. Every detail in the prompts must be traceable to the original text.
- **Consistency between imagePrompt and videoPrompt**: They describe the SAME 15-second window. The 12 panels in imagePrompt must map directly to the Timeline segments in videoPrompt — matching beats, actions, character positions, camera framing, and scene state. No contradiction. If panel 3 shows a knife chop, the video Timeline at the corresponding timestamp must show the same knife chop.
- **Language**: imagePrompt and videoPrompt body text in the same language as the scene script
- **NARRATION MODE - FIRST-PERSON**: Include protagonist internal monologue V.O. in videoPrompt. Prefix with "旁白 V.O.：" (Chinese) or "V.O.:" (English). Camera is subjective POV — protagonist's eyes.
- **NARRATION MODE - NOVEL_VO**: Include third-person novel-style narrator V.O. in videoPrompt — prefix with "旁白 V.O.：" (Chinese) or "V.O.:" (English). The narrator reads scene description like an audiobook, calm and literary. Camera is first-person subjective POV (same as FIRST-PERSON). Include narrator text at the end of the videoPrompt under a "Narration:" section.
- **CHARACTER ETHNICITY**: Chinese projects MUST specify East Asian (Chinese) features — strictly forbid Western/Caucasian
- **Storyboard page style**: hand-drawn mixed-media pre-production document (pencil sketches + red ink borders + blue arrows). **But the content within each panel depicts live-action cinematic scenes** — real human proportions, authentic blocking, film-grade lighting. Only the character casting portraits on the right panel are photorealistic Pixar-style 3D renders.
- **The final video output remains live-action photorealistic** — the storyboard is a pre-production reference, not the final visual style.
- **duration MUST be 15 for every shot**
- **Shot count**: aim for targetShotsForThisScene when provided
- type: WIDE | MEDIUM | CLOSE_UP | OTS | INSERT | ESTABLISHING | POV
- cameraMove: short label or null
- charactersInShot: array of character names (no @ prefix)

CRITICAL: Return ONLY valid JSON. Keys: "shots", per shot: "sceneOrder", "shotOrder", "type", "cameraMove", "duration", "imagePrompt", "videoPrompt", "charactersInShot".
Your output must be a **complete, parseable JSON object** — do not truncate. Be concise but fully describe each shot.
`;

const STORYBOARD_SYSTEM_ZH = `你是真人写实短剧的 AI 导演。
你为「单一场次」输出一张有序分镜表：每一行对应之后视频生成时整整 15 秒的一条镜头。
由此生成的故事板图采用手绘混合媒介前期制作文档风格——但每格内描绘的场景为真人实拍电影级内容。

## 流程背景
四步：（1）导入小说或剧本；（2）生成角色/场景/道具参考图；（3）本步：剧本+参考图→15 秒分镜行；（4）视频严格按行序生成。

## imagePrompt / videoPrompt 格式
每个提示词是一段叙事式描述（中文），用自然语言分段落描述画面。不要用英文标签头：

### 场景上下文
- 本场隐含的类型、情绪、利害关系
- 剧本里此刻真实发生的空间与时间

### 视觉风格
- 手绘动画分镜美学，米白/奶油色纸张，混合媒介：石墨铅笔素描 + 红色墨水边框 + 蓝色动作箭头 + 照片级写实皮克斯风格角色肖像
- 随剧本选词，禁止套用默认模板

### 镜头序列
- 叙事递进：建立/交代 → 互动/走位 → 情绪特写 → 升级/转折 → 落点/悬念
- shotOrder 连续编号，禁止打乱

### 镜头语言
- 通过每格上的手写标签表达（CU 特写 / MS 中景 / WS 全景 / LOW 低角度 / OTS 过肩）
- 箭头指示摄影机与角色运动方向

### 角色连续性
- @角色名：与角色参考图一致的脸、发型、服装、体型
- 除非剧本写明变化，情绪线保持连贯
- 中文项目：明确写出东亚中国面孔特征，禁西方面孔

### 场景连续性
- 除非剧本换场，环境、道具在各镜间保持一致
- 参考前一镜的画面流动

### 制作者笔记
- 呼吸感：何处停留、何处释放
- 冥想式动作说明（如"吸气·定心·静念"）
- 每镜一句镜头意图

### 色彩脚本
- 色盘由地点+时段+情绪推导（如烈火暖色红橙、食材大地棕、蒸汽柔和灰、金属厨房暗蓝灰、天然香草鼠尾草绿）
- 从场景文本推导，不可套用现成模板

### 渲染质量
- 超高细节混合媒介制作故事板：令人信服的纸张纹理，真实的铅笔线条变化，清晰的红色墨水边框，可读的手写文字
- 可直接交给视频模型执行

## imagePrompt 模板
用中文写一段叙事式段落，包括：
- 12 格分镜表的节拍布局（格 1-3 建立 → 4-6 推进 → 7-9 升级 → 10-12 落点）—— **这是视觉/结构框架，不是情节要求；禁止编造原文没有的情节内容**
- 每格的镜头标签（如"01 特写"）、景别、动作描述、冥想式动作说明
- 关键走位、镜头选择、光线条件
- 参考图提示：角色外貌、场景环境、关键道具
- **12 格必须与 videoPrompt 中的时间线段落严格一致** — 相同的节拍、动作、角色位置、场景状态。两者是同一 15 秒窗口的两种呈现形式。
- **角色选角部分**用于右侧面板：场景中每个角色提供角色名、定位、性格特质（3-4 词）、选角参考（演员名、年龄范围、身高）、以及铅笔缩略图和皮克斯风格写实肖像的外观描述

示例结构（根据场次灵活改编）：
"奶油纸上 12 格故事板展示 [角色] 在 [地点] 于 [时段] 的情景。左侧网格 — 格 1-3：[建立背景及镜头标签]。格 4-6：[互动]。格 7-9：[升级]。格 10-12：[落点]。蓝色动作箭头与红色边框贯穿全页。右侧面板 — 角色选角：[角色名]：[特质]。选角参考：[演员名]，年龄：[范围]，身高：[身高]。底部笔记 — 流动意图：[呼吸理念]。摄影笔记：[镜头策略]。色调色板：[从场景情绪推导的 5 色样]。"

## videoPrompt 模板
用中文写出结构化的约 15 秒运动画面提示词，使用清晰的段落标题：

**角色：** — 场景中每个角色（含群众演员、路人等无名背景角色）给出简洁描述：体型、面容、眼神、服装/制服、姿态、气质。中文项目必须写明东亚中国面孔特征，所有角色（主角配角路人一律）禁止出现西方面孔。

**环境：** — 场景设定、光线、关键道具、氛围。与剧本中的地点和时段一致。

**情绪：** — 情感基调、紧张感、权力关系。1-2 句。

**时间线：** — 按时间码分段，标注景别和动作。按自然的节拍分段（不必死板地切 3 秒）。每段格式："0:00-0:02（景别）动作描述。画面中所有角色外貌特征（含背景路人）。" 中文项目每段必须写明东亚中国面孔特征，画面中出现的每一个人（包括背景群众）都必须是东亚中国面孔。

必须与前一行衔接——参考前一镜的结束位置/动作。

**第一人称内心独白模式（FIRST_PERSON）**：在末尾添加「旁白：」段落，包含 1-2 句以「我」的口吻写的内心独白。镜头是第一人称主观 POV，角色眼睛看到的画面。示例：「旁白：我看着案板上那块和牛，指尖感受着刀刃的凉意。又到了这个时刻，只有我和食材。」

**小说旁白模式（NOVEL_VO）**：在末尾添加「旁白：」段落，包含 1-2 句文学性描述作为画外音朗读。使用第三人称文学风格，匹配场景情绪。示例：「旁白：刀刃在空中划出一道弧线，精准而优雅。在这间厨房里，每一个动作都蕴含着千锤百炼的力量。」

示例结构（根据场次灵活改编）：
"角色：\n厨师：高大精瘦，目光锐利，下颌分明。洁白厨师服，卷袖。冷静、权威。\n顾客：体型宽大，疲惫，驼背，衣装脏乱油腻。\n\n环境：开放式厨房，中央操作台，不锈钢表面，暖色顶光，蒸汽升腾。\n\n情绪：极致精准与控制。厨师完全主导。\n\n时间线：\n0:00-0:02（特写）厨师拔刀，转刀一周，劈向镜头。目光锁定。\n0:02-0:05（中景）刀锋以剃刀般精准划过砧板。食材散落。"

## 硬性规则
- **忠于原文**：下方标记「原始剧本原文」的文本是唯一权威来源。imagePrompt 和 videoPrompt 只能描述该文本已有的内容——禁止添加、删减、重排或篡改任何事件、对白、动作、情绪节拍。提示词中的每一处细节必须可追溯至原文。
- **故事板图与视频内容一致**：两者描述的是同一个 15 秒窗口。imagePrompt 中的 12 格必须直接对应 videoPrompt 中时间线的各个段落——节拍、动作、角色位置、景别、场景状态完全匹配，不得有任何矛盾。例如第 3 格显示落刀切菜，视频时间线对应的时间戳也必须显示同一落刀动作。
- **语言**：imagePrompt 和 videoPrompt 正文使用中文（与剧本一致）
- **叙事模式 - 第一人称**：videoPrompt 中必须包含第一人称内心独白 V.O.（「我」的口吻），格式为「旁白：」+ 1-2 句以「我」开头的内心独白短语。镜头为第一人称主观 POV（角色眼睛）。旁白示例：「旁白：我看着案板上那块和牛，刀刃的凉意从指尖传来。专注，我需要专注。」
  **重要转换规则**：原文中所有第三人称「他」→ 旁白中转换为「我」。原文对主角行为的客观描述 → 转换为内心感受。例如原文「他拿起刀」→ 旁白「我拿起刀，指尖传来熟悉的重量」。
- **叙事模式 - 小说旁白**：videoPrompt 中必须包含第三人称小说式旁白 V.O.，格式为「旁白 V.O.：」+ 1-2 句文学性描述。旁白以小说朗读风格呈现，语速舒缓、文学化。镜头为第三人称客观多机位覆盖（旁观者视角），禁止使用第一人称主观 POV。旁白文字放在 videoPrompt 末尾的「旁白：」段落中。
- **角色族裔**：中文项目必须写明东亚中国面孔特征，严禁西方面孔。此约束同时适用于**所有有名角色、群众演员、背景路人**——画面里出现的每一个人都必须是东亚中国面孔。除非剧本原文明确出现了一个外国角色（如"金发碧眼的法国客人"），才可例外。
- **故事板页面风格**：手绘混合媒介前期制作文档（铅笔素描+红色墨水边框+蓝色箭头）。**但每格内描绘的内容为真人实拍电影级场景**——真实人体比例、真实走位、电影级布光。仅右侧角色选角区肖像为照片级写实皮克斯风格 3D 渲染。
- **最终视频输出仍为真人实拍写实风格**——故事板仅为前期参考，非最终视觉风格。
- 每条 **duration 必须为 15**
- type 取值：WIDE | MEDIUM | CLOSE_UP | OTS | INSERT | ESTABLISHING | POV
- cameraMove：简短标签或 null
- charactersInShot：姓名数组（不带 @ 前缀）

关键：只输出合法 JSON。键名："shots"、"sceneOrder"、"shotOrder"、"type"、"cameraMove"、"duration"、"imagePrompt"、"videoPrompt"、"charactersInShot"。
你的输出必须是**完整的、可解析的 JSON 对象**——禁止截断。每镜描述要精确但避免冗余，确保全部输出完成。
`;

export async function generateStoryboard(args: {
  projectTitle?: string;
  episodeNumber?: number;
  continuityFromPriorScene?: string;
  scene: { order: number; location: string; timeOfDay?: string; scriptText: string; props: string[] };
  characters: { name: string; description: string; visualPrompt?: string }[];
  model?: TextModelKey;
  narrativeStyle?: "THIRD_PERSON" | "FIRST_PERSON" | "NOVEL_VO";
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
        ? "Narrative Style: FIRST-PERSON — first-person internal monologue voice-over (V.O.) using \"I\" (我) perspective. Camera is protagonist's subjective POV (their eyes). Narration is the character's inner thoughts and feelings in their own voice."
        : "叙事风格：第一人称——第一人称内心独白 V.O.，使用「我」的口吻和视角。镜头为角色主观 POV（角色眼睛看到的画面）。旁白是角色内心的想法和感受，用角色自己的声音说话。"
      : args.narrativeStyle === "NOVEL_VO"
        ? loc === "en"
          ? "Narrative Style: NOVEL_VO — third-person cinematic narration (objective multi-angle coverage) with a novel-style narrator voice-over (V.O.) reading descriptive narration like an audiobook. Camera is objective spectator (third-person), NOT protagonist's eyes. Include narrator text in the 'Narration:' section of videoPrompt."
          : "叙事风格：小说旁白——第三人称电影化叙事（客观多机位覆盖），配以小说式旁白（V.O.）朗读文学性描述，类似有声书。镜头为客观旁观视角（第三人称），非主角主观视角。旁白文字放在 videoPrompt 的「旁白：」段落中。"
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
    loc === "en"
      ? "Scene to decompose into ordered 15-second rows (ORIGINAL script below — sole source of truth; do NOT alter or add to it):"
      : "请将以下场次拆解为有序的 15 秒分镜行（下方为原始剧本原文——唯一权威来源，不得篡改或添加）：";
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
