import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "aleppo-images";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

export async function uploadImageToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );
}

/** Extract R2 object key from a full public URL. Returns null if not an R2 URL. */
export function r2KeyFromUrl(url: string): string | null {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) return null;
  return url.slice(R2_PUBLIC_URL.length + 1); // strip trailing "/"
}

/** Delete an R2 object by its public URL. No-op if not an R2 URL or R2 is not configured. */
export async function deleteR2ByUrl(url: string): Promise<void> {
  const key = r2KeyFromUrl(url);
  if (key) await deleteFromR2(key);
}

/**
 * Fetches an image from a remote URL, resizes it, and uploads to R2.
 * Returns the R2 public URL, or the original URL if R2 is not configured or the fetch fails.
 */
export async function reuploadImageToR2(
  sourceUrl: string,
  userId: string
): Promise<string> {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return sourceUrl;
  }
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return sourceUrl;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return sourceUrl;
    const buffer = Buffer.from(await res.arrayBuffer());
    const processed = await sharp(buffer)
      .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const key = `recipes/${userId}/${Date.now()}.webp`;
    return await uploadImageToR2(processed, key, "image/webp");
  } catch {
    return sourceUrl;
  }
}

export async function listStorageByUser(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let continuationToken: string | undefined;
  do {
    const res = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: "recipes/",
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      const userId = obj.Key?.split("/")[1];
      if (userId && obj.Size) {
        map.set(userId, (map.get(userId) ?? 0) + obj.Size);
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return map;
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}
