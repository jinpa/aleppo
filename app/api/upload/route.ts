import { NextResponse } from "next/server";
import sharp from "sharp";
import { auth } from "@/auth";
import { uploadImageToR2 } from "@/lib/r2";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Use JPEG, PNG, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  // R2 not configured — return a placeholder for local dev
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return NextResponse.json({
      url: `https://placehold.co/800x600/e7e5e4/78716c?text=Recipe+Image`,
    });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Resize and convert to WebP
    const processed = await sharp(buffer)
      .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `recipes/${session.user.id}/${Date.now()}.webp`;
    const url = await uploadImageToR2(processed, key, "image/webp");

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
