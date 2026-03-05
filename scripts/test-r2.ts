/**
 * Quick R2 connectivity test — uploads a tiny test file and checks the result.
 * Run with: npx tsx --env-file=.env.local scripts/test-r2.ts
 */

import { uploadImageToR2, R2_PUBLIC_URL, BUCKET_NAME } from "../lib/r2";

async function main() {
  console.log("R2_ACCOUNT_ID:   ", process.env.R2_ACCOUNT_ID ? "✓ set" : "✗ MISSING");
  console.log("R2_ACCESS_KEY_ID:", process.env.R2_ACCESS_KEY_ID ? "✓ set" : "✗ MISSING");
  console.log("R2_SECRET:       ", process.env.R2_SECRET_ACCESS_KEY ? "✓ set" : "✗ MISSING");
  console.log("R2_BUCKET_NAME:  ", BUCKET_NAME);
  console.log("R2_PUBLIC_URL:   ", R2_PUBLIC_URL || "(empty — imageUrls will be broken!)");
  console.log("");

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error("❌ Missing credentials — aborting.");
    process.exit(1);
  }

  console.log("Uploading test file...");
  try {
    const testContent = Buffer.from("hello from aleppo r2 test");
    const url = await uploadImageToR2(testContent, "test/r2-check.txt", "text/plain");
    console.log("✅ Upload succeeded. URL:", url);
    if (!R2_PUBLIC_URL) {
      console.warn("⚠  R2_PUBLIC_URL is empty — the URL above will be wrong. Set it to your bucket's public URL.");
    }
  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
