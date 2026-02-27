import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { recipes, cookLogs, wantToCook } from "@/db/schema";
import { RecipeList } from "@/components/recipes/recipe-list";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const [myRecipes, cookLogCounts, queueItems] = await Promise.all([
    db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, session.user.id))
      .orderBy(desc(recipes.createdAt)),
    db
      .select({ recipeId: cookLogs.recipeId, count: count() })
      .from(cookLogs)
      .where(eq(cookLogs.userId, session.user.id))
      .groupBy(cookLogs.recipeId),
    db
      .select({ recipeId: wantToCook.recipeId })
      .from(wantToCook)
      .where(eq(wantToCook.userId, session.user.id)),
  ]);

  const cookCountMap = new Map(
    cookLogCounts.map((r) => [r.recipeId, Number(r.count)])
  );
  const queueSet = new Set<string>(queueItems.map((q) => q.recipeId));

  const recipesWithMeta = myRecipes.map((r) => ({
    ...r,
    cookCount: cookCountMap.get(r.id) ?? 0,
    inQueue: queueSet.has(r.id),
  }));

  return <RecipeList recipes={recipesWithMeta} />;
}
