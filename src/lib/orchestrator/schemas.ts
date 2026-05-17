import { z } from "zod";

export const ParsedScriptSchema = z.object({
  scenes: z.array(
    z.object({
      order: z.number().int().min(1),
      episodeNumber: z.number().int().min(1).default(1),
      location: z.string(),
      timeOfDay: z.string().nullable(),
      scriptText: z.string(),
      props: z.array(z.string()).default([]),
    }),
  ),
  characters: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      personality: z.string().optional(),
      background: z.string().optional(),
      visualPrompt: z.string().optional(),
    }),
  ),
});
export type ParsedScript = z.infer<typeof ParsedScriptSchema>;

export const StoryboardSchema = z.object({
  shots: z.array(
    z.object({
      sceneOrder: z.number().int().min(1),
      shotOrder: z.number().int().min(1),
      type: z.enum([
        "WIDE",
        "MEDIUM",
        "CLOSE_UP",
        "OTS",
        "INSERT",
        "ESTABLISHING",
        "POV",
      ]),
      cameraMove: z.string().nullable(),
      duration: z.literal(15),
      imagePrompt: z
        .string()
        .describe(
          "ECP wire format: multi-line string starting with **[PROJECT]** then **[VISUAL STYLE]** … **[RENDER QUALITY]** in that exact order (see storyboard system prompt). Still-frame / storyboard-panel intent only.",
        ),
      videoPrompt: z
        .string()
        .describe(
          "Same ten ECP headers as imagePrompt, same order; content describes ~15s motion (subject, camera, environment) for this beat.",
        ),
      charactersInShot: z.array(z.string()).default([]),
    }),
  ),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/** 规范化场景表：analyze-assets 的输出，用于 normalize-drama-script 的输入 */
export const NormalizedSceneSchema = z.object({
  sceneId: z.string(),
  description: z.string(),
  duration: z.number(),
  sceneType: z.enum(["剧情", "动作", "对话", "过渡", "空镜"]),
  segmentBreak: z.boolean(),
  charactersInScene: z.array(z.string()),
});
export type NormalizedScene = z.infer<typeof NormalizedSceneSchema>;

/** 规范化剧本表 */
export const NormalizedScriptSchema = z.object({
  episode: z.number(),
  scenes: z.array(NormalizedSceneSchema),
});
export type NormalizedScript = z.infer<typeof NormalizedScriptSchema>;

/** 单场视觉描述 */
export const SceneVisualSchema = z.object({
  description: z.string(),
  shotType: z.string(),
  cameraMovement: z.string(),
  lighting: z.string(),
  mood: z.string(),
});

/** 对话行 */
export const DialogueLineSchema = z.object({
  character: z.string(),
  line: z.string(),
});

/** 单场完整剧本 */
export const DramaSceneSchema = z.object({
  sceneId: z.string(),
  visual: SceneVisualSchema,
  dialogue: z.array(DialogueLineSchema).default([]),
  action: z.string().optional(),
  charactersInScene: z.array(z.string()),
  durationSeconds: z.number(),
});

/** 单集完整剧本 */
export const DramaEpisodeScriptSchema = z.object({
  episode: z.number(),
  scenes: z.array(DramaSceneSchema),
});
export type DramaEpisodeScript = z.infer<typeof DramaEpisodeScriptSchema>;

/** 资产提取输出：只用单一 LLM 调用提取全部三类的结构化结果 */
export const AssetExtractionSchema = z.object({
  characters: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      visualPrompt: z.string().optional(),
    }),
  ),
  scenes: z.array(
    z.object({
      name: z.string(),
      location: z.string(),
      description: z.string(),
    }),
  ),
  props: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    }),
  ),
});
export type AssetExtraction = z.infer<typeof AssetExtractionSchema>;
