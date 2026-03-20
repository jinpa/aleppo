const VIDEO_PATTERNS = [
  /tiktok\.com/i,
  /instagram\.com\/(?:reel|reels)\//i,
  /youtube\.com\/shorts\//i,
  /youtu\.be\//i, // short YouTube links can be shorts too
];

export function isVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return VIDEO_PATTERNS.some((p) => p.test(parsed.hostname + parsed.pathname));
  } catch {
    return false;
  }
}

export function videoSourceName(url: string): string | undefined {
  try {
    const host = new URL(url).hostname;
    if (/tiktok\.com/i.test(host)) return "TikTok";
    if (/instagram\.com/i.test(host)) return "Instagram";
    if (/youtube\.com|youtu\.be/i.test(host)) return "YouTube";
  } catch {}
  return undefined;
}
