"use client";

import { useState, useRef, useEffect } from "react";
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
  Bookmark,
  ShieldAlert,
  Info,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/use-toast";
import type { ScrapedRecipe } from "@/lib/recipe-scraper";
import { extractRecipeFromJsonLd } from "@/lib/extract-recipe-client";

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

interface ImportFlowProps {
  initialStep?: Step;
  initialUrl?: string;
  initialRecipe?: ScrapedRecipe | null;
  parseError?: string;
  /** Set to "bookmarklet" when opened by the bookmarklet; triggers postMessage handshake */
  mode?: "bookmarklet";
}

function recipeToFormDefaults(
  recipe: ScrapedRecipe | null | undefined,
  url?: string
): Partial<FormData> {
  if (!recipe) return {};
  return {
    title: recipe.title ?? "",
    description: recipe.description ?? "",
    ingredients: recipe.ingredients?.length
      ? recipe.ingredients.map((i) => ({ raw: i.raw }))
      : [{ raw: "" }],
    instructions: recipe.instructions?.length
      ? recipe.instructions.map((i) => ({ text: i.text }))
      : [{ text: "" }],
    tags: recipe.tags ?? [],
    prepTime: recipe.prepTime ?? null,
    cookTime: recipe.cookTime ?? null,
    servings: recipe.servings ?? null,
    sourceUrl: url ?? "",
    sourceName: recipe.sourceName ?? "",
    imageUrl: recipe.imageUrl ?? "",
  };
}

// Blocked sites that are known to 403 server-side scrapers
const BLOCKED_SITE_HINTS = [
  "seriouseats.com",
  "nytimes.com",
  "cooking.nytimes.com",
  "bonappetit.com",
  "epicurious.com",
  "food52.com",
];

function isKnownBlockedSite(url: string) {
  return BLOCKED_SITE_HINTS.some((s) => url.includes(s));
}

