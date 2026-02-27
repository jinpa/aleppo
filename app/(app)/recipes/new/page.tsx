import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RecipeForm } from "@/components/recipes/recipe-form";

export const metadata = { title: "New Recipe" };

export default async function NewRecipePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  return <RecipeForm mode="create" />;
}
