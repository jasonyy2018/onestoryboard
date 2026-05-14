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
      /** Each storyboard row maps to one 15s video segment (工业短剧分镜表). */
      duration: z.literal(15),
      imagePrompt: z
        .string()
        .describe(
          "EL.CINE wire format: multi-line string starting with **[PROJECT]** then **[VISUAL STYLE]** … **[RENDER QUALITY]** in that exact order (see storyboard system prompt). Still-frame / storyboard-panel intent only.",
        ),
      videoPrompt: z
        .string()
        .describe(
          "Same ten EL.CINE headers as imagePrompt, same order; content describes ~15s motion (subject, camera, environment) for this beat.",
        ),
      charactersInShot: z.array(z.string()).default([]),
    }),
  ),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;
