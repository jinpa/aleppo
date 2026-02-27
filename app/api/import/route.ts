import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipeImports } from "@/db/schema";
import { scrapeRecipeFromUrl } from "@/lib/recipe-scraper";

const schema = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { url } = parsed.data;
  const { recipe, rawPayload, error } = await scrapeRecipeFromUrl(url);

  // Create import audit record
  const [importRecord] = await db
    .insert(recipeImports)
    .values({
      userId: session.user.id,
      importType: "url",
      sourceUrl: url,
      rawPayload,
      status: error && !recipe?.title ? "failed" : "parsed",
      errorMessage: error,
    })
    .returning({ id: recipeImports.id });

  return NextResponse.json({
    importId: importRecord.id,
    recipe,
    parseError: error,
  });
}
