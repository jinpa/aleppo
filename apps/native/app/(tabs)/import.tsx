import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Switch, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe, UserSettings, Ingredient } from "@aleppo/shared";
import { UserAvatar } from "@/components/UserAvatar";
import { ImportUrlHandler } from "@/components/import/ImportUrlHandler";
import { ImportImagesHandler } from "@/components/import/ImportImagesHandler";
import { ImportTextHandler } from "@/components/import/ImportTextHandler";
import { ImportFileMode } from "@/components/import/ImportFileMode";
import { ImportReview } from "@/components/import/ImportReview";
import { CookingSpinner } from "@/components/CookingSpinner";
import { getClientLanguage } from "@/components/import/TranslationToggle";
import type { ImportOutcome } from "@/components/import/types";

type Mode = "url" | "images" | "text" | "file";

type ReviewData = {
  recipe: ScrapedRecipe;
  parseError?: string;
  aiGenerated?: boolean;
  commentsUrl?: string;
};

type BatchData = {
  recipes: ScrapedRecipe[];
};

const segments: { key: Mode; label: string; icon: string }[] = [
  { key: "url",    label: "Link",   icon: "link-outline" },
  { key: "images", label: "Images", icon: "images-outline" },
  { key: "file",   label: "File",   icon: "archive-outline" },
  { key: "text",   label: "Text",   icon: "document-text-outline" },
];

