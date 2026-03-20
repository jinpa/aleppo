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
    await execFileAsync(name, ["--version"]);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`${name} is not installed`);
    }
  }
}

const YT_DLP_PATH = path.join(tmpdir(), "yt-dlp");
let ytDlpReady = false;

/**
 * Ensure a recent yt-dlp binary is available.
 * The apt/brew version is often too old for TikTok, so we download
 * the latest standalone binary from GitHub if the system one fails.
 */
/**
 * Ensure a recent yt-dlp binary is available.
 * The apt version is often too old for TikTok, so we download
 * the latest standalone binary from GitHub if needed.
 * The binary persists in /tmp for the lifetime of the container.
 */
let resolvedYtDlp: string | null = null;

async function ensureYtDlp(): Promise<string> {
  // Already resolved this container lifetime
  if (resolvedYtDlp) {
    // Verify it still exists (shouldn't disappear, but just in case)
    try {
      await fs.access(resolvedYtDlp);
      return resolvedYtDlp;
    } catch {
      resolvedYtDlp = null;
    }
  }

  // 1. Check for previously downloaded binary in /tmp
  try {
    await fs.access(YT_DLP_PATH);
    await execFileAsync(YT_DLP_PATH, ["--version"]);
    resolvedYtDlp = YT_DLP_PATH;
    return YT_DLP_PATH;
  } catch {}

  // 2. Try system yt-dlp
  try {
    await execFileAsync("yt-dlp", ["--version"]);
    resolvedYtDlp = "yt-dlp";
    return "yt-dlp";
  } catch {}

  // 3. Download latest standalone binary from GitHub
  console.log("[video-downloader] Downloading latest yt-dlp binary...");
  try {
    const res = await fetch(
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(YT_DLP_PATH, buffer, { mode: 0o755 });
    resolvedYtDlp = YT_DLP_PATH;
    console.log("[video-downloader] yt-dlp downloaded to", YT_DLP_PATH);
    return YT_DLP_PATH;
  } catch (err) {
    throw new Error(
      `yt-dlp is not installed and failed to download: ${err instanceof Error ? err.message : err}`
    );
  }
}

/**
 * Download a video from a supported platform using yt-dlp.
 * Returns paths to the downloaded video and an extracted thumbnail.
 * Caller is responsible for cleaning up the temp files.
 */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  const ytdlp = await ensureYtDlp();

  const id = randomUUID();
  const videoPath = path.join(tmpdir(), `${id}.mp4`);

  // Download video and extract uploader metadata in parallel
  const downloadPromise = execFileAsync(
    ytdlp,
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
    ytdlp,
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
