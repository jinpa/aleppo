import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin-auth";

// E2E tests create users with @test.aleppo emails — exclude from analytics
const TEST_EMAIL_PATTERN = "%@test.aleppo";

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
    imageSourceTypes,
  ] = await Promise.all([
    // Import count by type
    db.execute(sql`
      SELECT ri."importType" as type, count(*)::int as count
      FROM "recipeImports" ri
      JOIN users u ON ri."userId" = u.id
      WHERE ri."createdAt" >= ${cutoff}::timestamp
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY ri."importType"
      ORDER BY count DESC
    `),

    // Import success vs failure
    db.execute(sql`
      SELECT ri."importType" as type, ri.status, count(*)::int as count
      FROM "recipeImports" ri
      JOIN users u ON ri."userId" = u.id
      WHERE ri."createdAt" >= ${cutoff}::timestamp
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY ri."importType", ri.status
      ORDER BY ri."importType", ri.status
    `),

    // Top source domains (from sourceUrl)
    db.execute(sql`
      SELECT
        CASE
          WHEN ri."sourceUrl" IS NULL THEN '(no url)'
          ELSE split_part(split_part(ri."sourceUrl", '://', 2), '/', 1)
        END as domain,
        ri."importType" as type,
        count(*)::int as count
      FROM "recipeImports" ri
      JOIN users u ON ri."userId" = u.id
      WHERE ri."createdAt" >= ${cutoff}::timestamp
        AND ri."sourceUrl" IS NOT NULL
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY domain, ri."importType"
      ORDER BY count DESC
      LIMIT 30
    `),

    // Top error messages
    db.execute(sql`
      SELECT ri."importType" as type, ri."errorMessage" as error, count(*)::int as count
      FROM "recipeImports" ri
      JOIN users u ON ri."userId" = u.id
      WHERE ri."createdAt" >= ${cutoff}::timestamp
        AND ri.status = 'failed'
        AND ri."errorMessage" IS NOT NULL
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY ri."importType", ri."errorMessage"
      ORDER BY count DESC
      LIMIT 20
    `),

    // New users per week
    db.execute(sql`
      SELECT date_trunc('week', "createdAt")::date as week, count(*)::int as count
      FROM users
      WHERE "createdAt" >= ${cutoff}::timestamp
        AND email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY week
      ORDER BY week
    `),

    // Cook logs per week (by cookedOn date, not createdAt, to avoid bulk-import spikes)
    db.execute(sql`
      SELECT date_trunc('week', cl."cookedOn"::timestamp)::date as week, count(*)::int as count
      FROM "cookLogs" cl
      JOIN users u ON cl."userId" = u.id
      WHERE cl."cookedOn"::timestamp >= ${cutoff}::timestamp
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY week
      ORDER BY week
    `),

    // Recipes created per week
    db.execute(sql`
      SELECT date_trunc('week', r."createdAt")::date as week, count(*)::int as count
      FROM recipes r
      JOIN users u ON r."userId" = u.id
      WHERE r."createdAt" >= ${cutoff}::timestamp
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
      GROUP BY week
      ORDER BY week
    `),

    // Active users (last 7 and 30 days)
    db.execute(sql`
      SELECT
        (SELECT count(DISTINCT cl."userId")::int FROM "cookLogs" cl JOIN users u ON cl."userId" = u.id WHERE cl."cookedOn"::timestamp >= now() - interval '7 days' AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}) as "cookLast7d",
        (SELECT count(DISTINCT cl."userId")::int FROM "cookLogs" cl JOIN users u ON cl."userId" = u.id WHERE cl."cookedOn"::timestamp >= now() - interval '30 days' AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}) as "cookLast30d",
        (SELECT count(DISTINCT ri."userId")::int FROM "recipeImports" ri JOIN users u ON ri."userId" = u.id WHERE ri."createdAt" >= now() - interval '7 days' AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}) as "importLast7d",
        (SELECT count(DISTINCT ri."userId")::int FROM "recipeImports" ri JOIN users u ON ri."userId" = u.id WHERE ri."createdAt" >= now() - interval '30 days' AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}) as "importLast30d"
    `),

    // Image source type breakdown (dish_photo vs recipe_text)
    db.execute(sql`
      SELECT ri."rawPayload"->>'imageSourceType' as "sourceType", count(*)::int as count
      FROM "recipeImports" ri
      JOIN users u ON ri."userId" = u.id
      WHERE ri."createdAt" >= ${cutoff}::timestamp
        AND ri."importType" = 'image'
        AND ri."rawPayload"->>'imageSourceType' IS NOT NULL
        AND u.email NOT LIKE ${TEST_EMAIL_PATTERN}
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
    imageSourceTypes,
  });
}
