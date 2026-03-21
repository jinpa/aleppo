import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 60_000;
const MAX_SIZE_MB = 50;

/**
 * Extract a YouTube video ID from various URL formats:
 *   youtube.com/watch?v=ID, youtube.com/shorts/ID, youtu.be/ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (/youtube\.com/i.test(parsed.hostname)) {
      // /watch?v=ID
      const v = parsed.searchParams.get("v");
      if (v) return v;
      // /shorts/ID or /embed/ID
      const seg = parsed.pathname.split("/").filter(Boolean);
      if ((seg[0] === "shorts" || seg[0] === "embed") && seg[1]) return seg[1];
    }
  } catch {}
  return null;
}

/**
 * Fetch a YouTube video's description via the YouTube Data API v3.
 * Requires YOUTUBE_API_KEY env var. Returns null if the key is missing or the call fails.
 */
export async function fetchYouTubeDescription(url: string): Promise<{
  description: string;
  uploader: string | null;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[video-downloader] YOUTUBE_API_KEY not set, skipping YouTube description fetch");
    return null;
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    console.warn("[video-downloader] Could not extract video ID from YouTube URL:", url);
    return null;
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[video-downloader] YouTube Data API failed: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const snippet = data?.items?.[0]?.snippet;
    if (!snippet) {
      console.warn("[video-downloader] No snippet found for video:", videoId);
      return null;
    }

    const description = snippet.description ?? "";
    const uploader = snippet.channelTitle ?? null;
    console.log(`[video-downloader] YouTube API: description=${description.length} chars, uploader=${uploader}`);
    return { description, uploader };
  } catch (err) {
    console.warn("[video-downloader] YouTube Data API call failed:", err instanceof Error ? err.message : err);
    return null;
  }
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
  const ytdlp = await ensureYtDlp();
  try {
    const { stdout } = await execFileAsync(
      ytdlp,
      [
        "--print", "%(duration)s\t%(filesize_approx)s\t%(uploader)s",
        "--no-download", "--no-warnings", url,
      ],
      { timeout: 15_000 }
    );
    const [durStr, sizeStr, uploader] = stdout.trim().split("\t");
    const duration = parseFloat(durStr) || null;
    const filesize = parseFloat(sizeStr) || null;

    // Get description separately (can contain tabs/newlines)
    const { stdout: desc } = await execFileAsync(
      ytdlp,
      ["--print", "%(description)s", "--no-download", "--no-warnings", url],
      { timeout: 15_000 }
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
 * Prioritizes URLs that appear near recipe-related text or have recipe-like paths.
 */
export function extractUrlsFromDescription(description: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;
  const skip = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|linktr\.ee|t\.co/i;

  const urls = (description.match(urlPattern) ?? []).filter((u) => {
    try {
      return !skip.test(new URL(u).hostname);
    } catch {
      return false;
    }
  });

  // Score each URL: higher = more likely to be a recipe link
  const scored = urls.map((u) => {
    let score = 0;
    const lower = u.toLowerCase();

    // URL path contains recipe-related words
    if (/recipe/.test(lower)) score += 3;
    if (/cook|food|meal|dish/.test(lower)) score += 1;

    // Check surrounding description text for context clues
    const idx = description.indexOf(u);
    if (idx >= 0) {
      const before = description.slice(Math.max(0, idx - 60), idx).toLowerCase();
      if (/recipe|full recipe|get the recipe|recipe here/i.test(before)) score += 3;
      if (/link|check out|blog/i.test(before)) score += 1;
    }

    // Penalize short/generic URLs (likely redirects or promos)
    try {
      const path = new URL(u).pathname;
      if (path.split("/").filter(Boolean).length <= 1) score -= 1;
    } catch {}

    return { url: u, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.url);
}

/**
 * Download a video from a supported platform using yt-dlp.
 * Caller is responsible for cleaning up the temp files.
 */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  const ytdlp = await ensureYtDlp();

  const id = randomUUID();
  const videoPath = path.join(tmpdir(), `${id}.mp4`);

  try {
    await execFileAsync(
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
  } catch (err: any) {
    if (err.stderr) console.log("[video-downloader] yt-dlp stderr:", err.stderr.slice(0, 2000));
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
