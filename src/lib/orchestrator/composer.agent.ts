import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchAsBuffer, persistAsset } from "@/lib/ai/storage";

ffmpeg.setFfmpegPath((ffmpegPath as unknown as { path: string }).path);

export interface ComposerInput {
  projectId: string;
  episodeNumber?: number;
  shotVideoUrls: string[]; // ordered
}

export interface ComposerResult {
  videoUrl: string;
  durationSec: number;
  sizeBytes: number;
}

/**
 * Stitch ordered shot videos into a single MP4 (no separate narration track; clip audio follows each shot).
 */
export async function composeFinalVideo(input: ComposerInput): Promise<ComposerResult> {
  const workDir = await mkdtemp(join(tmpdir(), "onestoryboard-"));
  try {
    // 1) download all shot clips
    const localPaths: string[] = [];
    for (const [i, url] of input.shotVideoUrls.entries()) {
      const buf = await fetchAsBuffer(url);
      const p = join(workDir, `clip-${i.toString().padStart(3, "0")}.mp4`);
      await writeFile(p, buf);
      localPaths.push(p);
    }

    // 2) build concat list
    const concatList = localPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    const concatPath = join(workDir, "concat.txt");
    await writeFile(concatPath, concatList);

    const outPath = join(workDir, "final.mp4");

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 22",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-c:a aac",
          "-b:a 128k",
        ])
        .output(outPath)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });

    const finalBuffer = await readFile(outPath);
    const epSuffix = input.episodeNumber != null ? `ep${input.episodeNumber}-` : "";
    const videoUrl = await persistAsset({
      key: `projects/${input.projectId}/${epSuffix}final.mp4`,
      data: finalBuffer,
      contentType: "video/mp4",
    });

    // get duration via ffprobe
    const durationSec = await new Promise<number>((resolve) => {
      ffmpeg.ffprobe(outPath, (_err, data) => {
        resolve(Math.round(data?.format.duration ?? 0));
      });
    });

    return { videoUrl, durationSec, sizeBytes: finalBuffer.byteLength };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
