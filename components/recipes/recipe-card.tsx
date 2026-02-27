"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, ChefHat, BookmarkPlus, BookmarkCheck, Globe, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatMinutes } from "@/lib/utils";
import type { Ingredient, InstructionStep } from "@/db/schema";

interface RecipeCardProps {
  recipe: {
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
  };
  cookCount?: number;
  inQueue?: boolean;
  onQueueToggle?: (recipeId: string, inQueue: boolean) => void;
  compact?: boolean;
}

export function RecipeCard({
  recipe,
  cookCount = 0,
  inQueue = false,
  onQueueToggle,
  compact = false,
}: RecipeCardProps) {
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const ingredientCount = recipe.ingredients?.length ?? 0;

  return (
    <div className="group relative bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-stone-300 hover:shadow-md transition-all">
      <Link href={`/recipes/${recipe.id}`} className="block">
        {recipe.imageUrl ? (
          <div className="relative h-40 bg-stone-100 overflow-hidden">
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
            <ChefHat className="h-12 w-12 text-stone-300" />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2">
              {recipe.title}
            </h3>
            <div className="flex-shrink-0 mt-0.5">
              {recipe.isPublic ? (
                <Globe className="h-3.5 w-3.5 text-stone-400" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-stone-300" />
              )}
            </div>
          </div>

          {recipe.description && !compact && (
            <p className="text-xs text-stone-500 line-clamp-2 mb-3">
              {recipe.description}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-stone-500 mt-2">
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatMinutes(totalTime)}
              </span>
            )}
            {ingredientCount > 0 && (
              <span>{ingredientCount} ingredients</span>
            )}
            {cookCount > 0 && (
              <span className="font-medium text-amber-700">
                Made {cookCount}×
              </span>
            )}
          </div>

          {recipe.tags && recipe.tags.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs py-0 px-1.5">
                  {tag}
                </Badge>
              ))}
              {recipe.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                  +{recipe.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </Link>

      {onQueueToggle && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onQueueToggle(recipe.id, inQueue);
          }}
          className={cn(
            "absolute top-3 right-3 p-1.5 rounded-lg transition-all shadow-sm",
            inQueue
              ? "bg-amber-500 text-white"
              : "bg-white/90 text-stone-600 hover:bg-amber-50 hover:text-amber-600"
          )}
          title={inQueue ? "Remove from queue" : "Add to queue"}
        >
          {inQueue ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <BookmarkPlus className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
