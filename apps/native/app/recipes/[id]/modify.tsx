import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import { NavShell } from "@/components/NavShell";
import {
  getPendingModification,
  clearPendingModification,
} from "@/stores/ai-modify";

type Ingredient = { raw: string };
type Instruction = { step: number; text: string };

export default function ModifyPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();

  const [loaded, setLoaded] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [originalImages, setOriginalImages] = useState<{ url: string; role?: string }[]>([]);
  const [originalAuthorName, setOriginalAuthorName] = useState<string | null>(null);
  const [originalSourceUrl, setOriginalSourceUrl] = useState<string | null>(null);
  const [originalSourceName, setOriginalSourceName] = useState<string | null>(null);

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
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiImageError, setAiImageError] = useState<string | null>(null);
  const [aiImageAccepted, setAiImageAccepted] = useState(false);

  useEffect(() => {
    const pending = getPendingModification();
    if (!pending) {
      router.back();
      return;
    }

    const { original, modified, isOwner: owner } = pending;
    setIsOwner(owner);
    setOriginalImages(original.images ?? (original.imageUrl ? [{ url: original.imageUrl }] : []));
    setOriginalAuthorName(original.author?.name ?? null);
    setOriginalSourceUrl(original.sourceUrl ?? null);
    setOriginalSourceName(original.sourceName ?? null);

    // Pre-populate with AI-modified fields, fall back to original
    const m = modified;
    setTitle(typeof m.title === "string" ? m.title : original.title);
    setDescription(typeof m.description === "string" ? m.description : original.description ?? "");

    const ings = Array.isArray(m.ingredients)
      ? m.ingredients.map((i: Record<string, unknown>) => ({ raw: typeof i.raw === "string" ? i.raw : JSON.stringify(i) }))
      : original.ingredients.map((i) => ({ raw: i.raw }));
    setIngredients(ings.length > 0 ? ings : [{ raw: "" }]);

    const steps = Array.isArray(m.instructions)
      ? m.instructions.map((i: Record<string, unknown>, idx: number) => ({
          step: typeof i.step === "number" ? i.step : idx + 1,
          text: typeof i.text === "string" ? i.text : "",
        }))
      : original.instructions;
    setInstructions(steps.length > 0 ? steps : [{ step: 1, text: "" }]);

    setTags(Array.isArray(m.tags) ? m.tags.filter((t: unknown): t is string => typeof t === "string") : original.tags);
    setPrepTime(m.prepTime != null ? String(m.prepTime) : original.prepTime ? String(original.prepTime) : "");
    setCookTime(m.cookTime != null ? String(m.cookTime) : original.cookTime ? String(original.cookTime) : "");
    setServings(m.servings != null ? String(m.servings) : original.servings ? String(original.servings) : "");
    setIsPublic(false);
    setNotes("");

    setLoaded(true);
    clearPendingModification();
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (title.length > 300) e.title = "Max 300 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addIngredient = () => setIngredients((p) => [...p, { raw: "" }]);
  const updateIngredient = (i: number, v: string) =>
    setIngredients((p) => p.map((ing, idx) => (idx === i ? { raw: v } : ing)));
  const removeIngredient = (i: number) => {
    if (ingredients.length === 1) { setIngredients([{ raw: "" }]); return; }
    setIngredients((p) => p.filter((_, idx) => idx !== i));
  };

  const addInstruction = () =>
    setInstructions((p) => [...p, { step: p.length + 1, text: "" }]);
  const updateInstruction = (i: number, v: string) =>
    setInstructions((p) => p.map((ins, idx) => (idx === i ? { ...ins, text: v } : ins)));
  const removeInstruction = (i: number) => {
    if (instructions.length === 1) { setInstructions([{ step: 1, text: "" }]); return; }
    setInstructions((p) => p.filter((_, idx) => idx !== i).map((ins, idx) => ({ ...ins, step: idx + 1 })));
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  };

  const generateImage = async (mode: "generate" | "edit") => {
    setAiImageError(null);
    setAiImageUrl(null);
    setAiImageAccepted(false);
    setAiImageLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/recipes/${id}/modify-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate image");
      }
      const data = await res.json();
      setAiImageUrl(data.imageUrl);
    } catch (err) {
      setAiImageError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setAiImageLoading(false);
    }
  };

  const hasUnresolvedImage = !!(aiImageUrl && !aiImageAccepted);
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [pendingSave, setPendingSave] = useState<"new" | "apply" | null>(null);

  const buildBody = (useAiImage?: boolean) => {
    const includeAi = useAiImage ?? aiImageAccepted;
    return {
      title: title.trim(),
      description: description.trim() || null,
      ingredients: ingredients.filter((i) => i.raw.trim()),
      instructions: instructions
        .filter((i) => i.text.trim())
        .map((i, idx) => ({ step: idx + 1, text: i.text.trim() })),
      tags,
      prepTime: prepTime ? parseInt(prepTime, 10) : null,
      cookTime: cookTime ? parseInt(cookTime, 10) : null,
      servings: servings ? parseInt(servings, 10) : null,
      isPublic,
      notes: notes.trim() || null,
      images: includeAi && aiImageUrl
        ? [{ url: aiImageUrl, role: "both" as const }]
        : originalImages,
    };
  };

  const doSaveAsNew = async (useAiImage?: boolean) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        ...buildBody(useAiImage),
        isAdapted: true,
        forkedFromRecipeId: id,
        sourceUrl: originalSourceUrl || null,
        sourceName: originalSourceName || originalAuthorName || null,
      };
      const res = await fetch(`${API_URL}/api/recipes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const newRecipe = await res.json();
      router.replace(`/recipes/${newRecipe.id}`);
    } catch {
      setErrors({ _form: "Failed to save recipe. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const doApplyToOriginal = async (useAiImage?: boolean) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = { ...buildBody(useAiImage), isAdapted: true };
      const res = await fetch(`${API_URL}/api/recipes/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      router.replace(`/recipes/${id}`);
    } catch {
      setErrors({ _form: "Failed to update recipe. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (which: "new" | "apply") => {
    if (hasUnresolvedImage) {
      setPendingSave(which);
      setShowImagePrompt(true);
      return;
    }
    if (which === "new") doSaveAsNew(); else doApplyToOriginal();
  };

  const resolveImagePrompt = (useImage: boolean) => {
    setShowImagePrompt(false);
    if (useImage) setAiImageAccepted(true);
    else { setAiImageUrl(null); setAiImageAccepted(false); }
    const which = pendingSave;
    setPendingSave(null);
    if (which === "new") doSaveAsNew(useImage); else doApplyToOriginal(useImage);
  };

  const saveButtons = (
    <View style={styles.saveSection}>
      {showImagePrompt && (
        <View style={styles.imagePromptBanner}>
          <Text style={styles.imagePromptText}>Use the AI-generated image?</Text>
          <View style={styles.imagePromptActions}>
            <TouchableOpacity style={styles.imagePromptYes} onPress={() => resolveImagePrompt(true)}>
              <Text style={styles.imagePromptYesText}>Use image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imagePromptNo} onPress={() => resolveImagePrompt(false)}>
              <Text style={styles.imagePromptNoText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={() => handleSave("new")}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save as new recipe</Text>
        )}
      </TouchableOpacity>

      {isOwner ? (
        <TouchableOpacity
          style={[styles.applyButton, saving && styles.saveButtonDisabled]}
          onPress={() => handleSave("apply")}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#1c1917" />
          ) : (
            <Text style={styles.applyButtonText}>Apply to this recipe</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1c1917" />
      </View>
    );
  }

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <NavShell>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#1c1917" />
            </TouchableOpacity>
            <Text style={styles.heading}>AI Modified Recipe</Text>
            <TouchableOpacity onPress={() => router.navigate("/profile")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {user?.image ? (
                <Image source={{ uri: user.image }} style={styles.headerAvatar} contentFit="cover" />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  {initials ? (
                    <Text style={styles.headerAvatarInitials}>{initials}</Text>
                  ) : (
                    <Ionicons name="person-outline" size={16} color="#78716c" />
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>

          {saveButtons}

          {errors._form ? (
            <View style={styles.formError}>
              <Text style={styles.formErrorText}>{errors._form}</Text>
            </View>
          ) : null}

          {/* AI Image */}
          <View style={styles.field}>
            <Text style={styles.label}>AI Image</Text>

            {aiImageUrl && !aiImageAccepted ? (
              <View style={styles.aiImagePreviewContainer}>
                <Image source={{ uri: aiImageUrl }} style={styles.aiImagePreview} contentFit="cover" transition={300} />
                <View style={styles.aiImageActions}>
                  <TouchableOpacity
                    style={styles.aiImageAccept}
                    onPress={() => setAiImageAccepted(true)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.aiImageAcceptText}>Use this image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.aiImageDiscard}
                    onPress={() => { setAiImageUrl(null); setAiImageAccepted(false); }}
                  >
                    <Ionicons name="close" size={16} color="#57534e" />
                    <Text style={styles.aiImageDiscardText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : aiImageAccepted && aiImageUrl ? (
              <View style={styles.aiImagePreviewContainer}>
                <Image source={{ uri: aiImageUrl }} style={styles.aiImagePreview} contentFit="cover" transition={300} />
                <View style={styles.aiImageAcceptedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#166534" />
                  <Text style={styles.aiImageAcceptedText}>Image will be added to recipe</Text>
                </View>
                <TouchableOpacity
                  style={styles.aiImageDiscard}
                  onPress={() => { setAiImageUrl(null); setAiImageAccepted(false); }}
                >
                  <Ionicons name="close" size={14} color="#57534e" />
                  <Text style={styles.aiImageDiscardText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : aiImageLoading ? (
              <View style={styles.aiImageLoadingBox}>
                <ActivityIndicator size="small" color="#78716c" />
                <Text style={styles.aiImageLoadingText}>Generating image...</Text>
              </View>
            ) : (
              <View style={styles.aiImageButtons}>
                <TouchableOpacity
                  style={styles.aiImageButton}
                  onPress={() => generateImage("generate")}
                >
                  <Ionicons name="image-outline" size={18} color="#57534e" />
                  <Text style={styles.aiImageButtonText}>Generate new image</Text>
                </TouchableOpacity>
                {originalImages.length > 0 ? (
                  <TouchableOpacity
                    style={styles.aiImageButton}
                    onPress={() => generateImage("edit")}
                  >
                    <Ionicons name="brush-outline" size={18} color="#57534e" />
                    <Text style={styles.aiImageButtonText}>Modify original image</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {aiImageError ? (
              <Text style={styles.aiImageErrorText}>{aiImageError}</Text>
            ) : null}
          </View>

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
                <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} placeholder="0" placeholderTextColor="#a8a29e" keyboardType="number-pad" />
              </View>
              <View style={styles.row3Item}>
                <Text style={styles.subLabel}>Cook (min)</Text>
                <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} placeholder="0" placeholderTextColor="#a8a29e" keyboardType="number-pad" />
              </View>
              <View style={styles.row3Item}>
                <Text style={styles.subLabel}>Servings</Text>
                <TextInput style={styles.input} value={servings} onChangeText={setServings} placeholder="0" placeholderTextColor="#a8a29e" keyboardType="number-pad" />
              </View>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.field}>
            <Text style={styles.label}>Ingredients</Text>
            {ingredients.map((ing, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.listItemBullet}><Text style={styles.listItemBulletText}>·</Text></View>
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
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{i + 1}</Text></View>
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
                  <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => setTags((p) => p.filter((t) => t !== tag))}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <Ionicons name="close" size={12} color="#57534e" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Personal notes"
              placeholderTextColor="#a8a29e"
              multiline
              maxLength={5000}
              textAlignVertical="top"
            />
          </View>

          {/* Privacy */}
          <View style={styles.field}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name={isPublic ? "globe-outline" : "lock-closed-outline"} size={20} color="#57534e" />
                <View>
                  <Text style={styles.toggleLabel}>{isPublic ? "Public" : "Private"}</Text>
                  <Text style={styles.toggleSub}>{isPublic ? "Anyone can view this recipe" : "Only you can see this recipe"}</Text>
                </View>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ false: "#e7e5e4", true: "#1c1917" }} thumbColor="#fff" />
            </View>
          </View>

          {/* Save buttons (bottom) */}
          {saveButtons}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </NavShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  content: { paddingBottom: 48 },
  centered: { flex: 1, backgroundColor: "#fafaf9", justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16, backgroundColor: "#fafaf9",
    borderBottomWidth: 1, borderBottomColor: "#e7e5e4", marginBottom: 8,
  },
  heading: { fontSize: 17, fontWeight: "700", color: "#1c1917" },
  headerAvatar: { width: 30, height: 30, borderRadius: 15 },
  headerAvatarFallback: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#e7e5e4", justifyContent: "center", alignItems: "center",
  },
  headerAvatarInitials: { fontSize: 11, fontWeight: "600", color: "#57534e" },
  formError: { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fef2f2", borderRadius: 8, padding: 12 },
  formErrorText: { fontSize: 13, color: "#b91c1c" },
  field: { paddingHorizontal: 16, marginTop: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#1c1917", marginBottom: 8 },
  subLabel: { fontSize: 12, color: "#78716c", marginBottom: 4 },
  required: { color: "#b91c1c" },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e5e4",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: "#1c1917",
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
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#1c1917",
    justifyContent: "center", alignItems: "center", marginTop: 10, flexShrink: 0,
  },
  stepBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  listItemInput: { flex: 1 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  addButtonText: { fontSize: 14, color: "#57534e" },
  tagInputRow: { flexDirection: "row", gap: 8 },
  tagAddBtn: { backgroundColor: "#1c1917", borderRadius: 8, paddingHorizontal: 14, justifyContent: "center" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tagChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f5f5f4", borderRadius: 20, borderWidth: 1, borderColor: "#e7e5e4",
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagChipText: { fontSize: 13, color: "#57534e", fontWeight: "500" },
  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e7e5e4", padding: 14,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: "500", color: "#1c1917" },
  toggleSub: { fontSize: 12, color: "#78716c", marginTop: 1 },
  saveSection: { paddingHorizontal: 16, marginTop: 24, gap: 10 },
  saveButton: {
    backgroundColor: "#1c1917", borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  applyButton: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e7e5e4",
    paddingVertical: 14, alignItems: "center",
  },
  applyButtonText: { fontSize: 16, fontWeight: "600", color: "#1c1917" },
  aiImagePreviewContainer: { borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e5e4" },
  aiImagePreview: { width: "100%", height: 200, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  aiImageActions: { flexDirection: "row", gap: 10, padding: 10 },
  aiImageAccept: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#166534", borderRadius: 8, paddingVertical: 10,
  },
  aiImageAcceptText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  aiImageDiscard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  aiImageDiscardText: { fontSize: 13, color: "#57534e" },
  aiImageAcceptedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 10, backgroundColor: "#f0fdf4",
  },
  aiImageAcceptedText: { fontSize: 13, color: "#166534", fontWeight: "500" },
  aiImageLoadingBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e5e4",
    borderRadius: 10, paddingVertical: 24,
  },
  aiImageLoadingText: { fontSize: 14, color: "#78716c" },
  aiImageButtons: { flexDirection: "row", gap: 10 },
  aiImageButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e5e4",
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 10,
  },
  aiImageButtonText: { fontSize: 13, fontWeight: "500", color: "#57534e" },
  aiImageErrorText: { fontSize: 12, color: "#b91c1c", marginTop: 6 },
  imagePromptBanner: {
    backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
    borderRadius: 10, padding: 12, gap: 10,
  },
  imagePromptText: { fontSize: 14, fontWeight: "600", color: "#92400e" },
  imagePromptActions: { flexDirection: "row", gap: 10 },
  imagePromptYes: {
    flex: 1, backgroundColor: "#166534", borderRadius: 8,
    paddingVertical: 9, alignItems: "center",
  },
  imagePromptYesText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  imagePromptNo: {
    flex: 1, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e7e5e4",
    paddingVertical: 9, alignItems: "center",
  },
  imagePromptNoText: { fontSize: 14, fontWeight: "500", color: "#57534e" },
});
