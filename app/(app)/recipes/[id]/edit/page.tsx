import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { RecipeForm } from "@/components/recipes/recipe-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe || recipe.userId !== session.user.id) notFound();

  return (
    <RecipeForm
      mode="edit"
      initialData={{
        id: recipe.id,
        title: recipe.title,
        description: recipe.description ?? "",
        ingredients: (recipe.ingredients ?? []).map((ing) => ({ raw: ing.raw })),
        instructions: (recipe.instructions ?? []).map((inst) => ({
          text: inst.text,
        })),
        tags: recipe.tags ?? [],
        isPublic: recipe.isPublic,
        prepTime: recipe.prepTime ?? undefined,
        cookTime: recipe.cookTime ?? undefined,
        servings: recipe.servings ?? undefined,
        sourceUrl: recipe.sourceUrl ?? "",
        sourceName: recipe.sourceName ?? "",
        imageUrl: recipe.imageUrl ?? "",
        notes: recipe.notes ?? "",
      }}
    />
  );
}
