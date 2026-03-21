import { NextResponse } from "next/server";

import { db } from "@/db";
import { recipeImports } from "@/db/schema";
import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { buildPrompt } from "@/lib/build-recipe-prompt";
import { callGemini, buildGeminiRecipe } from "@/lib/gemini-recipe";

const GOOGLE_DRIVE_FILE_PATTERN =
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const language = (formData.get("language") as string) || undefined;
  const urlField = formData.get("url") as string | null;
  const fileField = formData.get("file") as File | null;

  let pdfBuffer: Buffer;
  let sourceLabel: string;

  if (urlField) {
    // Google Drive file URL
    const match = urlField.match(GOOGLE_DRIVE_FILE_PATTERN);
    if (!match) {
      return NextResponse.json(
        { error: "URL is not a Google Drive file link" },
        { status: 400 }
      );
    }
    const fileId = match[1];
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    try {
      const res = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(30_000),
        redirect: "follow",
      });
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json(
            { error: "File not found on Google Drive. Check the URL." },
            { status: 404 }
          );
        }
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json(
            {
              error:
                'This file is not publicly accessible. Please set sharing to "Anyone with the link can view" and try again.',
            },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: `Failed to download from Google Drive: ${res.status} ${res.statusText}` },
          { status: 502 }
        );
      }
      pdfBuffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Failed to download from Google Drive: ${msg}` },
        { status: 502 }
      );
    }
    sourceLabel = "Google Drive";
  } else if (fileField) {
    // Direct file upload
    pdfBuffer = Buffer.from(await fileField.arrayBuffer());
    sourceLabel = fileField.name || "PDF";
  } else {
    return NextResponse.json(
      { error: "Either a PDF file or a Google Drive URL is required" },
      { status: 400 }
    );
  }

  // Validate PDF magic bytes
  if (
    pdfBuffer.length < 4 ||
    pdfBuffer[0] !== 0x25 || // %
    pdfBuffer[1] !== 0x50 || // P
    pdfBuffer[2] !== 0x44 || // D
    pdfBuffer[3] !== 0x46    // F
  ) {
    return NextResponse.json(
      { error: "The file does not appear to be a valid PDF." },
      { status: 400 }
    );
  }

  if (pdfBuffer.length > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: `PDF is too large (${Math.round(pdfBuffer.length / 1024 / 1024)}MB). Maximum size is 20MB.` },
      { status: 400 }
    );
  }

  console.log(
    "[import/pdf] PDF received, size:",
    Math.round(pdfBuffer.length / 1024),
    "KB, source:",
    sourceLabel
  );

  const prompt = buildPrompt({ language, mode: "pdf" });
  const parts = [
    { text: prompt },
    { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } },
  ] as const;

  const logImport = (status: string, errorMessage?: string) =>
    db.insert(recipeImports).values({
      userId, importType: "pdf", sourceUrl: urlField ?? null, status, errorMessage,
    }).catch((err) => console.error("[import/pdf] Failed to log import:", err));

  const result = await callGemini(parts as any, "[import/pdf]");

  if (!result.ok) {
    await logImport("failed", result.error);
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  const parsed = result.parsed;

  if (Array.isArray(parsed.recipes)) {
    const recipes = parsed.recipes.map((r: Record<string, unknown>) => {
      const { recipe } = buildGeminiRecipe(r, {
        sourceName: sourceLabel,
      });
      return recipe;
    });
    await logImport("parsed");
    return NextResponse.json({ recipes, generated: true });
  }

  // Single recipe
  const { recipe, generated } = buildGeminiRecipe(parsed, {
    sourceName: sourceLabel,
  });

  await logImport("parsed");
  return NextResponse.json({ recipes: [recipe], generated });
}
