import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { wantToCook, recipes } from "@/db/schema";
import { QueueView } from "@/components/queue/queue-view";

export const metadata = { title: "My Queue" };

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const queue = await db
    .select({
      recipe: recipes,
      addedAt: wantToCook.addedAt,
      cookCount: sql<number>`(SELECT COUNT(*) FROM "cookLogs" WHERE "cookLogs"."recipeId" = ${recipes.id})`.as("cookCount"),
    })
    .from(wantToCook)
    .innerJoin(recipes, eq(wantToCook.recipeId, recipes.id))
    .where(eq(wantToCook.userId, session.user.id))
    .orderBy(desc(wantToCook.addedAt));

  return <QueueView items={queue} />;
}
