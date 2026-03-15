# Plan: File Import Formats + Library Export

## Context

The Import screen's "Paprika" tab is too narrow — it only handles one format. Users want to import from other recipe apps and export their Aleppo library as a portable backup they can re-import later.

## Design Decisions

- **Rename "Paprika" segment → "File"** — generalized file-import mode, auto-detecting format from file extension
- **Export lives in Settings** — not in the Import tab. Export is an account/data management action; the Import tab stays focused on bringing data in. No tab rename needed.
- **Images in export: user's choice** — toggle for "Include images" (off by default = small/fast with R2 URLs; on = base64-embedded for full portability). Show estimated size before download.
- **Aleppo JSON format** — versioned export/re-import format with recipes + cook logs + optional embedded images
- **Phase 1 formats**: Paprika (done), Aleppo JSON (new), Mela (new)
- **Unified API route** (`/api/import/file`) — preview/select/save flow is identical across formats, only the parser differs

## Aleppo Export Format (`.aleppo.json`)

```ts
type AleppoExportV1 = {
  version: 1;
  exportedAt: string;               // ISO 8601
  app: "aleppo";
  user: { name: string | null; email: string };
  recipes: AleppoExportRecipe[];    // all user's recipes
  cookLogs: AleppoExportCookLog[];  // optionally included
};

type AleppoExportRecipe = {
  _exportId: string;                // original recipe UUID, for cook log cross-ref
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUrl: string | null;          // R2 URL (when images not embedded)
  imageData: string | null;         // base64 (when images embedded); null otherwise
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  tags: string[];
  isPublic: boolean;
  isAdapted: boolean;
  notes: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  nutritionalInfo: NutritionalInfo | null;
  commentsUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
```

- Cook logs reference recipes via `_recipeExportId`
- Filename: `aleppo-export-YYYY-MM-DD.aleppo.json`
- On re-import with embedded images: upload base64 to R2, use new URL

## Mela Format (`.melarecipes`)

ZIP of JSON files (one per recipe, not gzip-compressed unlike Paprika). Fields: `title`, `text`, `ingredients` (newline-separated), `instructions` (newline-separated), `images` (base64 array), `categories`, `cookTime`, `prepTime`, `yield`, `link`, `notes`.

---

## Step 1: Shared Types — `packages/shared/src/types.ts`

Add `AleppoExportV1`, `AleppoExportRecipe`, `AleppoExportCookLog` types. Add `ImportFormat` type (`"paprika" | "mela" | "aleppo"`).

## Step 2: Extract Shared Parser Utils — `apps/web/lib/import-utils.ts` (new)

Move `parseTimeString()`, `parseServingsNumber()`, `mapConcurrent()` out of `paprika-parser.ts`. Generalize `uploadPaprikaPhoto` → `uploadImportPhoto`. Update `paprika-parser.ts` to import from `import-utils.ts`.

## Step 3: Export Builder + API

**`apps/web/lib/export-builder.ts`** (new): Query all recipes + cook logs for a user. If `includeImages`, fetch each imageUrl and base64-encode it. Build `AleppoExportV1` object.

**`apps/web/app/api/export/route.ts`** (new):
- `GET` — Auth required. Query params: `?includeCookLogs=true&includeImages=false` (defaults).
- Returns JSON with `Content-Disposition: attachment` header.

## Step 4: Aleppo JSON Parser — `apps/web/lib/aleppo-parser.ts` (new)

- Validate JSON (`version === 1`, `app === "aleppo"`)
- `toPreviewItem()` → standard preview shape
- `buildRecipeValues()` → nearly 1:1 field mapping
- If `imageData` present: upload to R2 during save, use returned URL
- Cook log handling: insert recipes first, build exportId→newId map, bulk-insert cook logs

## Step 5: Mela Parser — `apps/web/lib/mela-parser.ts` (new)

- Parse ZIP (no gzip layer unlike Paprika)
- Map Mela fields → standard shapes using shared utils (`parseIngredients`, `parseTimeString`)
- Photo: first entry from `images` base64 array → R2 upload

## Step 6: Unified Parser — `apps/web/lib/import-parser.ts` (new)

- `detectFormat(filename)` — by extension (`.paprikarecipes`, `.melarecipes`, `.aleppo.json`)
- `parseImportFile(buffer, filename)` — delegates to specific parser, returns unified result

