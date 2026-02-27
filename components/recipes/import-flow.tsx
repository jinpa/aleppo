"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Link2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  ingredients: z.array(z.object({ raw: z.string().min(1) })),
  instructions: z.array(z.object({ text: z.string().min(1) })),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  notes: z.string().optional(),
  prepTime: z.number().int().positive().optional().nullable(),
  cookTime: z.number().int().positive().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  sourceUrl: z.string().optional(),
  sourceName: z.string().optional(),
  imageUrl: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

type Step = "url" | "review";

export function ImportFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      ingredients: [{ raw: "" }],
      instructions: [{ text: "" }],
      tags: [],
      isPublic: false,
      notes: "",
    },
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } =
    useFieldArray({ control, name: "ingredients" });
  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } =
    useFieldArray({ control, name: "instructions" });

  const tags = watch("tags");
  const isPublic = watch("isPublic");

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setFetching(true);
    setParseError(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: data.error || "Failed to fetch URL", variant: "destructive" });
        return;
      }

      const { recipe, parseError: err } = data;

      if (err) setParseError(err);

      if (recipe) {
        setValue("title", recipe.title ?? "");
        setValue("description", recipe.description ?? "");
        setValue(
          "ingredients",
          recipe.ingredients?.length
            ? recipe.ingredients.map((i: { raw: string }) => ({ raw: i.raw }))
            : [{ raw: "" }]
        );
        setValue(
          "instructions",
          recipe.instructions?.length
            ? recipe.instructions.map((i: { text: string }) => ({ text: i.text }))
            : [{ text: "" }]
        );
        setValue("tags", recipe.tags ?? []);
        setValue("prepTime", recipe.prepTime ?? null);
        setValue("cookTime", recipe.cookTime ?? null);
        setValue("servings", recipe.servings ?? null);
        setValue("sourceUrl", url.trim());
        setValue("sourceName", recipe.sourceName ?? "");
        setValue("imageUrl", recipe.imageUrl ?? "");
      }

      setStep("review");
    } catch {
      toast({ title: "Failed to fetch URL", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setValue("tags", [...tags, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setValue("tags", tags.filter((t) => t !== tag));
  };

  const onSubmit = async (data: FormData) => {
    const body = {
      ...data,
      ingredients: data.ingredients.map((ing) => ({ raw: ing.raw, name: ing.raw })),
      instructions: data.instructions.map((inst, i) => ({ step: i + 1, text: inst.text })),
    };

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      toast({ title: "Failed to save recipe", variant: "destructive" });
      return;
    }

    const recipe = await res.json();
    toast({ title: "Recipe imported!", variant: "success" });
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  };

  if (step === "url") {
    return (
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Import from URL</h1>
          <p className="text-stone-500 text-sm mt-1">
            Paste a link to any recipe from the web. We&apos;ll parse it for you — you
            can review and edit before saving.
          </p>
        </div>

        <form onSubmit={handleFetch} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="url">Recipe URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://www.seriouseats.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              <Button type="submit" disabled={fetching || !url.trim()}>
                {fetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {fetching ? "Fetching..." : "Import"}
              </Button>
            </div>
          </div>
        </form>

        <div className="text-sm text-stone-500 space-y-1">
          <p className="font-medium text-stone-700">Works well with:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Serious Eats, Bon Appétit, Food Network</li>
            <li>NYT Cooking, AllRecipes, Epicurious</li>
            <li>Most sites using structured recipe data</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Review import</h1>
          <p className="text-stone-500 text-sm mt-1">
            Check the parsed recipe and make any edits before saving.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStep("url")}
        >
          ← Back
        </Button>
      </div>

      {parseError && (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Partial import
            </p>
            <p className="text-sm text-amber-700 mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {!parseError && (
        <div className="flex gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            Recipe parsed successfully. Review the fields below.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">
          Title <span className="text-red-500">*</span>
        </Label>
        <Input id="title" {...register("title")} />
        {errors.title && (
          <p className="text-xs text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prepTime">Prep (min)</Label>
          <Input
            id="prepTime"
            type="number"
            min="1"
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
            {...register("servings", {
              setValueAs: (v) => (v === "" ? null : parseInt(v, 10)),
            })}
          />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            Ingredients ({ingredientFields.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendIngredient({ raw: "" })}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {ingredientFields.map((field, i) => (
            <div key={field.id} className="flex gap-2">
              <Input
                placeholder="Ingredient..."
                {...register(`ingredients.${i}.raw`)}
              />
              {ingredientFields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(i)}
                  className="text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            Instructions ({instructionFields.length})
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendInstruction({ text: "" })}
          >
            <Plus className="h-4 w-4" /> Add step
          </Button>
        </div>
        <div className="space-y-2">
          {instructionFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold mt-2.5">
                {i + 1}
              </div>
              <Textarea
                rows={2}
                {...register(`instructions.${i}.text`)}
              />
              {instructionFields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeInstruction(i)}
                  className="text-stone-400 hover:text-red-500 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-base font-semibold">Tags</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add a tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
            }}
          />
          <Button type="button" variant="outline" onClick={addTag}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs hover:bg-red-50 hover:text-red-700 transition-colors"
              >
                {tag} <span className="text-stone-400">×</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
        <div>
          <p className="text-sm font-medium text-stone-900">
            {isPublic ? "Public recipe" : "Private recipe"}
          </p>
          <p className="text-xs text-stone-500">
            {isPublic ? "Visible to anyone with the link" : "Only visible to you"}
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(v) => setValue("isPublic", v)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
        <Button type="button" variant="outline" onClick={() => setStep("url")}>
          Back
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save recipe
        </Button>
      </div>
    </form>
  );
}
