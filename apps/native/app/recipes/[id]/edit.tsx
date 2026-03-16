import { useState, useEffect, useCallback } from "react";
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
import { PhotoPicker } from "@/components/PhotoPicker";
import type { Ingredient, InstructionStep, Recipe } from "@aleppo/shared";

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { name: "Recipes", icon: "book-outline" as const, route: "/(tabs)/recipes", amber: false },
  { name: "Queue", icon: "time-outline" as const, route: "/(tabs)/queue", amber: false },
  { name: "Feed", icon: "people-outline" as const, route: "/(tabs)/feed", amber: false },
  { name: "New", icon: "add-circle-outline" as const, route: "/(tabs)/new", amber: true },
  { name: "Import", icon: "arrow-down-circle-outline" as const, route: "/(tabs)/import", amber: false },
] as const;

function TabBar() {
  const router = useRouter();
  return (
    <View style={tabStyles.bar}>
      {TAB_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.name}
          style={tabStyles.tab}
          onPress={() => router.navigate(item.route)}
          activeOpacity={0.7}
        >
          <Ionicons name={item.icon} size={24} color={item.amber ? "#d97706" : "#a8a29e"} />
          <Text style={[tabStyles.label, item.amber && tabStyles.labelAmber]}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: 11, fontWeight: "500", color: "#a8a29e" },
  labelAmber: { color: "#d97706" },
});

