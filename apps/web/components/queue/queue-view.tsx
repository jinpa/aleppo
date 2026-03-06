"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, ChefHat, X, BookmarkCheck, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

function SortableQueueItem({
  item,
  onRemove,
}: {
  item: QueueItem;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.recipe.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const totalTime = (item.recipe.prepTime ?? 0) + (item.recipe.cookTime ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-3 items-center bg-white rounded-2xl border border-stone-200 p-4 transition-colors ${
        isDragging
          ? "shadow-lg border-stone-300 opacity-90 z-10"
          : "hover:border-stone-300"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 rounded-md text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

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
        onClick={() => onRemove(item.recipe.id)}
        className="flex-shrink-0 p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="Remove from queue"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function QueueView({ items: initialItems }: { items: QueueItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

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

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.recipe.id === active.id);
      const newIndex = items.findIndex((i) => i.recipe.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);

      setItems(reordered);

      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((i) => i.recipe.id) }),
      });

      if (!res.ok) {
        setItems(items);
        toast({ title: "Failed to save order", variant: "destructive" });
      }
    },
    [items]
  );

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.recipe.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {items.map((item) => (
                <SortableQueueItem
                  key={item.recipe.id}
                  item={item}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
