import { NextResponse } from "next/server";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { buildPrompt } from "@/lib/build-recipe-prompt";
import { callGemini, buildGeminiRecipe } from "@/lib/gemini-recipe";

const GOOGLE_DOC_PATTERN =
  /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, language } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const match = url.match(GOOGLE_DOC_PATTERN);
  if (!match) {
    return NextResponse.json(
      { error: "URL is not a Google Docs document" },
      { status: 400 }
    );
  }

  const docId = match[1];

  // Fetch the document as plain text (works for publicly shared docs)
  let docText: string;
  try {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const res = await fetch(exportUrl, {
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: "Document not found. Check that the URL is correct." },
          { status: 404 }
        );
      }
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          {
            error:
              'This document is not publicly accessible. Please set sharing to "Anyone with the link can view" and try again.',
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch document: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }
    docText = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to download document: ${msg}` },
      { status: 502 }
    );
  }

  if (!docText.trim()) {
    return NextResponse.json(
      { error: "The document appears to be empty." },
      { status: 400 }
    );
  }

  console.log(
    "[import/google-doc] Document fetched, length:",
    docText.length,
    "chars"
  );

  // Truncate very long documents to avoid hitting token limits
  const MAX_CHARS = 50_000;
  const truncated =
    docText.length > MAX_CHARS ? docText.slice(0, MAX_CHARS) : docText;

  const prompt = buildPrompt({
    inputText: truncated,
    language,
    mode: "document",
  });
  const parts = [{ text: prompt }];

  const result = await callGemini(parts as any, "[import/google-doc]", {
    maxOutputTokens: 32768,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  // The document prompt asks for an array of recipes if multiple are found
  const parsed = result.parsed;

  if (Array.isArray(parsed.recipes)) {
    // Multiple recipes returned
    const recipes = parsed.recipes.map((r: Record<string, unknown>) => {
      const { recipe } = buildGeminiRecipe(r, {
        fallbackSourceUrl: url,
        sourceName: "Google Docs",
      });
      return recipe;
    });
    return NextResponse.json({ recipes, generated: true });
  }

  // Single recipe (flat object)
  const { recipe, generated } = buildGeminiRecipe(parsed, {
    fallbackSourceUrl: url,
    sourceName: "Google Docs",
  });

  return NextResponse.json({ recipes: [recipe], generated });
}
