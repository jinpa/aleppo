import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import path from "path";
import fs from "fs/promises";
import { getYouTubePoToken } from "./youtube-po-token";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 60_000;
const MAX_SIZE_MB = 50;

/**
 * Build env with node's directory explicitly in PATH.
 * yt-dlp's standalone binary uses shutil.which() to find JS runtimes
 * for solving YouTube's n-parameter challenge. On Railway/Nixpacks,
 * node may be in a non-standard location that the binary can't find.
 */
function ytDlpEnv(): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(process.execPath);
  const tmp = tmpdir();
  const currentPath = process.env.PATH ?? "";
  // Add both node's real directory AND /tmp (where the symlink lives)
  const dirs = [nodeDir, tmp];
  const parts = currentPath.split(":");
  const missing = dirs.filter((d) => !parts.includes(d));
  const newPath = missing.length ? `${missing.join(":")}:${currentPath}` : currentPath;
  console.log(`[video-downloader] node at: ${process.execPath}, PATH: ${newPath.slice(0, 200)}`);
  return { ...process.env, PATH: newPath };
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /youtube\.com|youtu\.be/i.test(host);
  } catch {
    return false;
  }
}

/**
 * If the URL is YouTube, try to get PO token args for yt-dlp.
 * Returns extra args to prepend, or an empty array.
 */
async function getYouTubeArgs(url: string): Promise<string[]> {
  if (!isYouTubeUrl(url)) return [];
  const token = await getYouTubePoToken();
  if (!token) return [];
  return [
    "--extractor-args",
    `youtube:player-client=web;po_token=web.player+${token.poToken};visitor_data=${token.visitorData};player_skip=webpage,configs`,
  ];
}

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
const NODE_SYMLINK_PATH = path.join(tmpdir(), "node");

/**
 * Ensure a `node` symlink exists in /tmp so yt-dlp can find it.
 * yt-dlp's standalone binary searches for JS runtimes (node, deno, etc.)
 * to solve YouTube's n-parameter challenge. On Railway/Nixpacks, node
 * is in a non-standard location the binary can't discover.
 */
async function ensureNodeSymlink(): Promise<void> {
  try {
    const target = await fs.readlink(NODE_SYMLINK_PATH);
    if (target === process.execPath) return; // already correct
  } catch {}
  try {
    await fs.unlink(NODE_SYMLINK_PATH).catch(() => {});
    await fs.symlink(process.execPath, NODE_SYMLINK_PATH);
    console.log(`[video-downloader] Created node symlink: ${NODE_SYMLINK_PATH} -> ${process.execPath}`);
  } catch (err) {
    console.warn(`[video-downloader] Failed to create node symlink:`, err instanceof Error ? err.message : err);
  }
}

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
    const { stdout: ver } = await execFileAsync(YT_DLP_PATH, ["--version"]);
    console.log("[video-downloader] Using cached yt-dlp version:", ver.trim());
    resolvedYtDlp = YT_DLP_PATH;
    return YT_DLP_PATH;
  } catch {}

  // 2. Try system yt-dlp
  try {
    const { stdout: ver } = await execFileAsync("yt-dlp", ["--version"]);
    console.log("[video-downloader] Using system yt-dlp version:", ver.trim());
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

export type VideoMeta = {
  duration: number | null;    // seconds
  filesize: number | null;    // bytes (estimate)
  description: string;
  uploader: string | null;
};

const MAX_DURATION_SECONDS = 300; // 5 minutes

/**
 * Fetch video metadata without downloading.
 * Returns duration, estimated filesize, description, and uploader.
 */
export async function getVideoMeta(url: string): Promise<VideoMeta> {
  const [ytdlp] = await Promise.all([ensureYtDlp(), ensureNodeSymlink()]);
  try {
    const ytArgs = await getYouTubeArgs(url);
    const { stdout } = await execFileAsync(
      ytdlp,
      [
        ...ytArgs,
        "--print", "%(duration)s\t%(filesize_approx)s\t%(uploader)s",
        "--no-download", "--no-warnings", url,
      ],
      { timeout: 15_000, env: ytDlpEnv() }
    );
    const [durStr, sizeStr, uploader] = stdout.trim().split("\t");
    const duration = parseFloat(durStr) || null;
    const filesize = parseFloat(sizeStr) || null;

    // Get description separately (can contain tabs/newlines)
    const { stdout: desc } = await execFileAsync(
      ytdlp,
      [...ytArgs, "--print", "%(description)s", "--no-download", "--no-warnings", url],
      { timeout: 15_000, env: ytDlpEnv() }
    );

    return {
      duration,
      filesize,
      description: desc.trim(),
      uploader: uploader && uploader !== "NA" ? uploader : null,
    };
  } catch {
    return { duration: null, filesize: null, description: "", uploader: null };
  }
}

/**
 * Extract recipe URLs from a video description.
 */
export function extractUrlsFromDescription(description: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
  return (description.match(urlPattern) ?? []).filter((u) => {
    try {
      const host = new URL(u).hostname;
      const skip = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|twitter\.com|x\.com|facebook\.com|linktr\.ee/i;
      return !skip.test(host);
    } catch {
      return false;
    }
  });
}

/**
 * Download a video from a supported platform using yt-dlp.
 * Caller is responsible for cleaning up the temp files.
 */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  const [ytdlp, , ytArgs] = await Promise.all([
    ensureYtDlp(), ensureNodeSymlink(), getYouTubeArgs(url),
  ]);

  const id = randomUUID();
  const videoPath = path.join(tmpdir(), `${id}.mp4`);

  try {
    const { stderr } = await execFileAsync(
      ytdlp,
      [
        ...ytArgs,
        "-f", `best[vcodec^=h264][filesize<${MAX_SIZE_MB}M][ext=mp4]/best[vcodec^=h264][ext=mp4]/best[ext=mp4]/best`,
        "--merge-output-format", "mp4",
        "-o", videoPath,
        "--no-playlist",
        "--verbose",
        url,
      ],
      { timeout: TIMEOUT_MS, env: ytDlpEnv() }
    );
    if (stderr) console.log("[video-downloader] yt-dlp stderr:", stderr.slice(0, 2000));
  } catch (err: any) {
    // Log verbose output from stderr on failure for debugging
    if (err.stderr) console.log("[video-downloader] yt-dlp verbose stderr:", err.stderr.slice(0, 3000));
    throw err;
  }

  // Verify the file exists and isn't too large
  const stat = await fs.stat(videoPath);
  if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
    await fs.unlink(videoPath).catch(() => {});
    throw new Error(`Video exceeds ${MAX_SIZE_MB}MB limit`);
  }

  return { videoPath, thumbnailPath: null, mimeType: "video/mp4", uploader: null };
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
