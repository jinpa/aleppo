"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, ChefHat, X, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";
import { formatMinutes, formatRelativeDate } from "@/lib/utils";

interface QueueItem {
  recipe: {
    id: string;
    title: string;
    imageUrl?: string | null;
    cookTime?: number | null;
    prepTime?: number | null;
    tags?: string[] | null;
  };
  addedAt: Date;
  cookCount: number;
}

export function QueueView({ items: initialItems }: { items: QueueItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  const handleRemove = async (recipeId: string) => {
    setItems((prev) => prev.filter((i) => i.recipe.id !== recipeId));

    const res = await fetch("/api/queue", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId }),
    });

    if (!res.ok) {
      setItems(initialItems);
      toast({ title: "Failed to remove from queue", variant: "destructive" });
    } else {
      toast({ title: "Removed from queue" });
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Want to Cook</h1>
        <p className="text-stone-500 text-sm mt-0.5">
          {items.length} recipe{items.length !== 1 ? "s" : ""} in your queue
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <BookmarkCheck className="h-10 w-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">
            Queue is empty
          </h3>
          <p className="text-stone-500 text-sm mb-6 max-w-sm mx-auto">
            Add recipes to your queue by clicking the bookmark icon on any
            recipe card.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Browse recipes</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const totalTime =
              (item.recipe.prepTime ?? 0) + (item.recipe.cookTime ?? 0);
            return (
              <div
                key={item.recipe.id}
                className="flex gap-4 items-center bg-white rounded-2xl border border-stone-200 p-4 hover:border-stone-300 transition-colors"
              >
                <Link
                  href={`/recipes/${item.recipe.id}`}
                  className="flex-1 flex gap-4 min-w-0"
                >
                  {item.recipe.imageUrl ? (
                    <div className="relative h-16 w-16 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={item.recipe.imageUrl}
                        alt={item.recipe.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <ChefHat className="h-6 w-6 text-stone-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 truncate">
                      {item.recipe.title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                      {totalTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatMinutes(totalTime)}
                        </span>
                      )}
                      {item.cookCount > 0 && (
                        <span className="text-amber-700 font-medium">
                          Made {item.cookCount}×
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-400 mt-1">
                      Added {formatRelativeDate(item.addedAt)}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleRemove(item.recipe.id)}
                  className="flex-shrink-0 p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove from queue"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
