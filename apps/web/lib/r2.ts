import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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