type RawIngredient = Pick<Ingredient, "raw">;

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();

  const [loadingRecipe, setLoadingRecipe] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<RawIngredient[]>([{ raw: "" }]);
  const [instructions, setInstructions] = useState<InstructionStep[]>([{ step: 1, text: "" }]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const [hasSourceAttribution, setHasSourceAttribution] = useState(false);
  const [originalContent, setOriginalContent] = useState("");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadRecipe = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/recipes/${id}/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const r: Recipe = data.recipe;
      setTitle(r.title);
      setDescription(r.description ?? "");
      setIngredients(r.ingredients.length > 0 ? r.ingredients.map((i) => ({ raw: i.raw })) : [{ raw: "" }]);
      setInstructions(r.instructions.length > 0 ? r.instructions : [{ step: 1, text: "" }]);
      setTags(r.tags);
      setPrepTime(r.prepTime ? String(r.prepTime) : "");
      setCookTime(r.cookTime ? String(r.cookTime) : "");
      setServings(r.servings ? String(r.servings) : "");
      setIsPublic(r.isPublic);
      setImageUrl(r.imageUrl ?? null);
      setNotes(r.notes ?? "");
      setSourceUrl(r.sourceUrl ?? "");
      setSourceName(r.sourceName ?? "");
      setHasSourceAttribution(!!(r.forkedFromRecipeId || r.sourceUrl || r.sourceName));
      setOriginalContent(JSON.stringify({
        title: r.title,
        description: r.description ?? "",
        ingredients: r.ingredients.length > 0 ? r.ingredients.map((i: Ingredient) => i.raw) : [],
        instructions: r.instructions.length > 0 ? r.instructions.map((i: Instruction) => i.text) : [],
      }));
    } catch {
      setErrors({ _load: "Could not load recipe for editing." });
    } finally {
      setLoadingRecipe(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (title.length > 300) e.title = "Max 300 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addIngredient = () => setIngredients((p) => [...p, { raw: "" }]);
  const updateIngredient = (i: number, v: string) =>
    setIngredients((p) => p.map((ing, idx) => idx === i ? { raw: v } : ing));
  const removeIngredient = (i: number) => {
    if (ingredients.length === 1) { setIngredients([{ raw: "" }]); return; }
    setIngredients((p) => p.filter((_, idx) => idx !== i));
  };

  const addInstruction = () =>
    setInstructions((p) => [...p, { step: p.length + 1, text: "" }]);
  const updateInstruction = (i: number, v: string) =>
    setInstructions((p) => p.map((ins, idx) => idx === i ? { ...ins, text: v } : ins));
  const removeInstruction = (i: number) => {
    if (instructions.length === 1) { setInstructions([{ step: 1, text: "" }]); return; }
    setInstructions((p) => p.filter((_, idx) => idx !== i).map((ins, idx) => ({ ...ins, step: idx + 1 })));
  };

  const uploadImage = async (uris: string[]) => {
    const uri = uris[0];
    if (!uri) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        formData.append("file", blob, "photo.jpg");
      } else {
        formData.append("file", {
          uri,
          name: "photo.jpg",
          type: "image/jpeg",
        } as unknown as Blob);
      }
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.url);
    } catch {
      setErrors((prev) => ({ ...prev, _form: "Failed to upload image. Please try again." }));
    } finally {
      setImageUploading(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput("");
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        imageUrl: imageUrl || null,
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
        sourceUrl: sourceUrl.trim() || null,
        sourceName: sourceName.trim() || null,
      };
      // Only mark as adapted when recipe content (not just metadata) changes
      if (hasSourceAttribution) {
        const currentContent = JSON.stringify({
          title: title.trim(),
          description: description.trim() || "",
          ingredients: ingredients.filter((i) => i.raw.trim()).map((i) => i.raw.trim()),
          instructions: instructions.filter((i) => i.text.trim()).map((i) => i.text.trim()),
        });
        if (currentContent !== originalContent) {
          body.isAdapted = true;
        }
      }

      const res = await fetch(`${API_URL}/api/recipes/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      // Replace with fresh detail screen so updated data loads immediately
      router.replace(`/recipes/${id}`);
    } catch {
      setErrors({ _form: "Failed to save recipe. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loadingRecipe) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1c1917" />
      </View>
    );
  }

  if (errors._load) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errors._load}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={{ flex: 1 }}>
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
          <Text style={styles.heading}>Edit Recipe</Text>
          <View style={styles.headerRight}>
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
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {errors._form ? (
          <View style={styles.formError}>
            <Text style={styles.formErrorText}>{errors._form}</Text>
          </View>
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

        {/* Photo */}
        <View style={styles.field}>
          <Text style={styles.label}>Photo</Text>
          <PhotoPicker mode="single" onPhotos={uploadImage}>
            {(open, _photos, _remove, isDragging) => imageUrl ? (
              <View style={[styles.imagePreviewContainer, isDragging && styles.imageDragging]}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" transition={200} />
                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.imageActionButton} onPress={open} disabled={imageUploading}>
                    <Ionicons name="camera-outline" size={16} color="#57534e" />
                    <Text style={styles.imageActionText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.imageActionButton} onPress={() => setImageUrl(null)} disabled={imageUploading}>
                    <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                    <Text style={[styles.imageActionText, { color: "#b91c1c" }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
                {imageUploading ? (
                  <View style={styles.imageUploadOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.imagePickerEmpty, isDragging && styles.imageDragging]}
                onPress={open}
                disabled={imageUploading}
              >
                {imageUploading ? (
                  <ActivityIndicator size="small" color="#78716c" />
                ) : (
                  <>
                    <Ionicons name={isDragging ? "image-outline" : "camera-outline"} size={28} color={isDragging ? "#d97706" : "#a8a29e"} />
                    <Text style={[styles.imagePickerEmptyText, isDragging && { color: "#92400e" }]}>
                      {isDragging ? "Drop image here" : "Add a photo"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </PhotoPicker>
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

        {/* Source */}
        <View style={styles.field}>
          <Text style={styles.label}>Source</Text>
          <TextInput style={[styles.input, { marginBottom: 8 }]} value={sourceUrl} onChangeText={setSourceUrl} placeholder="Source URL (optional)" placeholderTextColor="#a8a29e" autoCapitalize="none" keyboardType="url" />
          <TextInput style={styles.input} value={sourceName} onChangeText={setSourceName} placeholder="Source name (optional)" placeholderTextColor="#a8a29e" />
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

        {/* Bottom save button */}
        <View style={styles.bottomSaveRow}>
          <TouchableOpacity
            style={[styles.bottomSaveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.bottomSaveButtonText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
      <TabBar />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  content: { paddingBottom: 48 },
  centered: { flex: 1, backgroundColor: "#fafaf9", justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: "#b91c1c", textAlign: "center" },
  retryButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#d6d3d1" },
  retryText: { fontSize: 14, color: "#57534e" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 16, backgroundColor: "#fafaf9",
    borderBottomWidth: 1, borderBottomColor: "#e7e5e4", marginBottom: 8,
  },
  heading: { fontSize: 17, fontWeight: "700", color: "#1c1917" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 30, height: 30, borderRadius: 15 },
  headerAvatarFallback: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#e7e5e4", justifyContent: "center", alignItems: "center",
  },
  headerAvatarInitials: { fontSize: 11, fontWeight: "600", color: "#57534e" },
  saveButton: {
    backgroundColor: "#1c1917", borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 56, alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
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
  bottomSaveRow: { paddingHorizontal: 16, marginTop: 24 },
  bottomSaveButton: {
    backgroundColor: "#1c1917", borderRadius: 10,
    paddingVertical: 14, alignItems: "center",
  },
  bottomSaveButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  imagePreviewContainer: { position: "relative", borderRadius: 10, overflow: "hidden" },
  imagePreview: { width: "100%", height: 200, borderRadius: 10 },
  imageActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  imageActionButton: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff",
  },
  imageActionText: { fontSize: 13, fontWeight: "500", color: "#57534e" },
  imageUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  imagePickerEmpty: {
    borderWidth: 1, borderColor: "#e7e5e4", borderStyle: "dashed",
    borderRadius: 10, paddingVertical: 32, alignItems: "center", gap: 8,
    backgroundColor: "#fff",
  },
  imagePickerEmptyText: { fontSize: 14, color: "#a8a29e" },
  imageDragging: { borderWidth: 2, borderColor: "#d97706", backgroundColor: "#fffbeb" },
});
