import type { Character, Scene, Shot, ShotCharacter } from "@prisma/client";

/** Scene + shots + 出镜角色（用于分镜表） */
export type SceneWithShotsAndChars = Scene & {
  shots: (Shot & {
    characters: (ShotCharacter & { character: Pick<Character, "name"> })[];
  })[];
};

/** 扁平化一行，便于客户端序列化与渲染 */
export type StoryboardShotRow = {
  shotId: string;
  sceneId: string;
  globalIndex: number;
  episodeNumber: number;
  sceneOrder: number;
  sceneLocation: string;
  timeOfDay: string | null;
  shotOrder: number;
  type: string;
  cameraMove: string | null;
  duration: number;
  status: string;
  prompt: string;
  imagePrompt: string | null;
  videoPrompt: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  errorMsg: string | null;
  characterNames: string[];
};

export function buildStoryboardRows(scenes: SceneWithShotsAndChars[]): StoryboardShotRow[] {
  const sorted = [...scenes].sort((a, b) => {
    if (a.episodeNumber !== b.episodeNumber) return a.episodeNumber - b.episodeNumber;
    return a.order - b.order;
  });
  const rows: StoryboardShotRow[] = [];
  let globalIndex = 0;
  for (const scene of sorted) {
    const shots = [...scene.shots].sort((a, b) => a.order - b.order);
    for (const shot of shots) {
      globalIndex += 1;
      rows.push({
        shotId: shot.id,
        sceneId: scene.id,
        globalIndex,
        episodeNumber: scene.episodeNumber,
        sceneOrder: scene.order,
        sceneLocation: scene.location,
        timeOfDay: scene.timeOfDay,
        shotOrder: shot.order,
        type: shot.type,
        cameraMove: shot.cameraMove,
        duration: shot.duration,
        status: shot.status,
        prompt: shot.prompt,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        videoUrl: shot.videoUrl,
        imageUrl: shot.imageUrl,
        errorMsg: shot.errorMsg,
        characterNames: shot.characters.map((c) => c.character.name),
      });
    }
  }
  return rows;
}