export function ImportFlow({
  initialStep = "url",
  initialUrl = "",
  initialRecipe,
  parseError: initialParseError,
  mode,
}: ImportFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [url, setUrl] = useState(initialUrl);
  const [fetching, setFetching] = useState(false);
  const [parseError, setParseError] = useState<string | null>(
    initialParseError ?? null
  );
  const [showBookmarkletHelp, setShowBookmarkletHelp] = useState(false);
  const [tagInput, setTagInput] = useState("");
  // true while we're waiting for the bookmarklet's postMessage data
  const [waitingForBookmarklet, setWaitingForBookmarklet] = useState(
    mode === "bookmarklet"
  );
  const [duplicate, setDuplicate] = useState<{ id: string; title: string } | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

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
      ...recipeToFormDefaults(initialRecipe, initialUrl),
    },
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } =
    useFieldArray({ control, name: "ingredients" });
  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } =
    useFieldArray({ control, name: "instructions" });

  const tags = watch("tags");
  const isPublic = watch("isPublic");

  // Refs survive React 18 Strict Mode's effect cleanup/re-run cycle.
  // Without these, Strict Mode fires the effect twice: the first run sends
  // "aleppo:ready", the bookmarklet responds (setting its own sent=true),
  // cleanup removes the listener, then the second run sends "aleppo:ready"
  // again — which the bookmarklet ignores — leaving the second listener
  // waiting forever.
  const bookmarkletReadySent = useRef(false);
  const bookmarkletDataReceived = useRef(false);

  const populateForm = (recipe: ScrapedRecipe, sourceUrl: string) => {
    const defaults = recipeToFormDefaults(recipe, sourceUrl);
    Object.entries(defaults).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(key as any, value as any);
    });
  };

  const checkForDuplicate = async (sourceUrl: string) => {
    if (!sourceUrl) return;
    try {
      const res = await fetch(`/api/recipes/check-duplicate?url=${encodeURIComponent(sourceUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setDuplicate(data.duplicate ?? null);
        setReplaceExisting(false);
      }
    } catch {
      // non-critical, silently ignore
    }
  };

  // Bookmarklet postMessage handshake
  useEffect(() => {
    if (mode !== "bookmarklet") return;

    // StrictMode re-run: data was already received and state already updated.
    if (bookmarkletDataReceived.current) return;

    // Not opened via window.open — fall through to normal import UI.
    if (!window.opener) {
      setWaitingForBookmarklet(false);
      return;
    }

    function handleMessage(e: MessageEvent) {
      if (bookmarkletDataReceived.current) return; // deduplicate
      if (!e.data || e.data.type !== "aleppo:data") return;

      bookmarkletDataReceived.current = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = e.data.payload as any;
      const jsonld = payload?.jsonld ?? [];
      console.debug("[Aleppo bookmarklet] received JSON-LD scripts:", jsonld.length, jsonld);

      const recipe = extractRecipeFromJsonLd(jsonld, {
        pageTitle: payload?.title,
        ogImage: payload?.ogImage,
        siteName: payload?.siteName,
      });

      setWaitingForBookmarklet(false);

      if (recipe) {
        populateForm(recipe, payload?.url ?? "");
        setUrl(payload?.url ?? "");
        checkForDuplicate(payload?.url ?? "");
        setStep("review");
      } else {
        const types = jsonld.flatMap((d: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = d as any;
          return a?.["@graph"]
            ? (a["@graph"] as any[]).map((i) => i["@type"])
            : [a?.["@type"]];
        }).filter(Boolean);
        console.debug("[Aleppo bookmarklet] @types found:", types);
        setParseError(
          `No recipe structured data found on that page (found ${jsonld.length} JSON-LD block${jsonld.length !== 1 ? "s" : ""}, types: ${types.join(", ") || "none"}). Please fill in the details manually.`
        );
        setStep("review");
      }
    }

    window.addEventListener("message", handleMessage);

    // Only send "aleppo:ready" once across StrictMode re-runs — the bookmarklet
    // sets sent=true after responding, so a second signal would be ignored and
    // the second listener would wait forever.
    if (!bookmarkletReadySent.current) {
      bookmarkletReadySent.current = true;
      window.opener.postMessage({ type: "aleppo:ready" }, "*");
    }

    // Fallback: if no data after 10 s, show the normal import UI.
    const timeout = setTimeout(() => {
      if (!bookmarkletDataReceived.current) setWaitingForBookmarklet(false);
    }, 10000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setFetching(true);
    setParseError(null);
    setDuplicate(null);
    setReplaceExisting(false);

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

      if (err === "blocked") {
        setParseError("blocked");
        setStep("review");
        return;
      }

      if (err) setParseError(err);

      if (recipe) {
        populateForm(recipe, url.trim());
        checkForDuplicate(url.trim());
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
      instructions: data.instructions.map((inst, idx) => ({ step: idx + 1, text: inst.text })),
    };

    const isReplace = replaceExisting && duplicate;
    const res = await fetch(isReplace ? `/api/recipes/${duplicate.id}` : "/api/recipes", {
      method: isReplace ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      toast({ title: "Failed to save recipe", variant: "destructive" });
      return;
    }

    const saved = await res.json();
    toast({ title: isReplace ? "Recipe updated!" : "Recipe imported!", variant: "success" });
    router.push(`/recipes/${saved.id}`);
    router.refresh();
  };

  // ── Bookmarklet loading state ────────────────────────────────────────────────

  if (waitingForBookmarklet) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-stone-600 text-sm">Receiving recipe from your browser…</p>
      </div>
    );
  }

  // ── URL entry step ──────────────────────────────────────────────────────────

  if (step === "url") {
    const mightBlock = isKnownBlockedSite(url);

    return (
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Import from URL</h1>
          <p className="text-stone-500 text-sm mt-1">
            Paste a link to any recipe. We&apos;ll parse it — you review and
            edit before saving.
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
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {fetching ? "Fetching…" : "Import"}
              </Button>
            </div>
          </div>

          {mightBlock && (
            <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
              <span>
                This site often blocks automated imports. Try it — if it
                fails, use the{" "}
                <button
                  type="button"
                  onClick={() => setShowBookmarkletHelp(true)}
                  className="underline font-medium"
                >
                  Aleppo bookmarklet
                </button>{" "}
                instead.
              </span>
            </div>
          )}
        </form>

        {/* Bookmarklet section */}
        <div className="border-t border-stone-200 pt-6 space-y-4">
          <button
            type="button"
            onClick={() => setShowBookmarkletHelp(!showBookmarkletHelp)}
            className="flex items-center gap-2 text-sm font-medium text-stone-700 hover:text-stone-900"
          >
            <Bookmark className="h-4 w-4 text-amber-500" />
            Use the Aleppo bookmarklet for protected sites
            <span className="text-stone-400">{showBookmarkletHelp ? "▲" : "▼"}</span>
          </button>

          {showBookmarkletHelp && <BookmarkletInstructions />}
        </div>

        <div className="text-sm text-stone-500 space-y-1">
          <p className="font-medium text-stone-700">
            Works directly (no bookmarklet needed):
          </p>
          <ul className="space-y-0.5 list-disc list-inside text-stone-500">
            <li>AllRecipes, Simply Recipes, Serious Eats ✱</li>
            <li>Food Network, Epicurious, King Arthur</li>
            <li>Most sites using Schema.org recipe markup</li>
          </ul>
          <p className="text-xs text-stone-400">
            ✱ These sometimes block automated requests — use the bookmarklet if
            the URL import fails.
          </p>
        </div>
      </div>
    );
  }

  // ── Review step ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Review import</h1>
          <p className="text-stone-500 text-sm mt-1">
            Check the parsed recipe and make any edits before saving.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => setStep("url")}>
            ← Back
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting || parseError === "blocked"}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save recipe
          </Button>
        </div>
      </div>

      {/* Error banners */}
      {parseError === "blocked" ? (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-800">
              This site blocked the import
            </p>
            <p className="text-sm text-amber-700">
              Sites like Serious Eats and NYT Cooking use bot protection that
              blocks server-side requests. Use the{" "}
              <strong>Aleppo bookmarklet</strong> to import from your browser
              instead — it runs on the page you&apos;re already viewing, so
              there&apos;s nothing to block.
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("url");
                setShowBookmarkletHelp(true);
              }}
              className="text-sm font-medium text-amber-800 underline"
            >
              Set up the bookmarklet →
            </button>
          </div>
        </div>
      ) : parseError ? (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Partial import</p>
            <p className="text-sm text-amber-700 mt-0.5">{parseError}</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            Recipe parsed successfully. Review the fields below.
          </p>
        </div>
      )}

      {duplicate && (
        <div className="flex gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
          <Copy className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-sky-900">You already have this recipe</p>
              <p className="text-sm text-sky-700 mt-0.5">
                <a
                  href={`/recipes/${duplicate.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium hover:text-sky-900"
                >
                  {duplicate.title}
                </a>{" "}
                is already in your collection.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={replaceExisting} onCheckedChange={setReplaceExisting} />
              <span className="text-sm text-sky-800">
                Replace that recipe with this import
              </span>
            </label>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prepTime">Prep (min)</Label>
          <Input id="prepTime" type="number" min="1" {...register("prepTime", { setValueAs: (v) => (v === "" || v == null || isNaN(Number(v)) ? null : parseInt(v, 10)) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cookTime">Cook (min)</Label>
          <Input id="cookTime" type="number" min="1" {...register("cookTime", { setValueAs: (v) => (v === "" || v == null || isNaN(Number(v)) ? null : parseInt(v, 10)) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="servings">Servings</Label>
          <Input id="servings" type="number" min="1" {...register("servings", { setValueAs: (v) => (v === "" || v == null || isNaN(Number(v)) ? null : parseInt(v, 10)) })} />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Ingredients ({ingredientFields.length})</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => appendIngredient({ raw: "" })}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {ingredientFields.map((field, i) => (
            <div key={field.id} className="flex gap-2">
              <Input placeholder="e.g. 2 cups all-purpose flour" {...register(`ingredients.${i}.raw`)} />
              {ingredientFields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(i)} className="text-stone-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Instructions ({instructionFields.length})</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => appendInstruction({ text: "" })}>
            <Plus className="h-4 w-4" /> Add step
          </Button>
        </div>
        <div className="space-y-2">
          {instructionFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold mt-2.5">{i + 1}</div>
              <Textarea rows={2} placeholder={`Step ${i + 1}...`} {...register(`instructions.${i}.text`)} />
              {instructionFields.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeInstruction(i)} className="text-stone-400 hover:text-red-500 flex-shrink-0">
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
          <Input placeholder="Add a tag…" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
          <Button type="button" variant="outline" onClick={addTag}>Add</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button key={tag} type="button" onClick={() => removeTag(tag)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs hover:bg-red-50 hover:text-red-700 transition-colors">
                {tag} <span className="text-stone-400">×</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
        <div>
          <p className="text-sm font-medium text-stone-900">{isPublic ? "Public recipe" : "Private recipe"}</p>
          <p className="text-xs text-stone-500">{isPublic ? "Visible to anyone with the link" : "Only visible to you"}</p>
        </div>
        <Switch checked={isPublic} onCheckedChange={(v) => setValue("isPublic", v)} />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
        <Button type="button" variant="outline" onClick={() => setStep("url")}>Back</Button>
        <Button type="submit" disabled={isSubmitting || parseError === "blocked"}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save recipe
        </Button>
      </div>
    </form>
  );
}

// ── Bookmarklet installer ────────────────────────────────────────────────────

function BookmarkletInstructions() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  // React blocks javascript: URLs in href as a security measure, so we must
  // set the href directly on the DOM node after mount, bypassing React's
  // sanitization. This is the standard pattern for bookmarklet links in React.
  useEffect(() => {
    if (!linkRef.current) return;
    const appUrl = window.location.origin;
    const code = `(function(){var base=${JSON.stringify(appUrl)};var scripts=document.querySelectorAll('script[type="application/ld+json"]');var jsonld=[];for(var i=0;i<scripts.length;i++){try{jsonld.push(JSON.parse(scripts[i].textContent));}catch(e){}}var payload={jsonld:jsonld,url:location.href,title:document.title,ogImage:((document.querySelector('meta[property="og:image"]')||{}).content)||'',siteName:((document.querySelector('meta[property="og:site_name"]')||{}).content)||''};var w=window.open(base+'/recipes/import?mode=bookmarklet','aleppo_import','width=1100,height=800');if(!w){alert('Aleppo: allow popups for this site, then click the bookmarklet again.');return;}var sent=false;function onMsg(e){if(!e.data||e.data.type!=='aleppo:ready'||sent)return;sent=true;window.removeEventListener('message',onMsg);w.postMessage({type:'aleppo:data',payload:payload},base);}window.addEventListener('message',onMsg);setTimeout(function(){window.removeEventListener('message',onMsg);},30000);})();`;
    linkRef.current.href = `javascript:${encodeURIComponent(code)}`;
  }, []);

  return (
    <div className="space-y-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-stone-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-stone-600">
          The bookmarklet runs in your browser on the recipe page you&apos;re
          viewing — Cloudflare and other bot protection can&apos;t block it
          because you&apos;re already there.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-900">
          Step 1 — Drag this button to your bookmarks bar:
        </p>
        <div className="flex items-center gap-3">
          {/* href is set via DOM ref in useEffect to bypass React's javascript: URL block */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            ref={linkRef}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert("Drag this button to your bookmarks bar — don't click it here!");
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium shadow-sm cursor-grab active:cursor-grabbing select-none"
            draggable
          >
            <Bookmark className="h-4 w-4" />
            + Aleppo
          </a>
          <span className="text-xs text-stone-500">← drag me to your bookmarks bar</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-900">
          Step 2 — Use it:
        </p>
        <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
          <li>Navigate to any recipe page (e.g. Serious Eats, NYT Cooking)</li>
          <li>Click <strong>+ Aleppo</strong> in your bookmarks bar</li>
          <li>You&apos;ll be brought here to review and save the recipe</li>
        </ol>
      </div>

      <p className="text-xs text-stone-400">
        The bookmarklet only reads the recipe data from the current page — it
        doesn&apos;t collect any other information.
      </p>
    </div>
  );
}
