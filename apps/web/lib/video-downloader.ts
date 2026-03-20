import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 60_000;
const MAX_SIZE_MB = 50;

export type DownloadResult = {
  videoPath: string;
  thumbnailPath: string | null;
  mimeType: string;
  uploader: string | null;
};

/** Check that a binary exists on the system. */
async function checkBinary(name: string): Promise<void> {
  try {
    await execFileAsync("which", [name]);
  } catch {
    throw new Error(`${name} is not installed. Install it with: brew install ${name}`);
  }
}

/**
 * Download a video from a supported platform using yt-dlp.
 * Returns paths to the downloaded video and an extracted thumbnail.
 * Caller is responsible for cleaning up the temp files.
 */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  await checkBinary("yt-dlp");

  const id = randomUUID();
  const videoPath = path.join(tmpdir(), `${id}.mp4`);

  // Download video and extract uploader metadata in parallel
  const downloadPromise = execFileAsync(
    "yt-dlp",
    [
      "-f", `best[vcodec^=h264][filesize<${MAX_SIZE_MB}M][ext=mp4]/best[vcodec^=h264][ext=mp4]/best[ext=mp4]/best`,
      "--merge-output-format", "mp4",
      "-o", videoPath,
      "--no-playlist",
      "--no-warnings",
      url,
    ],
    { timeout: TIMEOUT_MS }
  );

  const uploaderPromise = execFileAsync(
    "yt-dlp",
    ["--print", "%(uploader)s", "--no-download", "--no-warnings", url],
    { timeout: 15_000 }
  ).then(({ stdout }) => stdout.trim() || null)
   .catch(() => null);

  const [, uploader] = await Promise.all([downloadPromise, uploaderPromise]);

  // Verify the file exists and isn't too large
  const stat = await fs.stat(videoPath);
  if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
    await fs.unlink(videoPath).catch(() => {});
    throw new Error(`Video exceeds ${MAX_SIZE_MB}MB limit`);
  }

  // Extract the best thumbnail by sampling multiple frames and picking
  // the one with the most visual detail (largest file = more color/detail,
  // less likely to be a black screen or text overlay).
  let thumbnailPath: string | null = null;
  try {
    await checkBinary("ffmpeg");

    // Get video duration
    const { stdout: durationOut } = await execFileAsync(
      "ffmpeg",
      ["-i", videoPath, "-f", "null", "-"],
      { timeout: 10_000 }
    ).catch(() => ({ stdout: "" }));

    // Try ffprobe for duration
    let duration = 0;
    try {
      const { stdout: probeOut } = await execFileAsync(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
        { timeout: 10_000 }
      );
      duration = parseFloat(probeOut.trim()) || 0;
    } catch {
      // Fall back to a reasonable default
      duration = 30;
    }

    // Sample at 20%, 40%, 60%, 80% through the video
    const samplePoints = [0.2, 0.4, 0.6, 0.8]
      .map((pct) => Math.max(0.5, Math.floor(duration * pct)));
    const candidatePaths: string[] = [];

    await Promise.all(
      samplePoints.map(async (sec, i) => {
        const p = path.join(tmpdir(), `${id}-thumb-${i}.jpg`);
        candidatePaths.push(p);
        try {
          await execFileAsync(
            "ffmpeg",
            ["-i", videoPath, "-ss", String(sec), "-vframes", "1", "-q:v", "2", p],
            { timeout: 10_000 }
          );
        } catch {}
      })
    );

    // Pick the largest file (most visual detail)
    let bestPath: string | null = null;
    let bestSize = 0;
    for (const p of candidatePaths) {
      try {
        const s = await fs.stat(p);
        if (s.size > bestSize) {
          bestSize = s.size;
          bestPath = p;
        }
      } catch {}
    }

    thumbnailPath = bestPath;

    // Clean up non-selected candidates
    for (const p of candidatePaths) {
      if (p !== bestPath) await fs.unlink(p).catch(() => {});
    }
  } catch {
    thumbnailPath = null;
  }

  return { videoPath, thumbnailPath, mimeType: "video/mp4", uploader };
}

/** Remove temp files created by downloadVideo. */
export async function cleanupDownload(result: DownloadResult): Promise<void> {
  await fs.unlink(result.videoPath).catch(() => {});
  if (result.thumbnailPath) {
    await fs.unlink(result.thumbnailPath).catch(() => {});
  }
}
