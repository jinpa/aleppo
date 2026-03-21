import { NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import type { RecipeImage } from "@aleppo/shared";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/** Collect all R2 keys referenced by recipes in the database. */
async function getReferencedKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  const prefix = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/` : null;

  const rows = await db
    .select({ imageUrl: recipes.imageUrl, images: recipes.images })
    .from(recipes);

  for (const row of rows) {
    if (row.imageUrl && prefix && row.imageUrl.startsWith(prefix)) {
      keys.add(row.imageUrl.slice(prefix.length));
    }
    if (Array.isArray(row.images)) {
      for (const img of row.images as RecipeImage[]) {
        if (img.url && prefix && img.url.startsWith(prefix)) {
          keys.add(img.url.slice(prefix.length));
        }
      }
    }
  }

  return keys;
}

/** List all object keys in the R2 bucket under recipes/. */
async function listAllR2Keys(): Promise<{ key: string; size: number }[]> {
  const client = getR2Client();
  const objects: { key: string; size: number }[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: "recipes/",
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) {
        objects.push({ key: obj.Key, size: obj.Size ?? 0 });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

/**
 * GET — Scan for orphan R2 objects (in bucket but not referenced by any recipe).
 * Returns { orphans: [{ key, size }], totalObjects, referencedCount, orphanBytes }.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [allObjects, referencedKeys] = await Promise.all([
    listAllR2Keys(),
    getReferencedKeys(),
  ]);

  const orphans = allObjects.filter((obj) => !referencedKeys.has(obj.key));
  const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0);

  return NextResponse.json({
    totalObjects: allObjects.length,
    referencedCount: referencedKeys.size,
    orphanCount: orphans.length,
    orphanBytes,
    orphans: orphans.map((o) => ({ key: o.key, size: o.size })),
  });
}

/**
 * DELETE — Delete orphan R2 objects. Accepts { keys: string[] } in the body.
 * If no body, deletes all orphans found by scanning.
 */
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let keysToDelete: string[];

  try {
    const body = await req.json();
    keysToDelete = Array.isArray(body.keys) ? body.keys : [];
  } catch {
    // No body — scan and delete all orphans
    const [allObjects, referencedKeys] = await Promise.all([
      listAllR2Keys(),
      getReferencedKeys(),
    ]);
    keysToDelete = allObjects
      .filter((obj) => !referencedKeys.has(obj.key))
      .map((obj) => obj.key);
  }

  if (keysToDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  // S3 DeleteObjects accepts max 1000 keys per request
  const client = getR2Client();
  let deleted = 0;
  for (let i = 0; i < keysToDelete.length; i += 1000) {
    const batch = keysToDelete.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: batch.map((key) => ({ Key: key })) },
      })
    );
    deleted += batch.length;
  }

  return NextResponse.json({ deleted });
}
