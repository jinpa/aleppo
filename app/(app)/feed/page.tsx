import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cookLogs, recipes, users, follows } from "@/db/schema";
import { FeedView } from "@/components/feed/feed-view";

export const metadata = { title: "Following Feed" };

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, session.user.id));

  const followingIds = following.map((f) => f.followingId);

  let feed: {
    log: { id: string; cookedOn: string; notes?: string | null; createdAt: Date };
    recipe: { id: string; title: string; imageUrl?: string | null; tags?: string[] | null };
    user: { id: string; name?: string | null; image?: string | null };
  }[] = [];

  if (followingIds.length > 0) {
    feed = await db
      .select({
        log: {
          id: cookLogs.id,
          cookedOn: cookLogs.cookedOn,
          notes: cookLogs.notes,
          createdAt: cookLogs.createdAt,
        },
        recipe: {
          id: recipes.id,
          title: recipes.title,
          imageUrl: recipes.imageUrl,
          tags: recipes.tags,
        },
        user: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(cookLogs)
      .innerJoin(
        recipes,
        and(eq(cookLogs.recipeId, recipes.id), eq(recipes.isPublic, true))
      )
      .innerJoin(
        users,
        and(eq(cookLogs.userId, users.id), eq(users.isPublic, true))
      )
      .where(inArray(cookLogs.userId, followingIds))
      .orderBy(desc(cookLogs.cookedOn), desc(cookLogs.createdAt))
      .limit(50);
  }

  const followingUsers = followingIds.length > 0
    ? await db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(inArray(users.id, followingIds))
    : [];

  return (
    <FeedView
      feed={feed}
      followingCount={followingIds.length}
      followingUsers={followingUsers}
    />
  );
}
