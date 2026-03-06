import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { db } from "@/db";
import { recipes, cookLogs, wantToCook, users } from "@/db/schema";
import { RecipeDetail } from "@/components/recipes/recipe-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [recipe] = await db
    .select({ title: recipes.title })
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  return { title: recipe?.title ?? "Recipe" };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [recipe] = await db
    .select({
      recipe: recipes,
      author: {
        id: users.id,
        name: users.name,
        image: users.image,
      },
    })
    .from(recipes)
    .innerJoin(users, eq(recipes.userId, users.id))
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe) notFound();

  const isOwner = session?.user?.id === recipe.recipe.userId;

  if (!recipe.recipe.isPublic && !isOwner) notFound();

  // Fetch logs for any viewer who can see the recipe (public or owner)
  const canSeeLogs = isOwner || recipe.recipe.isPublic;

  const [logs, [cookCount], queueItem] = await Promise.all([
    canSeeLogs
      ? db
          .select()
          .from(cookLogs)
          .where(eq(cookLogs.recipeId, id))
          .orderBy(desc(cookLogs.cookedOn))
      : [],
    db
      .select({ count: count() })
      .from(cookLogs)
      .where(eq(cookLogs.recipeId, id)),
    session?.user?.id
      ? db
          .select()
          .from(wantToCook)
          .where(
            and(
              eq(wantToCook.userId, session.user.id),
              eq(wantToCook.recipeId, id)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  return (
    <RecipeDetail
      recipe={recipe.recipe}
      author={recipe.author}
      cookLogs={logs}
      cookCount={Number(cookCount.count)}
      inQueue={queueItem.length > 0}
      isOwner={isOwner}
      currentUserId={session?.user?.id}
    />
  );
}
