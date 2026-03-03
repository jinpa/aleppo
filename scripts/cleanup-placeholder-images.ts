/**
 * Delete all recipes whose imageUrl points to placehold.co (bad local-dev fallback).
 * Run with: npx tsx --env-file=.env.local scripts/cleanup-placeholder-images.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { recipes } from "../db/schema";
import { like } from "drizzle-orm";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  const result = await db
    .delete(recipes)
    .where(like(recipes.imageUrl, "%placehold.co%"))
    .returning({ id: recipes.id, title: recipes.title });

  console.log(`Deleted ${result.length} recipes with placehold.co image URLs.`);
  if (result.length > 0) {
    console.log("Sample:", result.slice(0, 5).map((r) => r.title).join(", "));
  }

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
