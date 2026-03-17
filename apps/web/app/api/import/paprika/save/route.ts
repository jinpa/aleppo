/**
 * POST /api/import/paprika/save
 *
 * Accepts the .paprikarecipes file plus the user's selection (UIDs + privacy setting),
 * then uploads photos to R2 and saves selected recipes to the DB.
 *
 * Runs with a generous timeout since bulk imports with many photos can take ~30s.
 */

import { NextResponse } from "next/server";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes, recipeImports } from "@/db/schema";
import {
  parseZipBuffer,
  buildRecipeValues,
  uploadPaprikaPhoto,
  mapConcurrent,
} from "@/lib/paprika-parser";

export const maxDuration = 300; // 5 minutes — Railway has no serverless cold limits

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PHOTO_CONCURRENCY = 10;

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const selectedUidsRaw = formData.get("selectedUids") as string | null;
  const isPublicRaw = formData.get("isPublic") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!selectedUidsRaw) {
    return NextResponse.json({ error: "No recipes selected" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
  }

  const selectedUids = new Set<string>(JSON.parse(selectedUidsRaw));
  const isPublic = isPublicRaw === "true";

  if (selectedUids.size === 0) {
    return NextResponse.json({ error: "No recipes selected" }, { status: 400 });
  }

  // Re-parse the file to get full recipe data (including photo_data)
  let allRecipes;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    allRecipes = parseZipBuffer(buffer);
  } catch (err) {
    return NextResponse.json({ error: `Could not parse file: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }

  const selected = allRecipes.filter((r) => selectedUids.has(r.uid));

  // Process each recipe: upload photo + build insert values
  type ProcessedRecipe =
    | { ok: true; uid: string; values: ReturnType<typeof buildRecipeValues> }
    | { ok: false; uid: string; error: string };

  const processed = await mapConcurrent<
    (typeof selected)[number],
    ProcessedRecipe
  >(selected, PHOTO_CONCURRENCY, async (r) => {
    try {
      const imageUrl =
        r.photo_data?.trim()
          ? await uploadPaprikaPhoto(r.photo_data, userId)
          : null;
      const values = buildRecipeValues(r, userId, isPublic, imageUrl);
      return { ok: true, uid: r.uid, values };
    } catch (err) {
      return {
        ok: false,
        uid: r.uid,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  const successes = processed.filter((p): p is Extract<ProcessedRecipe, { ok: true }> => p.ok);
  const failures = processed.filter((p): p is Extract<ProcessedRecipe, { ok: false }> => !p.ok);

  // Bulk insert in batches of 50 to avoid overly large SQL statements
  const BATCH = 50;
  let saved = 0;

  for (let i = 0; i < successes.length; i += BATCH) {
    const batch = successes.slice(i, i + BATCH);

    const inserted = await db
      .insert(recipes)
      .values(batch.map((p) => p.values))
      .returning({ id: recipes.id });

    // Write import audit rows
    await db.insert(recipeImports).values(
      inserted.map((row, idx) => ({
        userId,
        recipeId: row.id,
        importType: "paprika",
        sourceUrl: batch[idx].values.sourceUrl,
        rawPayload: { uid: batch[idx].uid },
        status: "saved",
      }))
    );

    saved += inserted.length;
  }

  return NextResponse.json({
    saved,
    failed: failures.length,
    ...(failures.length > 0 && {
      errors: failures.map((f) => `${f.uid}: ${f.error}`),
    }),
  });
}
