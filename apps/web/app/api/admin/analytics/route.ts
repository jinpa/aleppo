import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days")) || 90, 365);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [
    importsByType,
    importsByStatus,
    topSourceDomains,
    failedImportErrors,
    newUsersOverTime,
    cookLogsOverTime,
    recipesOverTime,
    activeUsers,
    importsVsSaved,
    imageSourceTypes,
  ] = await Promise.all([
    // Import count by type
    db.execute(sql`
      SELECT "importType" as type, count(*)::int as count
      FROM "recipeImports"
      WHERE "createdAt" >= ${cutoff}::timestamp
      GROUP BY "importType"
      ORDER BY count DESC
    `),

    // Import success vs failure
    db.execute(sql`
      SELECT "importType" as type, status, count(*)::int as count
      FROM "recipeImports"
      WHERE "createdAt" >= ${cutoff}::timestamp
      GROUP BY "importType", status
      ORDER BY "importType", status
    `),

    // Top source domains (from sourceUrl)
    db.execute(sql`
      SELECT
        CASE
          WHEN "sourceUrl" IS NULL THEN '(no url)'
          ELSE split_part(split_part("sourceUrl", '://', 2), '/', 1)
        END as domain,
        "importType" as type,
        count(*)::int as count
      FROM "recipeImports"
      WHERE "createdAt" >= ${cutoff}::timestamp
        AND "sourceUrl" IS NOT NULL
      GROUP BY domain, "importType"
      ORDER BY count DESC
      LIMIT 30
    `),

    // Top error messages
    db.execute(sql`
      SELECT "importType" as type, "errorMessage" as error, count(*)::int as count
      FROM "recipeImports"
      WHERE "createdAt" >= ${cutoff}::timestamp
        AND status = 'failed'
        AND "errorMessage" IS NOT NULL
      GROUP BY "importType", "errorMessage"
      ORDER BY count DESC
      LIMIT 20
    `),

    // New users per week
    db.execute(sql`
      SELECT date_trunc('week', "createdAt")::date as week, count(*)::int as count
      FROM users
      WHERE "createdAt" >= ${cutoff}::timestamp
      GROUP BY week
      ORDER BY week
    `),

    // Cook logs per week
    db.execute(sql`
      SELECT date_trunc('week', "createdAt")::date as week, count(*)::int as count
      FROM "cookLogs"
      WHERE "createdAt" >= ${cutoff}::timestamp
      GROUP BY week
      ORDER BY week
    `),

    // Recipes created per week
    db.execute(sql`
      SELECT date_trunc('week', "createdAt")::date as week, count(*)::int as count
      FROM recipes
      WHERE "createdAt" >= ${cutoff}::timestamp
      GROUP BY week
      ORDER BY week
    `),

    // Active users (last 7 and 30 days)
    db.execute(sql`
      SELECT
        (SELECT count(DISTINCT "userId")::int FROM "cookLogs" WHERE "createdAt" >= now() - interval '7 days') as "cookLast7d",
        (SELECT count(DISTINCT "userId")::int FROM "cookLogs" WHERE "createdAt" >= now() - interval '30 days') as "cookLast30d",
        (SELECT count(DISTINCT "userId")::int FROM "recipeImports" WHERE "createdAt" >= now() - interval '7 days') as "importLast7d",
        (SELECT count(DISTINCT "userId")::int FROM "recipeImports" WHERE "createdAt" >= now() - interval '30 days') as "importLast30d"
    `),

    // Imports vs saved recipes (recipeId non-null = saved)
    db.execute(sql`
      SELECT "importType" as type,
        count(*)::int as imports,
        count("recipeId")::int as saved
      FROM "recipeImports"
      WHERE "createdAt" >= ${cutoff}::timestamp
      GROUP BY "importType"
      ORDER BY imports DESC
    `),

    // Image source type breakdown (dish_photo vs recipe_text)
    db.execute(sql`
      SELECT "rawPayload"->>'imageSourceType' as "sourceType", count(*)::int as count
      FROM "recipeImports"
      WHERE "createdAt" >= ${cutoff}::timestamp
        AND "importType" = 'image'
        AND "rawPayload"->>'imageSourceType' IS NOT NULL
      GROUP BY "sourceType"
      ORDER BY count DESC
    `),
  ]);

  return NextResponse.json({
    days,
    importsByType,
    importsByStatus,
    topSourceDomains,
    failedImportErrors,
    newUsersOverTime,
    cookLogsOverTime,
    recipesOverTime,
    activeUsers: activeUsers[0] ?? {},
    importsVsSaved,
    imageSourceTypes,
  });
}
