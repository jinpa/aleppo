import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { recipeImports } from "@/db/schema";
import { extractFromJsonLdArray } from "@/lib/recipe-scraper";
import { ImportFlow } from "@/components/recipes/import-flow";

export const metadata = { title: "Import Recipe" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ importId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { importId } = await searchParams;

  // Bookmarklet flow: pre-populate review form from stored import record
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
        />
      );
    }
  }

  return <ImportFlow />;
}
