import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PaprikaImportFlow } from "@/components/recipes/paprika-import-flow";

export const metadata = { title: "Import from Paprika" };

export default async function PaprikaImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [userPrefsRow] = await db
    .select({ defaultRecipeIsPublic: users.defaultRecipeIsPublic })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const defaultIsPublic = userPrefsRow?.defaultRecipeIsPublic ?? false;

  return <PaprikaImportFlow defaultIsPublic={defaultIsPublic} />;
}
