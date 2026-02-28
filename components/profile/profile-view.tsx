"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, UserPlus, UserMinus, ChefHat, Globe, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { toast } from "@/lib/use-toast";
import type { Ingredient, InstructionStep } from "@/db/schema";

interface ProfileRecipe {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  tags?: string[] | null;
  cookTime?: number | null;
  prepTime?: number | null;
  servings?: number | null;
  isPublic: boolean;
  ingredients?: Ingredient[] | null;
  instructions?: InstructionStep[] | null;
  cookCount: number;
}

interface ProfileViewProps {
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
    bio?: string | null;
    isPublic: boolean;
    createdAt: Date;
  };
  recipes: ProfileRecipe[];
  cookCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwner: boolean;
  currentUserId?: string;
}

export function ProfileView({
  user,
  recipes,
  cookCount,
  followerCount: initialFollowerCount,
  followingCount,
  isFollowing: initialFollowing,
  isOwner,
}: ProfileViewProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isPending, startTransition] = useTransition();

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleFollowToggle = async () => {
    const prev = isFollowing;
    setIsFollowing(!prev);
    setFollowerCount((c) => (prev ? c - 1 : c + 1));

    try {
      const res = await fetch("/api/follows", {
        method: prev ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: user.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setIsFollowing(prev);
        setFollowerCount(initialFollowerCount);
        toast({
          title: "Failed to update follow",
          description: data?.error ?? `Server returned ${res.status}`,
          variant: "destructive",
        });
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setIsFollowing(prev);
      setFollowerCount(initialFollowerCount);
      toast({
        title: "Failed to update follow",
        description: "Network error — please try again.",
        variant: "destructive",
      });
    }
  };

  const totalCooks = cookCount;

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="flex items-start gap-5">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
          <AvatarImage src={user.image ?? undefined} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-stone-900">
                {user.name}
              </h1>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-stone-500">
                {user.isPublic ? (
                  <>
                    <Globe className="h-3 w-3" />
                    Public profile
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" />
                    Private profile
                  </>
                )}
              </div>
            </div>

            {isOwner ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  Edit profile
                </Link>
              </Button>
            ) : currentUserId ? (
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={handleFollowToggle}
                disabled={isPending}
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="h-4 w-4" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Follow
                  </>
                )}
              </Button>
            ) : (
              <Button asChild variant="default" size="sm">
                <Link href="/auth/signin">
                  <UserPlus className="h-4 w-4" />
                  Follow
                </Link>
              </Button>
            )}
          </div>

          {user.bio && (
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              {user.bio}
            </p>
          )}

          <div className="flex items-center gap-5 mt-3 text-sm">
            <div className="text-center">
              <p className="font-bold text-stone-900">{recipes.length}</p>
              <p className="text-stone-500 text-xs">Recipes</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-stone-900">{totalCooks}</p>
              <p className="text-stone-500 text-xs">Total cooks</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-stone-900">{followerCount}</p>
              <p className="text-stone-500 text-xs">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-stone-900">{followingCount}</p>
              <p className="text-stone-500 text-xs">Following</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recipes */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {isOwner ? "My recipes" : "Recipes"}
        </h2>

        {recipes.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="h-8 w-8 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">
              {isOwner ? "You haven't added any recipes yet." : "No public recipes yet."}
            </p>
            {isOwner && (
              <Button asChild className="mt-4" size="sm">
                <Link href="/recipes/new">Add your first recipe</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                cookCount={recipe.cookCount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