export default function ImportScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { mode: modeParam, shareUrl } = useLocalSearchParams<{ mode?: string; shareUrl?: string }>();

  const [mode, setMode] = useState<Mode>("url");
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string | undefined>(getClientLanguage());

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: UserSettings = await res.json();
        setTargetLanguage(data.translateAI ? getClientLanguage() : undefined);
      }
    } catch (err) {
      console.error("Failed to fetch settings for import:", err);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
      // Reset state when tab regains focus (e.g. after saving a recipe)
      setReviewData(null);
      setBatchData(null);
      setError(null);
    }, [fetchSettings])
  );

  const handleComplete = (outcome: ImportOutcome) => {
    if (!outcome.ok) {
      setError(outcome.error);
    } else {
      setError(null);
      setReviewData({ recipe: outcome.recipe, parseError: outcome.parseError, aiGenerated: outcome.aiGenerated, commentsUrl: outcome.commentsUrl });
    }
  };

  const handleBatchComplete = (recipes: ScrapedRecipe[]) => {
    setError(null);
    setBatchData({ recipes });
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
  };

  if (reviewData) {
    return (
      <ImportReview
        recipe={reviewData.recipe}
        parseError={reviewData.parseError}
        aiGenerated={reviewData.aiGenerated}
        commentsUrl={reviewData.commentsUrl}
        token={token}
        onBack={() => setReviewData(null)}
        router={router}
      />
    );
  }

  if (batchData) {
    return (
      <BatchReview
        recipes={batchData.recipes}
        token={token}
        router={router}
        onBack={() => setBatchData(null)}
      />
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Import</Text>
        <TouchableOpacity onPress={() => router.navigate("/profile")} style={styles.avatarButton}>
          <UserAvatar name={user?.name} image={user?.image} size={34} />
        </TouchableOpacity>
      </View>

      <View style={styles.segmentedControl}>
        {segments.map((seg) => {
          const active = mode === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => handleModeChange(seg.key)}
            >
              <Ionicons name={seg.icon as any} size={14} color={active ? "#1c1917" : "#a8a29e"} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {seg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" style={{ marginTop: 1 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {mode === "url" && (
        <ImportUrlHandler
          token={token}
          modeParam={modeParam}
          shareUrl={shareUrl}
          onComplete={handleComplete}
          onBatchComplete={handleBatchComplete}
          onAttempt={() => setError(null)}
          initialLanguage={targetLanguage}
        />
      )}

      {mode === "images" && (
        <ImportImagesHandler
          token={token}
          onComplete={handleComplete}
          onAttempt={() => setError(null)}
          initialLanguage={targetLanguage}
        />
      )}

      {mode === "file" && (
        <ImportFileMode
          token={token}
          router={router}
          onComplete={handleComplete}
          onBatchComplete={handleBatchComplete}
          onAttempt={() => setError(null)}
          initialLanguage={targetLanguage}
        />
      )}

      {mode === "text" && (
        <ImportTextHandler
          token={token}
          onComplete={handleComplete}
          onAttempt={() => setError(null)}
          initialLanguage={targetLanguage}
        />
      )}
    </KeyboardAwareScrollView>
  );
}

function BatchReview({
  recipes,
  token,
  router,
  onBack,
}: {
  recipes: ScrapedRecipe[];
  token: string | null;
  router: { replace: (path: any) => void };
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(recipes.map((_, i) => i)));
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);
  const [failed, setFailed] = useState(0);
  const [done, setDone] = useState(false);

  const toggleItem = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    let ok = 0;
    let fail = 0;
    const currentToken = Platform.OS === "web" ? localStorage.getItem("auth_token") : token;

    for (const idx of selected) {
      const recipe = recipes[idx];
      try {
        const body = {
          title: recipe.title || "Untitled",
          description: recipe.description || undefined,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          tags: recipe.tags,
          prepTime: recipe.prepTime || undefined,
          cookTime: recipe.cookTime || undefined,
          servings: recipe.servings || undefined,
          isPublic,
          sourceUrl: recipe.sourceUrl || undefined,
          sourceName: recipe.sourceName || undefined,
          imageUrl: recipe.imageUrl || undefined,
        };
        const res = await fetch(`${API_URL}/api/recipes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }

    setSaved(ok);
    setFailed(fail);
    setDone(true);
    setSaving(false);
  };

  if (done) {
    return (
      <View style={batchStyles.centered}>
        <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
        <Text style={batchStyles.doneTitle}>Import complete</Text>
        <Text style={batchStyles.doneSub}>
          {saved} recipe{saved !== 1 ? "s" : ""} imported
          {failed > 0 ? ` · ${failed} failed` : ""}
        </Text>
        <TouchableOpacity
          style={batchStyles.doneBtn}
          onPress={() => router.replace("/(tabs)/recipes")}
        >
          <Text style={batchStyles.doneBtnText}>Go to my recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={batchStyles.anotherBtn} onPress={onBack}>
          <Text style={batchStyles.anotherText}>Import more</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (saving) {
    return <CookingSpinner label="Importing recipes…" />;
  }

  return (
    <View style={batchStyles.container}>
      <View style={batchStyles.header}>
        <TouchableOpacity onPress={onBack} style={batchStyles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1c1917" />
        </TouchableOpacity>
        <Text style={batchStyles.title}>{recipes.length} recipes found</Text>
      </View>

      <View style={batchStyles.selectRow}>
        <TouchableOpacity onPress={() => setSelected(new Set(recipes.map((_, i) => i)))}>
          <Text style={batchStyles.selectLink}>Select all</Text>
        </TouchableOpacity>
        <Text style={batchStyles.dot}>·</Text>
        <TouchableOpacity onPress={() => setSelected(new Set())}>
          <Text style={batchStyles.selectLink}>Deselect all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={batchStyles.list} scrollEnabled={false}>
        {recipes.map((recipe, i) => {
          const ingredients = recipe.ingredients as Ingredient[] | undefined;
          const ingCount = ingredients?.length ?? 0;
          const isSelected = selected.has(i);
          return (
            <TouchableOpacity
              key={i}
              style={[batchStyles.item, isSelected && batchStyles.itemSelected]}
              onPress={() => toggleItem(i)}
              activeOpacity={0.7}
            >
              <View style={[batchStyles.checkbox, isSelected && batchStyles.checkboxChecked]}>
                {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <View style={batchStyles.itemBody}>
                <Text style={batchStyles.itemName} numberOfLines={1}>
                  {recipe.title || "Untitled recipe"}
                </Text>
                <Text style={batchStyles.itemMeta}>
                  {ingCount} ingredient{ingCount !== 1 ? "s" : ""}
                  {recipe.sourceName ? ` · ${recipe.sourceName}` : ""}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={batchStyles.footer}>
        <View style={batchStyles.publicRow}>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: "#1c1917" }} />
          <Text style={batchStyles.publicLabel}>Make recipes public</Text>
        </View>
        <TouchableOpacity
          style={[batchStyles.importBtn, selected.size === 0 && batchStyles.importBtnDisabled]}
          onPress={handleImport}
          disabled={selected.size === 0}
        >
          <Text style={batchStyles.importBtnText}>
            Import {selected.size} recipe{selected.size !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const batchStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafaf9",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 72 : 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: "700", color: "#1c1917" },
  selectRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  selectLink: { fontSize: 13, color: "#78716c", textDecorationLine: "underline" },
  dot: { fontSize: 13, color: "#d6d3d1" },
  list: {
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 10,
    overflow: "hidden",
  },
  item: {
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
  itemSelected: { backgroundColor: "#fff", opacity: 1 },
  checkbox: {
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
  checkboxChecked: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  itemBody: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "500", color: "#1c1917" },
  itemMeta: { fontSize: 12, color: "#a8a29e", marginTop: 2 },
  footer: { gap: 12, marginTop: 4 },
  publicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  publicLabel: { fontSize: 14, color: "#57534e" },
  importBtn: {
    backgroundColor: "#1c1917",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  centered: {
    flex: 1,
    backgroundColor: "#fafaf9",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 72 : 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  doneTitle: { fontSize: 22, fontWeight: "700", color: "#1c1917" },
  doneSub: { fontSize: 14, color: "#78716c" },
  doneBtn: {
    backgroundColor: "#1c1917",
    borderRadius: 10,
    paddingVertical: 14,
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 8,
  },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  anotherBtn: { marginTop: 4 },
  anotherText: { fontSize: 14, color: "#78716c", textDecorationLine: "underline" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 72 : 32,
    paddingBottom: 48,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#1c1917" },
  avatarButton: { borderRadius: 20 },
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
  segmentText: { fontSize: 13, fontWeight: "500", color: "#a8a29e" },
  segmentTextActive: { color: "#1c1917" },
  errorBanner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: "#b91c1c", lineHeight: 18 },
});
