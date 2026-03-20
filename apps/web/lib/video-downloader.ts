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
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new Error(`${name} is not installed`);
    }
  }
}

const YT_DLP_PATH = path.join(tmpdir(), "yt-dlp");
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

  return { videoPath, thumbnailPath: null, mimeType: "video/mp4", uploader };
}

/**
 * Extract a single frame from a video at a given timestamp.
 * If no timestamp is provided, defaults to 80% through the video.
 * Returns the path to the extracted JPEG, or null on failure.
 */
export async function extractFrame(
  videoPath: string,
  timestampSeconds?: number
): Promise<string | null> {
  try {
    await checkBinary("ffmpeg");
  } catch {
    return null;
  }

  // Get video duration so we can clamp the timestamp
  let duration = 30;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath],
      { timeout: 10_000 }
    );
    duration = parseFloat(stdout.trim()) || 30;
  } catch {}

  let seekTo: number;
  if (timestampSeconds != null && timestampSeconds >= 0) {
    // Clamp to video duration (with small margin to avoid seeking past end)
    seekTo = Math.min(timestampSeconds, Math.max(0, duration - 0.5));
  } else {
    // Default to 80% through the video
    seekTo = Math.max(0.5, Math.floor(duration * 0.8));
  }
  console.log(`[video-downloader] extractFrame: requested=${timestampSeconds}s, duration=${duration}s, seekTo=${seekTo}s`);

  const framePath = path.join(tmpdir(), `${randomUUID()}-frame.jpg`);
  try {
    await execFileAsync(
      "ffmpeg",
      ["-i", videoPath, "-ss", String(seekTo), "-vframes", "1", "-q:v", "2", framePath],
      { timeout: 10_000 }
    );
    await fs.stat(framePath); // verify it was created
    return framePath;
  } catch {
    await fs.unlink(framePath).catch(() => {});
    return null;
  }
}

/** Remove temp files created by downloadVideo. */
export async function cleanupDownload(result: DownloadResult): Promise<void> {
  await fs.unlink(result.videoPath).catch(() => {});
  if (result.thumbnailPath) {
    await fs.unlink(result.thumbnailPath).catch(() => {});
  }
}
