import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { uploadImageToR2 } from "@/lib/r2";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const mode = body.mode === "edit" ? "edit" : "generate";
  const recipeTitle = typeof body.title === "string" ? body.title.trim() : "";
  const recipeDescription = typeof body.description === "string" ? body.description.trim() : "";

  if (!recipeTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Load recipe for visibility check and to get original image for edit mode
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!recipe.isPublic && recipe.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3.1-flash-image-preview";

  // Build prompt
  const promptText = mode === "edit"
    ? `This is a photo of the original recipe "${recipe.title}". The recipe has been modified and is now called "${recipeTitle}". ${recipeDescription ? `Description: ${recipeDescription}.` : ""} Please edit this image to reflect the modified recipe. Make it look like an appetizing food photo of the new dish.`
    : `Generate an appetizing, professional-looking food photo of a dish called "${recipeTitle}". ${recipeDescription ? `Description: ${recipeDescription}.` : ""} The image should look like a real photograph, shot from above at a slight angle, with natural lighting and a clean background.`;

  // Build content parts
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: promptText },
  ];

  // For edit mode, fetch the original image and include it
  if (mode === "edit") {
    const originalImageUrl =
      recipe.images?.find((i: { url: string; role?: string }) => i.role === "banner" || i.role === "both")?.url
      ?? recipe.images?.[0]?.url
      ?? recipe.imageUrl;

    if (!originalImageUrl) {
      return NextResponse.json(
        { error: "No original image to edit" },
        { status: 400 }
      );
    }

    try {
      const imgRes = await fetch(originalImageUrl);
      if (!imgRes.ok) throw new Error("Failed to fetch original image");
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
      parts.push({ inlineData: { mimeType, data: buffer.toString("base64") } });
    } catch (err) {
      console.error("[modify-image] Failed to fetch original image:", err);
      return NextResponse.json(
        { error: "Could not load original image for editing" },
        { status: 502 }
      );
    }
  }

  let imageBase64: string | null = null;
  let imageMimeType = "image/png";
  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    // Extract image from response
    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType ?? "image/png";
          break;
        }
      }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    console.log("[modify-image] Gemini finish reason:", finishReason, "got image:", !!imageBase64);

    if (finishReason === "RECITATION") {
      return NextResponse.json(
        { error: "Image generation was blocked. Try a different recipe description." },
        { status: 422 }
      );
    }
  } catch (err) {
    console.error("[modify-image] Gemini error:", err);
    return NextResponse.json(
      { error: "AI image generation failed. Please try again." },
      { status: 502 }
    );
  }

  if (!imageBase64) {
    return NextResponse.json(
      { error: "AI did not generate an image. Try a different description." },
      { status: 422 }
    );
  }

  // Upload to R2 or return as data URL
  const buffer = Buffer.from(imageBase64, "base64");
  const ext = imageMimeType.includes("png") ? "png" : "webp";

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    // Dev fallback: return data URL
    return NextResponse.json({
      imageUrl: `data:${imageMimeType};base64,${imageBase64}`,
    });
  }

  try {
    const key = `recipes/${userId}/ai-${Date.now()}.${ext}`;
    const url = await uploadImageToR2(buffer, key, imageMimeType);
    return NextResponse.json({ imageUrl: url });
  } catch (err) {
    console.error("[modify-image] R2 upload failed:", err);
    // Fall back to data URL
    return NextResponse.json({
      imageUrl: `data:${imageMimeType};base64,${imageBase64}`,
    });
  }
}
