import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { PhotoPicker } from "@/components/PhotoPicker";
import * as DocumentPicker from "expo-document-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";
import { RecipeWebExtractor } from "@/components/RecipeWebExtractor";

type Mode = "url" | "images" | "text" | "paprika";
type Step = "url" | "review";

type PaprikaStep = "upload" | "preview" | "importing" | "done";
type PaprikaItem = {
  uid: string;
  name: string;
  sourceName?: string;
  ingredientCount: number;
  hasPhoto: boolean;
  isDuplicate?: boolean;
  duplicateType?: "url" | "title";
  duplicateRecipeId?: string;
  duplicateRecipeTitle?: string;
};

type Ingredient = { raw: string };
type Instruction = { step: number; text: string };

export default function ImportScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { mode: modeParam, shareUrl } = useLocalSearchParams<{ mode?: string; shareUrl?: string }>();

  const [mode, setMode] = useState<Mode>("url");
  const [step, setStep] = useState<Step>("url");
  const [photos, setPhotos] = useState<string[]>([]);

  // ── Share sheet extraction (native) ───────────────────────────────────────
  const [extracting, setExtracting] = useState(!!shareUrl);
  const [extractionUrl, setExtractionUrl] = useState(shareUrl ?? "");
  const extractionDone = useRef(false);

  // ── Bookmarklet mode ────────────────────────────────────────────────────────
  const [waitingForBookmarklet, setWaitingForBookmarklet] = useState(
    modeParam === "bookmarklet"
  );
  const bookmarkletReadySent = useRef(false);
  const bookmarkletDataReceived = useRef(false);

  // ── URL step state ──────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // ── Review step state ───────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ raw: "" }]);
  const [instructions, setInstructions] = useState<Instruction[]>([{ step: 1, text: "" }]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Paprika state ────────────────────────────────────────────────────────────
  const [paprikaStep, setPaprikaStep] = useState<PaprikaStep>("upload");
  const [paprikaFile, setPaprikaFile] = useState<{ uri: string; name: string; file?: File } | null>(null);
  const [paprikaItems, setPaprikaItems] = useState<PaprikaItem[]>([]);
  const [paprikaSelected, setPaprikaSelected] = useState<Set<string>>(new Set());
  const [paprikaPublic, setPaprikaPublic] = useState(false);
  const [paprikaParsing, setPaprikaParsing] = useState(false);
  const [paprikaError, setPaprikaError] = useState<string | null>(null);
  const [paprikaSaved, setPaprikaSaved] = useState(0);
  const [paprikaFailed, setPaprikaFailed] = useState(0);

  const pickPaprikaFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === "ios" ? "public.data" : "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.name.endsWith(".paprikarecipes")) {
      setPaprikaError("Please select a .paprikarecipes file exported from Paprika.");
      return;
    }
    setPaprikaError(null);
    setPaprikaParsing(true);
    setPaprikaFile({ uri: asset.uri, name: asset.name, file: asset.file });
    const fileForForm: any = asset.file ?? { uri: asset.uri, name: asset.name, type: "application/octet-stream" };
    try {
      const form = new FormData();
      form.append("file", fileForForm);
      const res = await fetch(`${API_URL}/api/import/paprika`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setPaprikaError(data.error ?? "Failed to parse file."); return; }
      const items: PaprikaItem[] = data.recipes;
      const initial = new Set(
        items.filter((r) => !r.isDuplicate || r.duplicateType === "title").map((r) => r.uid)
      );
      setPaprikaItems(items);
      setPaprikaSelected(initial);
      setPaprikaStep("preview");
    } catch {
      setPaprikaError("Could not connect to server.");
    } finally {
      setPaprikaParsing(false);
    }
  };

  const startPaprikaImport = async () => {
    if (!paprikaFile || paprikaSelected.size === 0) return;
    setPaprikaStep("importing");
    try {
      const form = new FormData();
      const fileForForm: any = paprikaFile.file ?? { uri: paprikaFile.uri, name: paprikaFile.name, type: "application/octet-stream" };
      form.append("file", fileForForm);
      form.append("selectedUids", JSON.stringify([...paprikaSelected]));
      form.append("isPublic", String(paprikaPublic));
      const res = await fetch(`${API_URL}/api/import/paprika/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setPaprikaError(data.error ?? "Import failed."); setPaprikaStep("preview"); return; }
      setPaprikaSaved(data.saved);
      setPaprikaFailed(data.failed ?? 0);
      setPaprikaStep("done");
    } catch {
      setPaprikaError("Something went wrong during import.");
      setPaprikaStep("preview");
    }
  };

  const resetPaprika = () => {
    setPaprikaStep("upload");
    setPaprikaFile(null);
    setPaprikaItems([]);
    setPaprikaSelected(new Set());
    setPaprikaError(null);
    setPaprikaSaved(0);
    setPaprikaFailed(0);
  };

  // ── Bookmarklet postMessage handshake ───────────────────────────────────────

  useEffect(() => {
    if (modeParam !== "bookmarklet" || Platform.OS !== "web") return;
    if (bookmarkletDataReceived.current) return;

    const w = window as any;
    if (!w.opener) {
      setWaitingForBookmarklet(false);
      return;
    }

    async function handleMessage(e: MessageEvent) {
      if (bookmarkletDataReceived.current) return;
      if (!e.data || e.data.type !== "aleppo:data") return;

      bookmarkletDataReceived.current = true;
      setWaitingForBookmarklet(false);

      const payload = e.data.payload;
      // Read token fresh from localStorage — the closure may have captured a
      // null value if auth hadn't finished loading when the effect first ran.
      const currentToken =
        Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
      try {
        const res = await fetch(`${API_URL}/api/import/bookmarklet`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setParseError(
            res.status === 401
              ? "Authentication error — please reload and try again."
              : data.error ?? "Import failed. Please fill in the details manually."
          );
          setStep("review");
          return;
        }
        if (data.recipe) populateForm(data.recipe, payload?.url ?? "");
        else setParseError("No recipe structured data found on that page. Please fill in the details manually.");
        setUrl(payload?.url ?? "");
        setStep("review");
      } catch {
        setParseError("Failed to connect to server.");
        setStep("review");
      }
    }

    window.addEventListener("message", handleMessage as any);

    if (!bookmarkletReadySent.current) {
      bookmarkletReadySent.current = true;
      w.opener.postMessage({ type: "aleppo:ready" }, "*");
    }

    const timeout = setTimeout(() => {
      if (!bookmarkletDataReceived.current) setWaitingForBookmarklet(false);
    }, 10000);

    return () => {
      window.removeEventListener("message", handleMessage as any);
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeParam]);

  // ── Share sheet extraction callbacks ────────────────────────────────────────

  const handleExtractResult = async (payload: {
    jsonld: unknown[];
    url: string;
    title: string;
    ogImage: string;
    siteName: string;
    commentsUrl: string | null;
  }) => {
    if (extractionDone.current) return;
    extractionDone.current = true;

    // Read token fresh — same pattern as bookmarklet handler
    const currentToken =
      Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
    try {
      const res = await fetch(`${API_URL}/api/import/bookmarklet`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(
          res.status === 401
            ? "Authentication error — please try again."
            : data.error ?? "Import failed. Please fill in the details manually."
        );
        setStep("review");
      } else if (data.recipe) {
        populateForm(data.recipe, payload?.url ?? "");
        setUrl(payload?.url ?? "");
        setStep("review");
      } else {
        setParseError("No recipe structured data found on that page. Please fill in the details manually.");
        setUrl(payload?.url ?? "");
        setStep("review");
      }
    } catch {
      setParseError("Failed to connect to server.");
      setUrl(payload?.url ?? "");
      setStep("review");
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractError = async (_message: string) => {
    if (extractionDone.current) return;
    extractionDone.current = true;
    const currentUrl = extractionUrl;
    // Stop the WebView, pre-fill the URL field, show fetch spinner
    setExtracting(false);
    setExtractionUrl("");
    setUrl(currentUrl);
    setFetching(true);
    setParseError(null);
    // Automatically fall back to server-side scraping (has Playwright fallback)
    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: currentUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Failed to fetch URL");
        return;
      }
      if (data.parseError) setParseError(data.parseError);
      if (data.recipe) populateForm(data.recipe, currentUrl);
      else populateForm({}, currentUrl);
      setStep("review");
    } catch {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setFetching(false);
    }
  };

  // ── URL step ────────────────────────────────────────────────────────────────

  const populateForm = (recipe: ScrapedRecipe, fetchedUrl: string) => {
    setTitle(recipe.title ?? "");
    setDescription(recipe.description ?? "");
    setIngredients(
      recipe.ingredients?.length ? recipe.ingredients : [{ raw: "" }]
    );
    setInstructions(
      recipe.instructions?.length
        ? recipe.instructions.map((ins, i) => ({ step: i + 1, text: ins.text }))
        : [{ step: 1, text: "" }]
    );
    setTags(recipe.tags ?? []);
    setPrepTime(recipe.prepTime ? String(recipe.prepTime) : "");
    setCookTime(recipe.cookTime ? String(recipe.cookTime) : "");
    setServings(recipe.servings ? String(recipe.servings) : "");
    setSourceUrl(recipe.sourceUrl ?? fetchedUrl);
    setSourceName(recipe.sourceName ?? "");
    setImageUrl(recipe.imageUrl);
  };

  const handleFetch = () => {
    if (!url.trim()) return;
    setParseError(null);
    // Always use client-side WebView extraction first; handleExtractError
    // falls back to server-side scraping if the WebView fails.
    extractionDone.current = false;
    setExtractionUrl(url.trim());
    setExtracting(true);
  };

  // ── Review step ─────────────────────────────────────────────────────────────

  const addIngredient = () => setIngredients((p) => [...p, { raw: "" }]);
  const updateIngredient = (i: number, v: string) =>
    setIngredients((p) => p.map((ing, j) => (j === i ? { raw: v } : ing)));
  const removeIngredient = (i: number) =>
    setIngredients((p) => (p.length === 1 ? [{ raw: "" }] : p.filter((_, j) => j !== i)));

  const addInstruction = () =>
    setInstructions((p) => [...p, { step: p.length + 1, text: "" }]);
  const updateInstruction = (i: number, v: string) =>
    setInstructions((p) => p.map((ins, j) => (j === i ? { ...ins, text: v } : ins)));
  const removeInstruction = (i: number) =>
    setInstructions((p) =>
      p.length === 1
        ? [{ step: 1, text: "" }]
        : p.filter((_, j) => j !== i).map((ins, j) => ({ ...ins, step: j + 1 }))
    );

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  };
  const removeTag = (tag: string) => setTags((p) => p.filter((t) => t !== tag));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        ingredients: ingredients.filter((ing) => ing.raw.trim()),
        instructions: instructions
          .filter((ins) => ins.text.trim())
          .map((ins, i) => ({ step: i + 1, text: ins.text.trim() })),
        tags,
        prepTime: prepTime ? parseInt(prepTime, 10) : undefined,
        cookTime: cookTime ? parseInt(cookTime, 10) : undefined,
        servings: servings ? parseInt(servings, 10) : undefined,
        isPublic,
        sourceUrl: sourceUrl.trim() || undefined,
        sourceName: sourceName.trim() || undefined,
        imageUrl: imageUrl || undefined,
      };
      const res = await fetch(`${API_URL}/api/recipes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const recipe = await res.json();
      router.replace(`/recipes/${recipe.id}`);
    } catch {
      setErrors({ _form: "Failed to save recipe. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (extracting && extractionUrl) {
    let hostname = "";
    try { hostname = new URL(extractionUrl).hostname; } catch {}
    return (
      <View style={styles.bookmarkletWaiting}>
        <ActivityIndicator size="large" color="#d97706" />
        <Text style={styles.bookmarkletWaitingText}>
          Extracting recipe from {hostname || "page"}…
        </Text>
        <RecipeWebExtractor
          url={extractionUrl}
          onResult={handleExtractResult}
          onError={handleExtractError}
        />
      </View>
    );
  }

  if (waitingForBookmarklet) {
    return (
      <View style={styles.bookmarkletWaiting}>
        <ActivityIndicator size="large" color="#d97706" />
        <Text style={styles.bookmarkletWaitingText}>Receiving recipe from your browser…</Text>
      </View>
    );
  }

  const segments: { key: Mode; label: string; icon: string }[] = [
    { key: "url",     label: "URL",     icon: "link-outline" },
    { key: "images",  label: "Images",  icon: "images-outline" },
    { key: "paprika", label: "Paprika", icon: "archive-outline" },
    { key: "text",    label: "Text",    icon: "document-text-outline" },
  ];

  if (step === "url") {
    return (
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.urlContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Segmented control */}
        <View style={styles.segmentedControl}>
          {segments.map((seg) => {
            const active = mode === seg.key;
            return (
              <TouchableOpacity
                key={seg.key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setMode(seg.key)}
              >
                <Ionicons
                  name={seg.icon as any}
                  size={14}
                  color={active ? "#1c1917" : "#a8a29e"}
                />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {seg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {mode === "url" && (
          <>
            <Text style={styles.heading}>Import from URL</Text>
            <Text style={styles.subheading}>
              Paste a link to any recipe. We'll parse it — you review and edit before saving.
            </Text>

            <View style={styles.urlRow}>
              <TextInput
                style={[styles.input, styles.urlInput]}
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor="#a8a29e"
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleFetch}
              />
              <TouchableOpacity
                style={[styles.fetchButton, (!url.trim() || fetching) && styles.fetchButtonDisabled]}
                onPress={handleFetch}
                disabled={!url.trim() || fetching}
              >
                {fetching
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.fetchButtonText}>Import</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={styles.hintBox}>
              <Text style={styles.hintTitle}>Works well with:</Text>
              <Text style={styles.hintItem}>· AllRecipes, Simply Recipes, NYT Cooking</Text>
              <Text style={styles.hintItem}>· Food Network, Epicurious, King Arthur</Text>
              <Text style={styles.hintItem}>· Most sites using Schema.org recipe markup</Text>
            </View>

            <BookmarkletSection />
          </>
        )}

        {mode === "images" && (
          <View style={styles.imagesMode}>
            <Text style={styles.heading}>Import from photos</Text>
            <Text style={styles.subheading}>
              Add photos of a recipe — handwritten, printed, or a screenshot — and we'll extract it for you.
            </Text>
            <PhotoPicker mode="multiple" onPhotos={setPhotos}>
              {(open, pickedPhotos, removePhoto) => (
                <View style={styles.photoRow}>
                  <TouchableOpacity style={styles.cameraButton} onPress={open}>
                    <Ionicons name="camera" size={22} color="#78716c" />
                    <View style={styles.plusBadge}>
                      <Ionicons name="add" size={11} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  {pickedPhotos.map((uri, i) => (
                    <View key={uri} style={styles.thumbWrapper}>
                      <Image source={{ uri }} style={styles.thumb} />
                      <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(i)}>
                        <Ionicons name="close-circle" size={18} color="#1c1917" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </PhotoPicker>
            {photos.length > 0 && (
              <TouchableOpacity style={styles.fetchButton}>
                <Text style={styles.fetchButtonText}>Extract recipe</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {mode === "paprika" && (
          <View style={styles.paprikaMode}>
            {paprikaStep === "upload" && (
              <>
                <Text style={styles.heading}>Import from Paprika</Text>
                <Text style={styles.subheading}>
                  Export your library from Paprika (File → Export → All Recipes on Mac, or Settings → Export on iPhone), then select the .paprikarecipes file below.
                </Text>
                {paprikaError ? (
                  <View style={styles.paprikaError}>
                    <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
                    <Text style={styles.paprikaErrorText}>{paprikaError}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.fetchButton, paprikaParsing && styles.fetchButtonDisabled]}
                  onPress={pickPaprikaFile}
                  disabled={paprikaParsing}
                >
                  {paprikaParsing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.fetchButtonText}>Choose .paprikarecipes file</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {paprikaStep === "preview" && (
              <>
                <View style={styles.paprikaPreviewHeader}>
                  <View>
                    <Text style={styles.heading}>{paprikaItems.length} recipes found</Text>
                    {paprikaItems.filter((r) => r.isDuplicate).length > 0 && (
                      <Text style={styles.subheading}>
                        {paprikaItems.filter((r) => r.isDuplicate).length} possible duplicate{paprikaItems.filter((r) => r.isDuplicate).length !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={resetPaprika}>
                    <Text style={styles.paprikaChangeFile}>Change file</Text>
                  </TouchableOpacity>
                </View>

                {paprikaError ? (
                  <View style={styles.paprikaError}>
                    <Ionicons name="alert-circle-outline" size={15} color="#b91c1c" />
                    <Text style={styles.paprikaErrorText}>{paprikaError}</Text>
                  </View>
                ) : null}

                <View style={styles.paprikaSelectRow}>
                  <TouchableOpacity onPress={() => setPaprikaSelected(new Set(paprikaItems.map((r) => r.uid)))}>
                    <Text style={styles.paprikaSelectLink}>Select all</Text>
                  </TouchableOpacity>
                  <Text style={styles.paprikaDot}>·</Text>
                  <TouchableOpacity onPress={() => setPaprikaSelected(new Set())}>
                    <Text style={styles.paprikaSelectLink}>Deselect all</Text>
                  </TouchableOpacity>
                  {paprikaItems.some((r) => r.isDuplicate) && (
                    <>
                      <Text style={styles.paprikaDot}>·</Text>
                      <TouchableOpacity onPress={() => setPaprikaSelected((prev) => { const next = new Set(prev); paprikaItems.filter((r) => r.isDuplicate).forEach((r) => next.delete(r.uid)); return next; })}>
                        <Text style={styles.paprikaSelectLink}>Deselect duplicates</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <ScrollView style={styles.paprikaList} scrollEnabled={false}>
                  {paprikaItems.map((item) => (
                    <TouchableOpacity
                      key={item.uid}
                      style={[styles.paprikaItem, paprikaSelected.has(item.uid) && styles.paprikaItemSelected]}
                      onPress={() => setPaprikaSelected((prev) => { const next = new Set(prev); next.has(item.uid) ? next.delete(item.uid) : next.add(item.uid); return next; })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.paprikaCheckbox, paprikaSelected.has(item.uid) && styles.paprikaCheckboxChecked]}>
                        {paprikaSelected.has(item.uid) && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <View style={styles.paprikaItemBody}>
                        <Text style={styles.paprikaItemName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.paprikaItemMeta}>
                          {item.sourceName ? <Text style={styles.paprikaItemMetaText}>{item.sourceName} · </Text> : null}
                          <Text style={styles.paprikaItemMetaText}>{item.ingredientCount} ingredient{item.ingredientCount !== 1 ? "s" : ""}</Text>
                          {item.isDuplicate && (
                            <Text style={[styles.paprikaBadge, item.duplicateType === "url" ? styles.paprikaBadgeDupe : styles.paprikaBadgeMaybe]}>
                              {item.duplicateType === "url" ? " · Already saved" : " · Possible duplicate"}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.paprikaFooter}>
                  <View style={styles.paprikaPublicRow}>
                    <Switch value={paprikaPublic} onValueChange={setPaprikaPublic} trackColor={{ true: "#1c1917" }} />
                    <Text style={styles.paprikaPublicLabel}>Make recipes public</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.fetchButton, paprikaSelected.size === 0 && styles.fetchButtonDisabled]}
                    onPress={startPaprikaImport}
                    disabled={paprikaSelected.size === 0}
                  >
                    <Text style={styles.fetchButtonText}>
                      Import {paprikaSelected.size} recipe{paprikaSelected.size !== 1 ? "s" : ""}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {paprikaStep === "importing" && (
              <View style={styles.paprikaCentered}>
                <ActivityIndicator size="large" color="#d97706" />
                <Text style={styles.paprikaImportingText}>Importing recipes…</Text>
                <Text style={styles.paprikaImportingSubtext}>This may take a minute for large libraries. Please don't close this page.</Text>
              </View>
            )}

            {paprikaStep === "done" && (
              <View style={styles.paprikaCentered}>
                <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
                <Text style={styles.paprikaDoneTitle}>Import complete</Text>
                <Text style={styles.paprikaDoneSubtext}>
                  {paprikaSaved} recipe{paprikaSaved !== 1 ? "s" : ""} imported
                  {paprikaFailed > 0 ? ` · ${paprikaFailed} failed` : ""}
                </Text>
                <TouchableOpacity style={styles.fetchButton} onPress={() => router.replace("/(tabs)/recipes")}>
                  <Text style={styles.fetchButtonText}>Go to my recipes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.paprikaAnotherBtn} onPress={resetPaprika}>
                  <Text style={styles.paprikaAnotherText}>Import another file</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {mode === "text" && (
          <View style={styles.tbd}>
            <Ionicons name="document-text-outline" size={32} color="#d6d3d1" />
            <Text style={styles.tbdText}>Import from text — coming soon</Text>
          </View>
        )}
      </KeyboardAwareScrollView>
    );
  }

  // Review step
  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep("url")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#1c1917" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review import</Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveButtonText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Parse result banner */}
      {parseError ? (
        <View style={styles.bannerWarn}>
          <Ionicons name="warning-outline" size={16} color="#92400e" style={{ marginTop: 1 }} />
          <Text style={styles.bannerWarnText}>
            Partial import — {parseError}
          </Text>
        </View>
      ) : (
        <View style={styles.bannerOk}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#166534" style={{ marginTop: 1 }} />
          <Text style={styles.bannerOkText}>Parsed successfully. Review before saving.</Text>
        </View>
      )}

      {errors._form ? (
        <View style={styles.formError}>
          <Text style={styles.formErrorText}>{errors._form}</Text>
        </View>
      ) : null}

      {/* Scraped image preview */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
      ) : null}

      {/* Title */}
      <View style={styles.field}>
        <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          value={title}
          onChangeText={setTitle}
          placeholder="Recipe title"
          placeholderTextColor="#a8a29e"
          maxLength={300}
        />
        {errors.title ? <Text style={styles.fieldError}>{errors.title}</Text> : null}
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description"
          placeholderTextColor="#a8a29e"
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />
      </View>

      {/* Times & Servings */}
      <View style={styles.field}>
        <Text style={styles.label}>Times & Servings</Text>
        <View style={styles.row3}>
          <View style={styles.row3Item}>
            <Text style={styles.subLabel}>Prep (min)</Text>
            <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime}
              placeholder="0" placeholderTextColor="#a8a29e" keyboardType="number-pad" />
          </View>
          <View style={styles.row3Item}>
            <Text style={styles.subLabel}>Cook (min)</Text>
            <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime}
              placeholder="0" placeholderTextColor="#a8a29e" keyboardType="number-pad" />
          </View>
          <View style={styles.row3Item}>
            <Text style={styles.subLabel}>Servings</Text>
            <TextInput style={styles.input} value={servings} onChangeText={setServings}
              placeholder="0" placeholderTextColor="#a8a29e" keyboardType="number-pad" />
          </View>
        </View>
      </View>

      {/* Ingredients */}
      <View style={styles.field}>
        <Text style={styles.label}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.listItem}>
            <View style={styles.listItemBullet}>
              <Text style={styles.listItemBulletText}>·</Text>
            </View>
            <TextInput
              style={[styles.input, styles.listItemInput]}
              value={ing.raw}
              onChangeText={(v) => updateIngredient(i, v)}
              placeholder={`Ingredient ${i + 1}`}
              placeholderTextColor="#a8a29e"
            />
            <TouchableOpacity onPress={() => removeIngredient(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={20} color="#a8a29e" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
          <Ionicons name="add" size={16} color="#57534e" />
          <Text style={styles.addButtonText}>Add ingredient</Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.field}>
        <Text style={styles.label}>Instructions</Text>
        {instructions.map((ins, i) => (
          <View key={i} style={styles.listItem}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{i + 1}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.listItemInput, styles.textareaSmall]}
              value={ins.text}
              onChangeText={(v) => updateInstruction(i, v)}
              placeholder={`Step ${i + 1}`}
              placeholderTextColor="#a8a29e"
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity onPress={() => removeInstruction(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={20} color="#a8a29e" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addInstruction}>
          <Ionicons name="add" size={16} color="#57534e" />
          <Text style={styles.addButtonText}>Add step</Text>
        </TouchableOpacity>
      </View>

      {/* Tags */}
      <View style={styles.field}>
        <Text style={styles.label}>Tags</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Add a tag"
            placeholderTextColor="#a8a29e"
            autoCapitalize="none"
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                <Text style={styles.tagChipText}>{tag}</Text>
                <Ionicons name="close" size={12} color="#57534e" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Source */}
      <View style={styles.field}>
        <Text style={styles.label}>Source</Text>
        <TextInput
          style={[styles.input, { marginBottom: 8 }]}
          value={sourceUrl}
          onChangeText={setSourceUrl}
          placeholder="Source URL"
          placeholderTextColor="#a8a29e"
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextInput
          style={styles.input}
          value={sourceName}
          onChangeText={setSourceName}
          placeholder="Source name (optional)"
          placeholderTextColor="#a8a29e"
        />
      </View>

      {/* Privacy */}
      <View style={styles.field}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLeft}>
            <Ionicons
              name={isPublic ? "globe-outline" : "lock-closed-outline"}
              size={20}
              color="#57534e"
            />
            <View>
              <Text style={styles.toggleLabel}>{isPublic ? "Public" : "Private"}</Text>
              <Text style={styles.toggleSub}>
                {isPublic ? "Anyone can view this recipe" : "Only you can see this recipe"}
              </Text>
            </View>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: "#e7e5e4", true: "#1c1917" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Bottom save */}
      <View style={styles.bottomSaveRow}>
        <TouchableOpacity
          style={[styles.saveButtonFull, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveButtonText}>Save recipe</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </KeyboardAwareScrollView>
  );
}

// ── Bookmarklet section (web-only) ─────────────────────────────────────────

// Renders a draggable bookmarklet button for web; hidden on native.
// Uses React.createElement('a', ...) to produce a real HTML <a> element in
// React Native Web — the only way to get browser drag-to-bookmark behaviour.
function BookmarkletSection() {
  const [open, setOpen] = useState(false);
  const linkRef = useRef<any>(null);

  useEffect(() => {
    if (!open || !linkRef.current || Platform.OS !== "web") return;
    const appUrl = (window as any).location.origin;
    // Same bookmarklet as the web app, but opens /import instead of /recipes/import
    const code = `(function(){var base=${JSON.stringify(appUrl)};var scripts=document.querySelectorAll('script[type="application/ld+json"]');var jsonld=[];for(var i=0;i<scripts.length;i++){try{jsonld.push(JSON.parse(scripts[i].textContent));}catch(e){}}var re=document.querySelector('[itemtype="https://schema.org/Recipe"],[itemtype="http://schema.org/Recipe"]');if(re){var md={'@type':'Recipe','recipeIngredient':[],'recipeInstructions':[]};var n=re.querySelector('[itemprop="name"]');if(n)md.name=n.textContent.trim();var ings=re.querySelectorAll('[itemprop="recipeIngredient"]');for(var j=0;j<ings.length;j++){var s=ings[j].textContent.trim();if(s)md.recipeIngredient.push(s);}var yr=re.querySelector('[itemprop="recipeYield"]');if(yr)md.recipeYield=yr.textContent.trim().replace(/^servings:\\s*/i,'');var tf=['totalTime','cookTime','prepTime'];for(var j=0;j<tf.length;j++){var tel=re.querySelector('[itemprop="'+tf[j]+'"]');if(tel)md[tf[j]]=tel.getAttribute('datetime')||tel.textContent.trim();}var iels=re.querySelectorAll('[itemprop="recipeInstructions"]');if(iels.length){for(var j=0;j<iels.length;j++){var s=iels[j].textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}else{var de=re.querySelector('.e-instructions,.jetpack-recipe-directions');if(de){var ps=de.querySelectorAll('p');if(ps.length){for(var j=0;j<ps.length;j++){var s=ps[j].textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}else{var s=de.textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}}if(md.name||md.recipeIngredient.length)jsonld.push(md);}var commentIds=['comments','disqus_thread','respond'];var commentClasses=['.comments-area','.comment-list'];var commentsUrl=null;for(var ci=0;ci<commentIds.length;ci++){if(document.getElementById(commentIds[ci])){commentsUrl=location.href+'#'+commentIds[ci];break;}}if(!commentsUrl){for(var ci=0;ci<commentClasses.length;ci++){if(document.querySelector(commentClasses[ci])){commentsUrl=location.href+'#comments';break;}}}var payload={jsonld:jsonld,url:location.href,title:document.title,ogImage:((document.querySelector('meta[property="og:image"]')||{}).content)||'',siteName:((document.querySelector('meta[property="og:site_name"]')||{}).content)||'',commentsUrl:commentsUrl};var w=window.open(base+'/import?mode=bookmarklet','aleppo_import','width=1100,height=800');if(!w){alert('Aleppo: allow popups for this site, then click the bookmarklet again.');return;}var sent=false;function onMsg(e){if(!e.data||e.data.type!=='aleppo:ready'||sent)return;sent=true;window.removeEventListener('message',onMsg);w.postMessage({type:'aleppo:data',payload:payload},base);}window.addEventListener('message',onMsg);setTimeout(function(){window.removeEventListener('message',onMsg);},30000);})();`;
    linkRef.current.href = `javascript:${encodeURIComponent(code)}`;
  }, [open]);

  if (Platform.OS !== "web") return null;

  // Cast to any so TypeScript doesn't complain about the raw 'a' element
  const A = "a" as unknown as React.ComponentType<any>;

  return (
    <View style={bkStyles.container}>
      <TouchableOpacity style={bkStyles.toggle} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="bookmark-outline" size={16} color="#d97706" />
        <Text style={bkStyles.toggleText}>Use the Aleppo bookmarklet (works on any site)</Text>
        <Text style={bkStyles.toggleChevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={bkStyles.panel}>
          <View style={bkStyles.infoRow}>
            <Ionicons name="information-circle-outline" size={15} color="#78716c" />
            <Text style={bkStyles.infoText}>
              The bookmarklet runs in your browser on the recipe page — Cloudflare and bot
              protection can't block it because you're already there.
            </Text>
          </View>

          <Text style={bkStyles.stepLabel}>Step 1 — Drag this button to your bookmarks bar:</Text>
          <View style={bkStyles.dragRow}>
            {/* Real HTML <a> for drag-to-bookmark; href set via ref in useEffect */}
            <A
              ref={linkRef}
              href="#"
              draggable
              onClick={(e: any) => {
                e.preventDefault();
                alert("Drag this button to your bookmarks bar — don't click it here!");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                backgroundColor: "#d97706",
                color: "#fff",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: "600",
                cursor: "grab",
                userSelect: "none",
                textDecoration: "none",
              }}
            >
              🔖 + Aleppo
            </A>
            <Text style={bkStyles.dragHint}>← drag me to your bookmarks bar</Text>
          </View>

          <Text style={bkStyles.stepLabel}>Step 2 — Use it:</Text>
          <Text style={bkStyles.stepItem}>1. Go to any recipe page (e.g. Serious Eats)</Text>
          <Text style={bkStyles.stepItem}>2. Click <Text style={{ fontWeight: "700" }}>+ Aleppo</Text> in your bookmarks bar</Text>
          <Text style={bkStyles.stepItem}>3. You'll be brought here to review and save the recipe</Text>

          <Text style={bkStyles.fine}>
            The bookmarklet only reads recipe data from the current page — nothing else.
          </Text>
        </View>
      )}
    </View>
  );
}

const bkStyles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingTop: 16,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#57534e" },
  toggleChevron: { fontSize: 11, color: "#a8a29e" },
  panel: {
    marginTop: 14,
    backgroundColor: "#f5f5f4",
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  infoRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, color: "#78716c", lineHeight: 18 },
  stepLabel: { fontSize: 13, fontWeight: "600", color: "#1c1917" },
  dragRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dragHint: { fontSize: 12, color: "#a8a29e", fontStyle: "italic" },
  stepItem: { fontSize: 13, color: "#57534e", lineHeight: 20 },
  fine: { fontSize: 11, color: "#a8a29e" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  bookmarkletWaiting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#fafaf9",
  },
  bookmarkletWaitingText: { fontSize: 15, color: "#78716c" },

  // ── URL step ────────────────────────────────────────────────────────────────
  urlContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 72 : 32,
    paddingBottom: 48,
    gap: 20,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#e7e5e4",
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#a8a29e",
  },
  segmentTextActive: {
    color: "#1c1917",
  },
  tbd: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
  },
  tbdText: {
    fontSize: 14,
    color: "#a8a29e",
  },
  imagesMode: { gap: 16 },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
  },
  cameraButton: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#f5f5f4",
    borderWidth: 1.5,
    borderColor: "#d6d3d1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  plusBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#78716c",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbWrapper: { position: "relative" },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#f5f5f4",
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 9,
  },
  heading: { fontSize: 24, fontWeight: "700", color: "#1c1917" },
  subheading: { fontSize: 14, color: "#78716c", lineHeight: 20 },
  urlRow: { flexDirection: "row", gap: 8 },
  urlInput: { flex: 1 },
  fetchButton: {
    backgroundColor: "#1c1917",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  fetchButtonDisabled: { opacity: 0.5 },
  fetchButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  hintBox: {
    backgroundColor: "#f5f5f4",
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  hintTitle: { fontSize: 13, fontWeight: "600", color: "#57534e", marginBottom: 4 },
  hintItem: { fontSize: 13, color: "#78716c" },

  // ── Review step ─────────────────────────────────────────────────────────────
  content: { paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16,
    backgroundColor: "#fafaf9",
    borderBottomWidth: 1,
    borderBottomColor: "#e7e5e4",
    marginBottom: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1c1917" },
  saveButton: {
    backgroundColor: "#1c1917",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: "center",
  },
  saveButtonFull: {
    backgroundColor: "#1c1917",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  imagePreview: {
    width: "100%",
    height: 200,
    marginBottom: 16,
  },
  bannerOk: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    padding: 12,
  },
  bannerOkText: { flex: 1, fontSize: 13, color: "#166534", lineHeight: 18 },
  bannerWarn: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 12,
  },
  bannerWarnText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },
  formError: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
  },
  formErrorText: { fontSize: 13, color: "#b91c1c" },

  // Shared form styles (same as new.tsx)
  field: { paddingHorizontal: 16, marginTop: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#1c1917", marginBottom: 8 },
  subLabel: { fontSize: 12, color: "#78716c", marginBottom: 4 },
  required: { color: "#b91c1c" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1c1917",
  },
  inputError: { borderColor: "#b91c1c" },
  textarea: { height: 90, textAlignVertical: "top", paddingTop: 10 },
  textareaSmall: { height: 70, paddingTop: 8 },
  fieldError: { fontSize: 12, color: "#b91c1c", marginTop: 4 },
  row3: { flexDirection: "row", gap: 8 },
  row3Item: { flex: 1 },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  listItemBullet: { marginTop: 12, width: 16, alignItems: "center" },
  listItemBulletText: { fontSize: 20, color: "#d97706", lineHeight: 22 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#1c1917", justifyContent: "center", alignItems: "center",
    marginTop: 10, flexShrink: 0,
  },
  stepBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  listItemInput: { flex: 1 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  addButtonText: { fontSize: 14, color: "#57534e" },
  tagInputRow: { flexDirection: "row", gap: 8 },
  tagAddBtn: {
    backgroundColor: "#1c1917", borderRadius: 8,
    paddingHorizontal: 14, justifyContent: "center",
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f5f5f4", borderRadius: 20,
    borderWidth: 1, borderColor: "#e7e5e4",
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagChipText: { fontSize: 13, color: "#57534e", fontWeight: "500" },
  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#e7e5e4", padding: 14,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: "500", color: "#1c1917" },
  toggleSub: { fontSize: 12, color: "#78716c", marginTop: 1 },
  bottomSaveRow: { paddingHorizontal: 16, marginTop: 24 },

  // Paprika
  paprikaMode: { gap: 16 },
  paprikaPreviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  paprikaChangeFile: { fontSize: 13, color: "#78716c", textDecorationLine: "underline", marginTop: 4 },
  paprikaError: { flexDirection: "row", gap: 6, alignItems: "flex-start", backgroundColor: "#fef2f2", borderRadius: 8, padding: 10 },
  paprikaErrorText: { flex: 1, fontSize: 13, color: "#b91c1c" },
  paprikaSelectRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paprikaSelectLink: { fontSize: 13, color: "#78716c", textDecorationLine: "underline" },
  paprikaDot: { fontSize: 13, color: "#d6d3d1" },
  paprikaList: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 10, overflow: "hidden" },
  paprikaItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e7e5e4",
    backgroundColor: "#fafaf9",
    opacity: 0.5,
  },
  paprikaItemSelected: { backgroundColor: "#fff", opacity: 1 },
  paprikaCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#d6d3d1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  paprikaCheckboxChecked: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  paprikaItemBody: { flex: 1 },
  paprikaItemName: { fontSize: 14, fontWeight: "500", color: "#1c1917" },
  paprikaItemMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  paprikaItemMetaText: { fontSize: 12, color: "#a8a29e" },
  paprikaBadge: { fontSize: 12, fontWeight: "500" },
  paprikaBadgeDupe: { color: "#b45309" },
  paprikaBadgeMaybe: { color: "#78716c" },
  paprikaFooter: { gap: 12, marginTop: 4 },
  paprikaPublicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  paprikaPublicLabel: { fontSize: 14, color: "#57534e" },
  paprikaCentered: { alignItems: "center", paddingVertical: 40, gap: 12 },
  paprikaImportingText: { fontSize: 17, fontWeight: "600", color: "#1c1917" },
  paprikaImportingSubtext: { fontSize: 13, color: "#78716c", textAlign: "center", paddingHorizontal: 16 },
  paprikaDoneTitle: { fontSize: 22, fontWeight: "700", color: "#1c1917" },
  paprikaDoneSubtext: { fontSize: 14, color: "#78716c" },
  paprikaAnotherBtn: { marginTop: 4 },
  paprikaAnotherText: { fontSize: 14, color: "#78716c", textDecorationLine: "underline" },
});
