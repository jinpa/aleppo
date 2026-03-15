import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { protocol, host } = new URL(req.url);
  const baseUrl = process.env.NEXTAUTH_URL ?? `${protocol}//${host}`;
  return NextResponse.json({ url: `${baseUrl}/join/${userId}` });
}
