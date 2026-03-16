/**
 * POST /api/import/file/save
 *
 * Unified file import save endpoint. Re-parses the uploaded file, processes
 * selected recipes (photo uploads, DB insert), and writes audit rows.
 * For Aleppo format: also inserts cook logs with ID remapping.
 */

import { NextResponse } from "next/server";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes, recipeImports, cookLogs } from "@/db/schema";
import { parseImportFile } from "@/lib/import-parser";
import { mapConcurrent, uploadImportPhoto } from "@/lib/import-utils";
import { buildRecipeValues as buildPaprikaValues, uploadPaprikaPhoto } from "@/lib/paprika-parser";
import { buildRecipeValues as buildMelaValues } from "@/lib/mela-parser";
import { buildRecipeValues as buildAleppoValues, getCookLogs, parseAleppoJson } from "@/lib/aleppo-parser";
import type { PaprikaRecipeJson } from "@/lib/paprika-parser";
import type { MelaRecipeJson } from "@/lib/mela-parser";
import type { AleppoExportV1 } from "@aleppo/shared";

export const maxDuration = 300;

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const PHOTO_CONCURRENCY = 10;
const BATCH = 50;

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

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!selectedUidsRaw) return NextResponse.json({ error: "No recipes selected" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });

  const selectedUids = new Set<string>(JSON.parse(selectedUidsRaw));
  const isPublic = isPublicRaw === "true";
  if (selectedUids.size === 0) return NextResponse.json({ error: "No recipes selected" }, { status: 400 });

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseImportFile(buffer, file.name);
  } catch {
    return NextResponse.json({ error: "Could not parse file." }, { status: 400 });
  }

  type ProcessedRecipe =
    | { ok: true; uid: string; values: Record<string, unknown> }
    | { ok: false; uid: string; error: string };

  let processed: ProcessedRecipe[];

  switch (parsed.format) {
    case "paprika": {
      const allRecipes = parsed._raw as PaprikaRecipeJson[];
      const selected = allRecipes.filter((r) => selectedUids.has(r.uid));
      processed = await mapConcurrent(selected, PHOTO_CONCURRENCY, async (r) => {
        try {
          const imageUrl = r.photo_data?.trim()
            ? await uploadPaprikaPhoto(r.photo_data, userId)
            : null;
          return { ok: true, uid: r.uid, values: buildPaprikaValues(r, userId, isPublic, imageUrl) };
        } catch (err) {
          return { ok: false, uid: r.uid, error: err instanceof Error ? err.message : "Unknown error" };
        }
      });
      break;
    }
    case "mela": {
      const allRecipes = parsed._raw as MelaRecipeJson[];
      const selected = allRecipes.filter(
        (r) => selectedUids.has(r.id ?? r.title ?? "")
      );
      processed = await mapConcurrent(selected, PHOTO_CONCURRENCY, async (r) => {
        try {
          const values = await buildMelaValues(r, userId, isPublic);
          return { ok: true, uid: r.id ?? r.title ?? "", values };
        } catch (err) {
          return { ok: false, uid: r.id ?? r.title ?? "", error: err instanceof Error ? err.message : "Unknown error" };
        }
      });
      break;
    }
    case "aleppo": {
      const data = parsed._raw as AleppoExportV1;
      const selected = data.recipes.filter((r) => selectedUids.has(r._exportId));
      processed = await mapConcurrent(selected, PHOTO_CONCURRENCY, async (r) => {
        try {
          const values = await buildAleppoValues(r, userId, isPublic);
          return { ok: true, uid: r._exportId, values };
        } catch (err) {
          return { ok: false, uid: r._exportId, error: err instanceof Error ? err.message : "Unknown error" };
        }
      });
      break;
    }
  }

  const successes = processed.filter((p): p is Extract<ProcessedRecipe, { ok: true }> => p.ok);
  const failures = processed.filter((p): p is Extract<ProcessedRecipe, { ok: false }> => !p.ok);

  // Bulk insert in batches
  let saved = 0;
  const exportIdToNewId = new Map<string, string>();

  for (let i = 0; i < successes.length; i += BATCH) {
    const batch = successes.slice(i, i + BATCH);
    const inserted = await db
      .insert(recipes)
      .values(batch.map((p) => p.values as any))
      .returning({ id: recipes.id });

    await db.insert(recipeImports).values(
      inserted.map((row, idx) => ({
        userId,
        recipeId: row.id,
        importType: parsed.format,
        sourceUrl: (batch[idx].values as any).sourceUrl ?? null,
        rawPayload: { uid: batch[idx].uid },
        status: "saved",
      }))
    );

    // Track ID mapping for cook log insertion
    inserted.forEach((row, idx) => {
      exportIdToNewId.set(batch[idx].uid, row.id);
    });

    saved += inserted.length;
  }

  // Insert cook logs for Aleppo format
  let cookLogsSaved = 0;
  if (parsed.format === "aleppo") {
    const data = parsed._raw as AleppoExportV1;
    const logs = getCookLogs(data).filter(
      (l) => exportIdToNewId.has(l._recipeExportId)
    );

    if (logs.length > 0) {
      for (let i = 0; i < logs.length; i += BATCH) {
        const batch = logs.slice(i, i + BATCH);
        const inserted = await db
          .insert(cookLogs)
          .values(
            batch.map((l) => ({
              recipeId: exportIdToNewId.get(l._recipeExportId)!,
              userId,
              cookedOn: l.cookedOn,
              notes: l.notes,
              rating: l.rating,
            }))
          )
          .returning({ id: cookLogs.id });
        cookLogsSaved += inserted.length;
      }
    }
  }

  return NextResponse.json({
    saved,
    failed: failures.length,
    cookLogsSaved,
    format: parsed.format,
    ...(failures.length > 0 && {
      errors: failures.map((f) => `${f.uid}: ${f.error}`),
    }),
  });
}
