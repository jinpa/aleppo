import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      bio: users.bio,
      isPublic: users.isPublic,
      defaultTagsEnabled: users.defaultTagsEnabled,
      defaultRecipeIsPublic: users.defaultRecipeIsPublic,
      hasPassword: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) redirect("/auth/signin");

  return (
    <SettingsView
      user={{
        ...user,
        hasPassword: !!user.hasPassword,
      }}
    />
  );
}
