"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileArchive, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import type { PaprikaPreviewItem } from "@/lib/paprika-parser";

type Step = "upload" | "preview" | "importing" | "done";

type DoneResult = { saved: number; failed: number };

interface Props {
  defaultIsPublic: boolean;
}

export function PaprikaImportFlow({ defaultIsPublic }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);

  // Upload step
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Preview step
  const [allRecipes, setAllRecipes] = useState<PaprikaPreviewItem[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [isPublic, setIsPublic] = useState(defaultIsPublic);

  // Importing step
  const [importProgress, setImportProgress] = useState("");

  // Done step
  const [doneResult, setDoneResult] = useState<DoneResult | null>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (f: File) => {
      if (!f.name.endsWith(".paprikarecipes")) {
        setParseError("Please select a .paprikarecipes file exported from Paprika.");
        return;
      }
      setFile(f);
      setParseError(null);
      setIsParsing(true);

      try {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/import/paprika", { method: "POST", body: form });
        const data = await res.json();

        if (!res.ok) {
          setParseError(data.error ?? "Failed to parse file.");
          setIsParsing(false);
          return;
        }

        const items: PaprikaPreviewItem[] = data.recipes;

        // Default: select all, auto-deselect URL duplicates (keep title-only duplicates
        // selected since they could be coincidental name matches)
        const initial = new Set(
          items
            .filter((r) => !r.isDuplicate || r.duplicateType === "title")
            .map((r) => r.uid)
        );

        setAllRecipes(items);
        setSelectedUids(initial);
        setStep("preview");
      } catch {
        setParseError("Something went wrong. Please try again.");
      } finally {
        setIsParsing(false);
      }
    },
    []
  );

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleUid = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAll = () => setSelectedUids(new Set(allRecipes.map((r) => r.uid)));
  const deselectAll = () => setSelectedUids(new Set());
  const deselectDuplicates = () =>
    setSelectedUids((prev) => {
      const next = new Set(prev);
      allRecipes.filter((r) => r.isDuplicate).forEach((r) => next.delete(r.uid));
      return next;
    });

  const duplicateCount = allRecipes.filter((r) => r.isDuplicate).length;
  const selectedCount = selectedUids.size;

  // ── Import ─────────────────────────────────────────────────────────────────

  const startImport = async () => {
    if (!file || selectedUids.size === 0) return;
    setStep("importing");
    setImportProgress(`Uploading and saving ${selectedCount} recipes…`);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("selectedUids", JSON.stringify([...selectedUids]));
      form.append("isPublic", String(isPublic));

      const res = await fetch("/api/import/paprika/save", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error ?? "Import failed.");
        setStep("preview");
        return;
      }

      setDoneResult({ saved: data.saved, failed: data.failed });
      setStep("done");
    } catch {
      setParseError("Something went wrong during import.");
      setStep("preview");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
            Import from Paprika
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Export your recipes from Paprika and upload the file here. All your
            recipes will be imported in one go.
          </p>
        </div>

        <div className="rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 p-4 text-sm text-stone-600 dark:text-stone-400 space-y-1">
          <p className="font-medium text-stone-700 dark:text-stone-300">How to export from Paprika:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Open Paprika on Mac or iPhone</li>
            <li>Go to <strong>File → Export → All Recipes</strong> (Mac) or tap <strong>Settings → Export</strong> (iPhone)</li>
            <li>Save the <code className="font-mono">.paprikarecipes</code> file, then upload it below</li>
          </ol>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer
            ${isDragging
              ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
              : "border-stone-300 dark:border-stone-600 hover:border-stone-400 dark:hover:border-stone-500"
            }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".paprikarecipes"
            className="sr-only"
            onChange={onFileInputChange}
          />
          <FileArchive className="mx-auto h-10 w-10 text-stone-400 mb-3" />
          <p className="text-stone-700 dark:text-stone-300 font-medium">
            {isParsing ? "Parsing your recipes…" : "Drop your .paprikarecipes file here"}
          </p>
          <p className="text-sm text-stone-400 mt-1">or click to browse</p>
          {isParsing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <Upload className="h-4 w-4 animate-bounce" />
              Analysing file…
            </div>
          )}
        </div>

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {parseError}
          </div>
        )}
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Review your recipes
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              {allRecipes.length} recipes found
              {duplicateCount > 0 && ` · ${duplicateCount} possible duplicate${duplicateCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
            Change file
          </Button>
        </div>

        {parseError && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {parseError}
          </div>
        )}

        {/* Selection controls */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={selectAll} className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 underline underline-offset-2">
            Select all
          </button>
          <span className="text-stone-300 dark:text-stone-600">·</span>
          <button onClick={deselectAll} className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 underline underline-offset-2">
            Deselect all
          </button>
          {duplicateCount > 0 && (
            <>
              <span className="text-stone-300 dark:text-stone-600">·</span>
              <button onClick={deselectDuplicates} className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 underline underline-offset-2">
                Deselect duplicates
              </button>
            </>
          )}
        </div>

        {/* Recipe list */}
        <div className="border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden divide-y divide-stone-100 dark:divide-stone-800">
          {allRecipes.map((recipe) => (
            <label
              key={recipe.uid}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
                ${selectedUids.has(recipe.uid)
                  ? "bg-white dark:bg-stone-900"
                  : "bg-stone-50/60 dark:bg-stone-900/40 opacity-60"
                }`}
            >
              <Checkbox
                checked={selectedUids.has(recipe.uid)}
                onCheckedChange={() => toggleUid(recipe.uid)}
                className="mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-stone-900 dark:text-stone-100 truncate text-sm">
                    {recipe.name}
                  </span>
                  {recipe.isDuplicate && (
                    <Badge
                      variant="outline"
                      className={`text-xs flex-shrink-0 ${
                        recipe.duplicateType === "url"
                          ? "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                          : "border-stone-300 text-stone-500 dark:text-stone-400"
                      }`}
                    >
                      {recipe.duplicateType === "url" ? "Already saved" : "Possible duplicate"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                  {recipe.sourceName && <span>{recipe.sourceName}</span>}
                  {recipe.sourceName && <span>·</span>}
                  <span>{recipe.ingredientCount} ingredient{recipe.ingredientCount !== 1 ? "s" : ""}</span>
                  {recipe.isDuplicate && recipe.duplicateRecipeTitle && (
                    <>
                      <span>·</span>
                      <span className="truncate">
                        {recipe.duplicateType === "url" ? "Same as" : "Similar to"}{" "}
                        <a
                          href={`/recipes/${recipe.duplicateRecipeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-stone-600 dark:hover:text-stone-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {recipe.duplicateRecipeTitle}
                        </a>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Footer controls */}
        <div className="sticky bottom-0 bg-white dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 -mx-4 px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="is-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="is-public" className="text-sm text-stone-600 dark:text-stone-400 cursor-pointer">
              Make recipes public
            </Label>
          </div>
          <Button
            onClick={startImport}
            disabled={selectedCount === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
          >
            Import {selectedCount > 0 ? selectedCount : ""} recipe{selectedCount !== 1 ? "s" : ""}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-4">
        <Upload className="mx-auto h-10 w-10 text-orange-500 animate-bounce" />
        <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Importing your recipes…
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">{importProgress}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          This may take a minute for large libraries. Please don't close this page.
        </p>
      </div>
    );
  }

  // done
  return (
    <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-6">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
      <div>
        <h2 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
          Import complete
        </h2>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          {doneResult?.saved ?? 0} recipe{(doneResult?.saved ?? 0) !== 1 ? "s" : ""} imported
          {(doneResult?.failed ?? 0) > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {" "}· {doneResult!.failed} failed
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          onClick={() => router.push("/")}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          Go to my recipes
        </Button>
        <Button variant="outline" onClick={() => {
          setStep("upload");
          setFile(null);
          setAllRecipes([]);
          setSelectedUids(new Set());
          setDoneResult(null);
          setParseError(null);
        }}>
          Import another file
        </Button>
      </div>
    </div>
  );
}
