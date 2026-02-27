"use client";

import Link from "next/link";
import Image from "next/image";
import { Users, ChefHat, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelativeDate } from "@/lib/utils";

interface FeedItem {
  log: {
    id: string;
    cookedOn: string;
    notes?: string | null;
    createdAt: Date;
  };
  recipe: {
    id: string;
    title: string;
    imageUrl?: string | null;
    tags?: string[] | null;
  };
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
}

interface FeedViewProps {
  feed: FeedItem[];
  followingCount: number;
  followingUsers: { id: string; name?: string | null; image?: string | null }[];
}

export function FeedView({ feed, followingCount, followingUsers }: FeedViewProps) {
  if (followingCount === 0) {
    return (
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Following Feed</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            See what the people you follow have been cooking
          </p>
        </div>

        <div className="text-center py-16">
          <Users className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">
            Follow some cooks
          </h3>
          <p className="text-stone-500 text-sm mb-6 max-w-sm mx-auto">
            Your feed shows recent cooks from people you follow. Find cooks to
            follow by searching for their profile.
          </p>
          <Button asChild variant="outline">
            <Link href="/search">
              <Search className="h-4 w-4" />
              Find people
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Following Feed</h1>
        <p className="text-stone-500 text-sm mt-0.5">
          Following {followingCount} cook{followingCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Following avatars */}
      <div className="flex items-center gap-2 flex-wrap">
        {followingUsers.slice(0, 8).map((u) => (
          <Link key={u.id} href={`/u/${u.id}`} title={u.name ?? "User"}>
            <Avatar className="h-8 w-8 ring-2 ring-white">
              <AvatarImage src={u.image ?? undefined} />
              <AvatarFallback className="text-xs">
                {u.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        ))}
        {followingUsers.length > 8 && (
          <span className="text-xs text-stone-500">
            +{followingUsers.length - 8} more
          </span>
        )}
      </div>

      {feed.length === 0 ? (
        <div className="text-center py-12">
          <ChefHat className="h-8 w-8 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">
            None of the people you follow have public cooks yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map((item) => {
            const initials = item.user.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={item.log.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4 pb-3">
                  <Link href={`/u/${item.user.id}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.user.image ?? undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900">
                      <Link href={`/u/${item.user.id}`} className="hover:underline">
                        {item.user.name}
                      </Link>{" "}
                      <span className="font-normal text-stone-500">cooked</span>
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatRelativeDate(item.log.createdAt)}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/recipes/${item.recipe.id}`}
                  className="block px-4 pb-4"
                >
                  {item.recipe.imageUrl && (
                    <div className="relative h-48 rounded-xl overflow-hidden mb-3">
                      <Image
                        src={item.recipe.imageUrl}
                        alt={item.recipe.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p className="font-semibold text-stone-900">
                    {item.recipe.title}
                  </p>
                  {item.log.notes && (
                    <p className="text-sm text-stone-600 mt-1 line-clamp-2">
                      &ldquo;{item.log.notes}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-stone-400 mt-2">
                    Cooked on {formatDate(item.log.cookedOn)}
                  </p>
                  {item.recipe.tags && item.recipe.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {item.recipe.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