## Step 7: Unified Import API — `apps/web/app/api/import/file/` (new)

**`POST /api/import/file`** (preview):
- FormData with `file`, auto-detect format, parse, duplicate detection, return `{ format, recipes: PreviewItem[] }`

**`POST /api/import/file/save`** (bulk save):
- FormData with `file`, `selectedUids`, `isPublic`, `format`
- Upload photos to R2, bulk insert, audit rows
- Aleppo format: also insert cook logs with ID remapping

Existing `/api/import/paprika` routes stay for backward compat.

## Step 8: Client — Generalize File Import — `apps/native/app/(tabs)/import.tsx`

- Replace `"paprika"` mode with `"file"` in Mode type
- Rename segment label "Paprika" → "File"
- File picker accepts `.paprikarecipes`, `.melarecipes`, `.aleppo.json`
- API calls switch to `/api/import/file`
- Show detected format after file selection
- Preview/select/import flow stays structurally identical

## Step 9: Client — Export in Settings — `apps/native/app/settings.tsx`

Add "Data" section (after Recipe Defaults, before Account):
- "Export library" row that expands or navigates to an export view
- Toggles: "Include cook logs" (default on), "Include images" (default off)
- Estimated size indicator (recipe count; "~X MB with images" note)
- "Download backup" button
- On web: fetch `/api/export`, blob URL, `<a download>` click
- On native: fetch, `expo-file-system` write to cache, `expo-sharing` to share
- Success state with recipe count + file size

---

## Files Summary

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add export format types, `ImportFormat` |
| `apps/web/lib/import-utils.ts` | **New** — shared parser utils from paprika-parser |
| `apps/web/lib/paprika-parser.ts` | Refactor to use import-utils |
| `apps/web/lib/mela-parser.ts` | **New** — Mela format parser |
| `apps/web/lib/aleppo-parser.ts` | **New** — Aleppo JSON parser + cook log support |
| `apps/web/lib/import-parser.ts` | **New** — unified entry point, format detection |
| `apps/web/lib/export-builder.ts` | **New** — builds AleppoExportV1 from DB |
| `apps/web/app/api/export/route.ts` | **New** — GET library export |
| `apps/web/app/api/import/file/route.ts` | **New** — POST unified preview |
| `apps/web/app/api/import/file/save/route.ts` | **New** — POST unified save |
| `apps/native/app/(tabs)/import.tsx` | Generalize Paprika → File mode |
| `apps/native/app/settings.tsx` | Add export section |

## Step 10: E2E Tests — `apps/web/tests/e2e/import.spec.ts` + `export.spec.ts`

All tests use the existing Playwright infrastructure (authenticated fixtures, live DB). Test fixture files (sample `.aleppo.json`, `.melarecipes`) are stored in `apps/web/tests/e2e/fixtures/` as static files.

### Test fixtures (static files)

**`apps/web/tests/e2e/fixtures/sample-export.aleppo.json`** — A minimal valid `AleppoExportV1` with 2 recipes + 1 cook log, no embedded images. Used for Aleppo re-import tests.

**`apps/web/tests/e2e/fixtures/sample.melarecipes`** — A ZIP containing 2 Mela JSON recipe files with no images. Used for Mela import tests.

These are committed to the repo so tests are self-contained and don't depend on external services.

### `import.spec.ts` (replaces placeholder)

Uses Alice's authenticated page. Tests interact with the SPA Import tab.

| Test | What it covers |
|------|----------------|
| **File tab is reachable** | Navigate to Import, confirm "File" segment visible (replaces old "Paprika" placeholder test) |
| **Aleppo JSON import — preview** | Upload `sample-export.aleppo.json` via file input, confirm format detected as "Aleppo", preview shows 2 recipes with titles |
| **Aleppo JSON import — save** | Select both recipes, click Import, confirm success message with count, navigate to Recipes tab and verify imported recipes appear |
| **Aleppo JSON import — cook logs** | After import, navigate to an imported recipe's detail page, verify cook log count matches fixture data |
| **Aleppo JSON import — duplicate detection** | Re-upload the same file, confirm duplicate badges appear on preview items |
| **Mela import — preview + save** | Upload `sample.melarecipes`, confirm format detected as "Mela", preview shows recipes, import succeeds |
| **Paprika backward compat** | Upload a `.paprikarecipes` file (generated in-test as a minimal gzipped ZIP), confirm format detected as "Paprika" and preview works |

