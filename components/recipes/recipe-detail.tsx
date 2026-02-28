"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Clock,
  Users,
  ChefHat,
  Edit2,
  Trash2,
  Globe,
  Lock,
  BookmarkPlus,
  BookmarkCheck,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CookLogDialog } from "./cook-log-dialog";
import { formatDate, formatMinutes } from "@/lib/utils";
import { toast } from "@/lib/use-toast";
import type { Ingredient, InstructionStep } from "@/db/schema";

interface CookLog {
  id: string;
  cookedOn: string;
  notes?: string | null;
  createdAt: Date;
}

interface RecipeDetailProps {
  recipe: {
    id: string;
    title: string;
    description?: string | null;
    sourceUrl?: string | null;
    sourceName?: string | null;
    imageUrl?: string | null;
    ingredients?: Ingredient[] | null;
    instructions?: InstructionStep[] | null;
    tags?: string[] | null;
    isPublic: boolean;
    notes?: string | null;
    prepTime?: number | null;
    cookTime?: number | null;
    servings?: number | null;
  };
  author: { id: string; name?: string | null; image?: string | null };
  cookLogs: CookLog[];
  cookCount: number;
  inQueue: boolean;
  isOwner: boolean;
  currentUserId?: string;
}

export function RecipeDetail({
  recipe,
  author,
  cookLogs: initialLogs,
  cookCount: initialCount,
  inQueue: initialInQueue,
  isOwner,
}: RecipeDetailProps) {
  const router = useRouter();
  const [inQueue, setInQueue] = useState(initialInQueue);
  const [cookLogs, setCookLogs] = useState(initialLogs);
  const [cookCount, setCookCount] = useState(initialCount);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  const handleQueueToggle = async () => {
    const prev = inQueue;
    setInQueue(!prev);

    const res = await fetch("/api/queue", {
      method: prev ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: recipe.id }),
    });

    if (!res.ok) {
      setInQueue(prev);
      toast({ title: "Failed to update queue", variant: "destructive" });
    } else {
      toast({
        title: prev ? "Removed from queue" : "Added to want-to-cook queue",
        variant: "success",
      });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/recipes/${recipe.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast({ title: "Recipe deleted", variant: "success" });
      router.push("/");
      router.refresh();
    } else {
      setDeleting(false);
      toast({ title: "Failed to delete recipe", variant: "destructive" });
    }
  };

  const handleCookLogged = (log: CookLog) => {
    setCookLogs((prev) => [log, ...prev].sort((a, b) =>
      new Date(b.cookedOn).getTime() - new Date(a.cookedOn).getTime()
    ));
    setCookCount((prev) => prev + 1);
    setShowLogDialog(false);
    toast({ title: "Cook logged! 🍳", variant: "success" });
  };

  const handleDeleteLog = async (logId: string) => {
    const res = await fetch(`/api/cook-logs/${logId}`, { method: "DELETE" });
    if (res.ok) {
      setCookLogs((prev) => prev.filter((l) => l.id !== logId));
      setCookCount((prev) => Math.max(0, prev - 1));
      toast({ title: "Cook log removed" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-stone-900 leading-tight">
            {recipe.title}
          </h1>
          {isOwner && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button asChild variant="outline" size="sm">
                <Link href={`/recipes/${recipe.id}/edit`}>
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Delete recipe" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete recipe?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &ldquo;{recipe.title}&rdquo; and all
                      its cook logs. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
          <span className="flex items-center gap-1">
            {recipe.isPublic ? (
              <>
                <Globe className="h-4 w-4" />
                Public
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Private
              </>
            )}
          </span>

          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatMinutes(totalTime)}
            </span>
          )}

          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {recipe.servings} servings
            </span>
          )}

          {cookCount > 0 && (
            <span className="flex items-center gap-1 font-semibold text-amber-700">
              <ChefHat className="h-4 w-4" />
              Made {cookCount}×
            </span>
          )}

          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-stone-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {recipe.sourceName || "Source"}
            </a>
          )}
        </div>

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          {isOwner && (
            <Button onClick={() => setShowLogDialog(true)} size="sm">
              <ChefHat className="h-4 w-4" />
              I cooked this
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleQueueToggle}>
            {inQueue ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-amber-600" />
                In queue
              </>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4" />
                Want to cook
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Image */}
      {recipe.imageUrl && (
        <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* Description */}
      {recipe.description && (
        <p className="text-stone-700 leading-relaxed">{recipe.description}</p>
      )}

      {/* Time details */}
      {(recipe.prepTime || recipe.cookTime) && (
        <div className="flex gap-6 py-4 border-y border-stone-100">
          {recipe.prepTime && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Prep</p>
              <p className="text-sm font-semibold text-stone-900 mt-1">
                {formatMinutes(recipe.prepTime)}
              </p>
            </div>
          )}
          {recipe.cookTime && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Cook</p>
              <p className="text-sm font-semibold text-stone-900 mt-1">
                {formatMinutes(recipe.cookTime)}
              </p>
            </div>
          )}
          {recipe.servings && (
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Serves</p>
              <p className="text-sm font-semibold text-stone-900 mt-1">
                {recipe.servings}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-4">
            Ingredients
          </h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-3 py-1.5 border-b border-stone-50">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <span className="text-stone-700 text-sm leading-relaxed">
                  {ing.raw}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Instructions */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-stone-900 mb-4">
            Instructions
          </h2>
          <ol className="space-y-4">
            {recipe.instructions.map((step) => (
              <li key={step.step} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold">
                  {step.step}
                </div>
                <p className="text-stone-700 leading-relaxed pt-0.5">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Notes */}
      {recipe.notes && (
        <section className="bg-amber-50 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-amber-900 mb-2">
            Notes
          </h2>
          <p className="text-amber-800 text-sm leading-relaxed">{recipe.notes}</p>
        </section>
      )}

      {/* Cook History */}
      {isOwner && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-stone-900">
              Cook History
              {cookCount > 0 && (
                <span className="ml-2 text-sm font-normal text-stone-500">
                  {cookCount} time{cookCount !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Log a cook
            </Button>
          </div>

          {cookLogs.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-2xl">
              <ChefHat className="h-8 w-8 text-stone-300 mx-auto mb-2" />
              <p className="text-stone-500 text-sm">
                No cooks logged yet. Start your history!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cookLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 p-4 bg-white rounded-xl border border-stone-200"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {formatDate(log.cookedOn)}
                    </p>
                    {log.notes && (
                      <p className="text-sm text-stone-600 mt-1">{log.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-stone-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <CookLogDialog
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        onLogged={handleCookLogged}
        inQueue={inQueue}
        onRemovedFromQueue={() => setInQueue(false)}
      />
    </div>
  );
}
