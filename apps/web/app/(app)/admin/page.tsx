import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, recipes, cookLogs, follows } from "@/db/schema";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await auth();
  if (!process.env.ADMIN_EMAIL || session?.user?.email !== process.env.ADMIN_EMAIL) {
    notFound();
  }

  const [
    [totals],
    userRows,
    recipeCounts,
    cookLogCounts,
  ] = await Promise.all([
    // Single-query aggregate totals
    db
      .select({
        totalUsers: count(users.id),
        totalRecipes: sql<number>`(select count(*) from recipes)`,
        totalCookLogs: sql<number>`(select count(*) from "cookLogs")`,
        totalFollows: sql<number>`(select count(*) from follows)`,
      })
      .from(users),

    // All users ordered by join date
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isPublic: users.isPublic,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),

    // Recipe count per user
    db
      .select({ userId: recipes.userId, cnt: count() })
      .from(recipes)
      .groupBy(recipes.userId),

    // Cook log count per user
    db
      .select({ userId: cookLogs.userId, cnt: count() })
      .from(cookLogs)
      .groupBy(cookLogs.userId),
  ]);

  const recipeMap = new Map(recipeCounts.map((r) => [r.userId, Number(r.cnt)]));
  const cookMap = new Map(cookLogCounts.map((r) => [r.userId, Number(r.cnt)]));

  const stats = [
    { label: "Users", value: Number(totals.totalUsers) },
    { label: "Recipes", value: Number(totals.totalRecipes) },
    { label: "Cook Logs", value: Number(totals.totalCookLogs) },
    { label: "Follows", value: Number(totals.totalFollows) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Admin</h1>
        <p className="text-sm text-stone-500 mt-1">Site overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-stone-200 p-4"
          >
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              {label}
            </p>
            <p className="mt-1 text-3xl font-bold text-stone-900">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Per-user table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-stone-700">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left text-xs font-medium text-stone-500 uppercase tracking-wide">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2 text-right">Recipes</th>
                <th className="px-4 py-2 text-right">Cook Logs</th>
                <th className="px-4 py-2">Public</th>
                <th className="px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {userRows.map((user) => (
                <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {user.name ?? <span className="text-stone-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{user.email}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {(recipeMap.get(user.id) ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                    {(cookMap.get(user.id) ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.isPublic
                          ? "bg-green-100 text-green-700"
                          : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {user.isPublic ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {user.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
