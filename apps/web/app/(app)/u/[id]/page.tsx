import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { users, recipes, cookLogs, follows } from "@/db/schema";
import { ProfileView } from "@/components/profile/profile-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return { title: user?.name ?? "Profile" };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isOwner = session?.user?.id === id;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) notFound();
  if (!user.isPublic && !isOwner) notFound();

  const [publicRecipes, [cookCount], [followerCount], [followingCount]] =
    await Promise.all([
      db
        .select({
          recipe: recipes,
          cookCount: count(cookLogs.id),
        })
        .from(recipes)
        .leftJoin(cookLogs, eq(cookLogs.recipeId, recipes.id))
        .where(
          isOwner
            ? eq(recipes.userId, id)
            : and(eq(recipes.userId, id), eq(recipes.isPublic, true))
        )
        .groupBy(recipes.id)
        .orderBy(desc(recipes.createdAt)),
      db.select({ count: count() }).from(cookLogs).where(eq(cookLogs.userId, id)),
      db.select({ count: count() }).from(follows).where(eq(follows.followingId, id)),
      db.select({ count: count() }).from(follows).where(eq(follows.followerId, id)),
    ]);

  let isFollowing = false;
  if (session?.user?.id && !isOwner) {
    const [f] = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, session.user.id),
          eq(follows.followingId, id)
        )
      )
      .limit(1);
    isFollowing = !!f;
  }

  return (
    <ProfileView
      user={{
        id: user.id,
        name: user.name,
        image: user.image,
        bio: user.bio,
        isPublic: user.isPublic,
        createdAt: user.createdAt,
      }}
      recipes={publicRecipes.map((r) => ({
        ...r.recipe,
        cookCount: Number(r.cookCount),
      }))}
      cookCount={Number(cookCount.count)}
      followerCount={Number(followerCount.count)}
      followingCount={Number(followingCount.count)}
      isFollowing={isFollowing}
      isOwner={isOwner}
      currentUserId={session?.user?.id}
    />
  );
}
