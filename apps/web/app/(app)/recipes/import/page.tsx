import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { recipeImports, users } from "@/db/schema";
import { extractFromJsonLdArray } from "@/lib/recipe-scraper";
import { ImportFlow } from "@/components/recipes/import-flow";

export const metadata = { title: "Import Recipe" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ importId?: string; mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { importId, mode } = await searchParams;

  const [userPrefsRow] = await db
    .select({
      defaultTagsEnabled: users.defaultTagsEnabled,
      defaultRecipeIsPublic: users.defaultRecipeIsPublic,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const userPrefs = userPrefsRow ?? { defaultTagsEnabled: true, defaultRecipeIsPublic: false };

  // Bookmarklet flow: page was opened by the bookmarklet via window.open.
  // The client-side ImportFlow component handles the postMessage handshake.
  if (mode === "bookmarklet") {
    return <ImportFlow mode="bookmarklet" userPrefs={userPrefs} />;
  }

  // Legacy importId flow (kept for backward compat)
  if (importId) {
    const [importRecord] = await db
      .select()
      .from(recipeImports)
      .where(
        and(
          eq(recipeImports.id, importId),
          eq(recipeImports.userId, session.user.id)
        )
      )
      .limit(1);

    if (importRecord) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = importRecord.rawPayload as any;
      const recipe = extractFromJsonLdArray(payload?.jsonld ?? [], {
        pageTitle: payload?.title,
        ogImage: payload?.ogImage,
        siteName: payload?.siteName,
      });

      const parseError = recipe
        ? undefined
        : "No Recipe schema found on this page. Please fill in the details manually.";

      return (
        <ImportFlow
          initialStep="review"
          initialUrl={importRecord.sourceUrl ?? ""}
          initialRecipe={recipe}
          parseError={parseError}
          userPrefs={userPrefs}
        />
      );
    }
  }

  return <ImportFlow userPrefs={userPrefs} />;
}