**Helper functions:**
- `uploadFixtureFile(page, filename)` — sets the file input to a fixture file from `tests/e2e/fixtures/`, triggers change
- `importAndVerify(page, expectedCount)` — selects all, clicks Import, waits for success toast/message

### `export.spec.ts` (new)

Uses Alice's authenticated page. Alice must have at least 1 recipe + 1 cook log (created in a `test.beforeAll` block).

| Test | What it covers |
|------|----------------|
| **Export section visible in Settings** | Navigate to Settings (via profile → Settings), confirm "Export library" row exists |
| **Export downloads valid JSON** | Click "Download backup" with default toggles (cook logs on, images off), intercept the network response, parse JSON, verify `version === 1`, `app === "aleppo"`, `recipes` array is non-empty |
| **Export includes cook logs by default** | Verify downloaded JSON has `cookLogs` array with at least 1 entry |
| **Export without cook logs** | Toggle "Include cook logs" off, download, verify `cookLogs` is empty array |
| **Export → re-import round-trip** | Download export, navigate to Import → File, upload the downloaded file, preview shows recipes, import succeeds, verify new copies exist alongside originals |

**Helper functions:**
- `navigateToSettings(page)` — profile icon → Settings link
- `downloadExport(page, opts?)` — toggles options, clicks download, captures response blob, returns parsed JSON

### Files added

| File | Purpose |
|------|---------|
| `apps/web/tests/e2e/import.spec.ts` | Rewritten — file import tests (Aleppo JSON, Mela, Paprika compat) |
| `apps/web/tests/e2e/export.spec.ts` | **New** — export + round-trip tests |
| `apps/web/tests/e2e/fixtures/sample-export.aleppo.json` | **New** — Aleppo export fixture (2 recipes, 1 cook log) |
| `apps/web/tests/e2e/fixtures/sample.melarecipes` | **New** — Mela ZIP fixture (2 recipes) |

---

## Files Summary (updated)

| File | Change |
|------|--------|
| `packages/shared/src/types.ts` | Add export format types, `ImportFormat` |
| `apps/web/lib/import-utils.ts` | **New** — shared parser utils from paprika-parser |
| `apps/web/lib/paprika-parser.ts` | Refactor to use import-utils |
| `apps/web/lib/mela-parser.ts` | **New** — Mela format parser |
| `apps/web/lib/aleppo-parser.ts` | **New** — Aleppo JSON parser + cook log support |
| `apps/web/lib/import-parser.ts` | **New** — unified entry point, format detection |
| `apps/web/lib/export-builder.ts` | **New** — builds AleppoExportV1 from DB |
| `apps/web/app/api/export/route.ts` | **New** — GET library export |
| `apps/web/app/api/import/file/route.ts` | **New** — POST unified preview |
| `apps/web/app/api/import/file/save/route.ts` | **New** — POST unified save |
| `apps/native/app/(tabs)/import.tsx` | Generalize Paprika → File mode |
| `apps/native/app/settings.tsx` | Add export section |
| `apps/web/tests/e2e/import.spec.ts` | Rewritten — file import E2E tests |
| `apps/web/tests/e2e/export.spec.ts` | **New** — export E2E tests |
| `apps/web/tests/e2e/fixtures/sample-export.aleppo.json` | **New** — test fixture |
| `apps/web/tests/e2e/fixtures/sample.melarecipes` | **New** — test fixture |

## Verification

1. **Export (no images)**: Settings → Export → Download → verify JSON has all recipes + cook logs, URLs intact
2. **Export (with images)**: Toggle on → Download → verify `imageData` fields are base64
3. **Re-import**: Import → File → pick `.aleppo.json` → preview → import → recipes + cook logs appear, images work
4. **Paprika still works**: Import → File → pick `.paprikarecipes` → same flow as before
5. **Mela import**: Import → File → pick `.melarecipes` → preview with duplicate detection → import with photos
6. **Duplicate detection**: Export then re-import same file → duplicates flagged
7. **E2E tests pass**: `pnpm --filter @aleppo/web test:e2e` — all import + export specs green
