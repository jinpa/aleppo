import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";

const schema = z.object({
  idToken: z.string(),
});

const TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify the ID token with Google
  const googleRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${parsed.data.idToken}`
  );
  if (!googleRes.ok) {
    return NextResponse.json(
      { error: "Invalid Google token" },
      { status: 401 }
    );
  }

  const payload = await googleRes.json();

  // Ensure the token was issued for our app
  if (payload.aud !== process.env.AUTH_GOOGLE_ID) {
    return NextResponse.json(
      { error: "Token audience mismatch" },
      { status: 401 }
    );
  }

  const { sub: googleId, email, name, picture } = payload;
  if (!email) {
    return NextResponse.json(
      { error: "No email in Google token" },
      { status: 400 }
    );
  }

  // Look up an existing linked Google account
  const [existingAccount] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, "google"),
        eq(accounts.providerAccountId, googleId)
      )
    )
    .limit(1);

  let userId: string;

  if (existingAccount) {
    userId = existingAccount.userId;
  } else {
    // Find or create the user by email, then link the Google account
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email, name: name ?? email, image: picture ?? null })
        .returning();
    }

    await db.insert(accounts).values({
      userId: user.id,
      type: "oidc",
      provider: "google",
      providerAccountId: googleId,
    });

    userId = user.id;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const isSecure = new URL(req.url).protocol === "https:";
  const salt = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.image,
    },
    secret: process.env.AUTH_SECRET!,
    maxAge: TOKEN_MAX_AGE,
    salt,
  });

  return NextResponse.json({ token });
}
