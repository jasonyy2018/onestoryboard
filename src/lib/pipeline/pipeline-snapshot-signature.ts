/**
 * Stable fingerprint for pipeline DB snapshots — used to avoid redundant SSE
 * "snapshot" events when nothing meaningful changed.
 */
export function pipelineSnapshotSignature(
  p:
    | {
        status: string;
        pipelineStage: string | null;
        errorMessage?: string | null;
        scenes: {
          shots: {
            id: string;
            status: string;
            imageUrl: string | null;
            videoUrl: string | null;
          }[];
        }[];
      }
    | null
    | undefined,
): string {
  if (!p) return "__null__";
  const shotParts = p.scenes
    .flatMap((s) => s.shots)
    .map((sh) => `${sh.id}:${sh.status}:${sh.imageUrl ? "1" : "0"}:${sh.videoUrl ? "1" : "0"}`)
    .sort();
  const err = (p.errorMessage ?? "").slice(0, 200);
  return `${p.status}|${p.pipelineStage ?? ""}|${err}|${shotParts.join(",")}`;
}
