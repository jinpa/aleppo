import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipeImports } from "@/db/schema";
import { extractFromJsonLdArray } from "@/lib/recipe-scraper";

const schema = z.object({
  jsonld: z.array(z.unknown()),
  url: z.string().url().optional(),
  title: z.string().optional(),
  ogImage: z.string().optional(),
  siteName: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { jsonld, url, title, ogImage, siteName } = parsed.data;

  const recipe = extractFromJsonLdArray(jsonld as object[], {
    pageTitle: title,
    ogImage,
    siteName,
  });

  const [importRecord] = await db
    .insert(recipeImports)
    .values({
      userId: session.user.id,
      importType: "bookmarklet",
      sourceUrl: url ?? null,
      rawPayload: { jsonld, url, title, ogImage, siteName },
      status: recipe ? "parsed" : "failed",
      errorMessage: recipe ? null : "No Recipe schema found on this page",
    })
    .returning({ id: recipeImports.id });

  return NextResponse.json({
    importId: importRecord.id,
    recipe,
  });
}
