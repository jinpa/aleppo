"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import {
  Plus,
  Trash2,
  GripVertical,
  Upload,
  Loader2,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/use-toast";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional(),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  sourceName: z.string().max(200).optional(),
  imageUrl: z.string().optional(),
  ingredients: z.array(z.object({ raw: z.string().min(1, "Required") })),
  instructions: z.array(z.object({ text: z.string().min(1, "Required") })),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  notes: z.string().max(5000).optional(),
  prepTime: z.number().int().positive().optional().nullable(),
  cookTime: z.number().int().positive().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface RecipeFormProps {
  initialData?: Partial<FormData & { id: string }>;
  mode: "create" | "edit";
}

export function RecipeForm({ initialData, mode }: RecipeFormProps) {
  const router = useRouter();
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      sourceUrl: initialData?.sourceUrl ?? "",
      sourceName: initialData?.sourceName ?? "",
      imageUrl: initialData?.imageUrl ?? "",
      ingredients: initialData?.ingredients?.length
        ? initialData.ingredients.map((i) => ({ raw: typeof i === "string" ? i : i.raw }))
        : [{ raw: "" }],
      instructions: initialData?.instructions?.length
        ? initialData.instructions.map((i) => ({ text: typeof i === "string" ? i : i.text }))
        : [{ text: "" }],
      tags: initialData?.tags ?? [],
      isPublic: initialData?.isPublic ?? false,
      notes: initialData?.notes ?? "",
      prepTime: initialData?.prepTime ?? null,
      cookTime: initialData?.cookTime ?? null,
      servings: initialData?.servings ?? null,
    },
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } =
    useFieldArray({ control, name: "ingredients" });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } =
    useFieldArray({ control, name: "instructions" });

  const tags = watch("tags");
  const isPublic = watch("isPublic");
  const imageUrl = watch("imageUrl");

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setValue("tags", [...tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setValue("tags", tags.filter((t) => t !== tag));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setValue("imageUrl", url);
      toast({ title: "Image uploaded", variant: "success" });
    } else {
      toast({ title: "Image upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const onSubmit = async (data: FormData) => {
    const body = {
      ...data,
      ingredients: data.ingredients.map((ing) => ({
        raw: ing.raw,
        name: ing.raw,
      })),
      instructions: data.instructions.map((inst, idx) => ({
        step: idx + 1,
        text: inst.text,
      })),
    };

    const url =
      mode === "edit" ? `/api/recipes/${initialData?.id}` : "/api/recipes";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({
        title: `Failed to ${mode} recipe`,
        description: err.error,
        variant: "destructive",
      });
      return;
    }

    const recipe = await res.json();
    toast({
      title: mode === "edit" ? "Recipe updated" : "Recipe created",
      variant: "success",
    });
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-stone-900">
          {mode === "edit" ? "Edit recipe" : "New recipe"}
        </h1>
      </div>

      {/* Basic Info */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Pasta Carbonara"
            {...register("title")}
          />
          {errors.title && (
            <p className="text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="A brief description of the recipe..."
            rows={3}
            {...register("description")}
          />
        </div>

        {/* Image */}
        <div className="space-y-1.5">
          <Label>Photo</Label>
          {imageUrl ? (
            <div className="relative">
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-stone-200">
                <Image
                  src={imageUrl}
                  alt="Recipe"
                  fill
                  className="object-cover"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setValue("imageUrl", "")}
              >
                Remove
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-stone-300 cursor-pointer hover:border-stone-400 transition-colors bg-stone-50">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              ) : (
                <>
                  <Upload className="h-6 w-6 text-stone-400 mb-1" />
                  <span className="text-sm text-stone-500">
                    Click to upload photo
                  </span>
                  <span className="text-xs text-stone-400 mt-0.5">
                    JPEG, PNG or WebP up to 10MB
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {/* Times & Servings */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="prepTime">Prep (min)</Label>
            <Input
              id="prepTime"
              type="number"
              min="1"
              placeholder="15"
              {...register("prepTime", {
                setValueAs: (v) => (v === "" ? null : parseInt(v, 10)),
              })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cookTime">Cook (min)</Label>
            <Input
              id="cookTime"
              type="number"
              min="1"
              placeholder="30"
              {...register("cookTime", {
                setValueAs: (v) => (v === "" ? null : parseInt(v, 10)),
              })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              min="1"
              placeholder="4"
              {...register("servings", {
                setValueAs: (v) => (v === "" ? null : parseInt(v, 10)),
              })}
            />
          </div>
        </div>
      </section>

      {/* Ingredients */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Ingredients</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendIngredient({ raw: "" })}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {ingredientFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
              <GripVertical className="h-4 w-4 text-stone-300 mt-2.5 flex-shrink-0" />
              <div className="flex-1">
                <Input
                  placeholder={`e.g. 2 cups all-purpose flour`}
                  {...register(`ingredients.${i}.raw`)}
                />
                {errors.ingredients?.[i]?.raw && (
                  <p className="text-xs text-red-600 mt-0.5">Required</p>
                )}
              </div>
              {ingredientFields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(i)}
                  className="flex-shrink-0 text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Instructions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Instructions</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendInstruction({ text: "" })}
          >
            <Plus className="h-4 w-4" />
            Add step
          </Button>
        </div>
        <div className="space-y-2">
          {instructionFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold mt-2.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <Textarea
                  placeholder={`Step ${i + 1}...`}
                  rows={2}
                  {...register(`instructions.${i}.text`)}
                />
                {errors.instructions?.[i]?.text && (
                  <p className="text-xs text-red-600 mt-0.5">Required</p>
                )}
              </div>
              {instructionFields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeInstruction(i)}
                  className="flex-shrink-0 text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tags */}
      <section className="space-y-3">
        <Label className="text-base font-semibold">Tags</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag (e.g. Italian, weeknight)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className="group flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                {tag}
                <span className="text-stone-400 group-hover:text-red-500">×</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Source */}
      <section className="space-y-3">
        <Label className="text-base font-semibold">Source</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sourceUrl" className="text-sm font-normal">URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              placeholder="https://..."
              {...register("sourceUrl")}
            />
            {errors.sourceUrl && (
              <p className="text-xs text-red-600">{errors.sourceUrl.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sourceName" className="text-sm font-normal">Name</Label>
            <Input
              id="sourceName"
              placeholder="e.g. NYT Cooking"
              {...register("sourceName")}
            />
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-3">
        <Label htmlFor="notes" className="text-base font-semibold">
          My notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Personal notes, substitutions, tips..."
          rows={3}
          {...register("notes")}
        />
      </section>

      {/* Privacy */}
      <section className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
        <div className="flex items-center gap-3">
          {isPublic ? (
            <Globe className="h-5 w-5 text-stone-600" />
          ) : (
            <Lock className="h-5 w-5 text-stone-600" />
          )}
          <div>
            <p className="text-sm font-medium text-stone-900">
              {isPublic ? "Public recipe" : "Private recipe"}
            </p>
            <p className="text-xs text-stone-500">
              {isPublic
                ? "Visible to anyone with the link and your followers"
                : "Only visible to you"}
            </p>
          </div>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(v) => setValue("isPublic", v)}
        />
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "edit" ? "Save changes" : "Save recipe"}
        </Button>
      </div>
    </form>
  );
}
