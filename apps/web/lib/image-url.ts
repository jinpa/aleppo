const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)(\?.*)?$/i;

const IMAGE_HOSTS = [
  /\.cdninstagram\.com/i,
  /\.pinimg\.com/i,
  /\.imgur\.com/i,
  /i\.redd\.it/i,
];

export function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (IMAGE_EXTENSIONS.test(parsed.pathname)) return true;
    return IMAGE_HOSTS.some((p) => p.test(parsed.hostname));
  } catch {
    return false;
  }
}
