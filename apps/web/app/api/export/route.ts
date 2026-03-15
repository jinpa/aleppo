/**
 * GET /api/export
 *
 * Export the authenticated user's recipe library as an Aleppo JSON file.
 * Query params: includeCookLogs (default true), includeImages (default false).
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { buildExport } from "@/lib/export-builder";

export const maxDuration = 300;

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const includeCookLogs = url.searchParams.get("includeCookLogs") !== "false";
  const includeImages = url.searchParams.get("includeImages") === "true";

  const data = await buildExport(userId, { includeCookLogs, includeImages });

  const today = new Date().toISOString().slice(0, 10);
  const filename = `aleppo-export-${today}.aleppo.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
