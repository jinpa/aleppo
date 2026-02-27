"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Link2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "./recipe-card";
import { toast } from "@/lib/use-toast";
import type { Ingredient, InstructionStep } from "@/db/schema";

interface Recipe {
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
  inQueue: boolean;
}

export function RecipeList({ recipes }: { recipes: Recipe[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [queueState, setQueueState] = useState<Record<string, boolean>>(
    Object.fromEntries(recipes.map((r) => [r.id, r.inQueue]))
  );
  const [, startTransition] = useTransition();

  const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort();

  const filtered = recipes.filter((r) => {
    const matchesSearch =
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !activeTag || r.tags?.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  const handleQueueToggle = async (recipeId: string, isInQueue: boolean) => {
    setQueueState((prev) => ({ ...prev, [recipeId]: !isInQueue }));

    const res = await fetch("/api/queue", {
      method: isInQueue ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId }),
    });

    if (!res.ok) {
      setQueueState((prev) => ({ ...prev, [recipeId]: isInQueue }));
      toast({ title: "Failed to update queue", variant: "destructive" });
    } else {
      toast({
        title: isInQueue ? "Removed from queue" : "Added to queue",
        variant: "success",
      });
      startTransition(() => router.refresh());
    }
  };

  const recipesWithQueueState = filtered.map((r) => ({
    ...r,
    inQueue: queueState[r.id] ?? r.inQueue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">My Recipes</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/recipes/import">
              <Link2 className="h-4 w-4" />
              Import URL
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/recipes/new">
              <Plus className="h-4 w-4" />
              New recipe
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTag === tag
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-4">🍳</div>
          <h3 className="text-lg font-semibold text-stone-900 mb-2">
            Your cookbook is empty
          </h3>
          <p className="text-stone-500 text-sm mb-6 max-w-sm mx-auto">
            Add your first recipe manually or import one from any cooking
            website.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild>
              <Link href="/recipes/new">
                <Plus className="h-4 w-4" />
                Create recipe
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/recipes/import">
                <Link2 className="h-4 w-4" />
                Import from URL
              </Link>
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-stone-500">
            No recipes match your search. Try something else.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipesWithQueueState.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              cookCount={recipe.cookCount}
              inQueue={recipe.inQueue}
              onQueueToggle={handleQueueToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
