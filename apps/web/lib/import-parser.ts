/**
 * Unified import file parser — detects format from filename and delegates
 * to the appropriate format-specific parser.
 */

import type { ImportFormat } from "@aleppo/shared";
import type { ImportPreviewItem } from "@/lib/import-utils";

import * as paprika from "@/lib/paprika-parser";
import * as mela from "@/lib/mela-parser";
import * as aleppoParser from "@/lib/aleppo-parser";

export type ParseResult = {
  format: ImportFormat;
  items: ImportPreviewItem[];
  /** Raw parsed data — kept for the save step so we don't re-parse */
  _raw: unknown;
};

/** Detect import format from filename extension. */
export function detectFormat(filename: string): ImportFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".aleppo.json")) return "aleppo";
  if (lower.endsWith(".paprikarecipes")) return "paprika";
  if (lower.endsWith(".melarecipes")) return "mela";
  return null;
}

/** Parse an import file buffer and return unified preview items. */
export function parseImportFile(buffer: Buffer, filename: string): ParseResult {
  const format = detectFormat(filename);
  if (!format) {
    throw new Error(
      "Unsupported file format. Supported: .paprikarecipes, .melarecipes, .aleppo.json"
    );
  }

  switch (format) {
    case "paprika": {
      const recipes = paprika.parseZipBuffer(buffer);
      return {
        format,
        items: recipes.map(paprika.toPreviewItem),
        _raw: recipes,
      };
    }
    case "mela": {
      const recipes = mela.parseZipBuffer(buffer);
      return {
        format,
        items: recipes.map(mela.toPreviewItem),
        _raw: recipes,
      };
    }
    case "aleppo": {
      const data = aleppoParser.parseAleppoJson(buffer);
      return {
        format,
        items: data.recipes.map(aleppoParser.toPreviewItem),
        _raw: data,
      };
    }
  }
}
