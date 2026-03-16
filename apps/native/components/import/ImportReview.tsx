import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Switch,
  Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import type { Ingredient, InstructionStep, ScrapedRecipe } from "@aleppo/shared";

type RawIngredient = Pick<Ingredient, "raw">;

type ImportReviewProps = {
  recipe: ScrapedRecipe;
  sourceUrl: string;
  parseError?: string | null;
  aiGenerated?: boolean;
  token: string | null;
  onBack: () => void;
  router: { replace: (href: any) => void };
};

export function ImportReview({ recipe, sourceUrl, parseError, aiGenerated, token, onBack, router }: ImportReviewProps) {
  const [title, setTitle] = useState(recipe.title ?? "");
  const [description, setDescription] = useState(recipe.description ?? "");
  const [ingredients, setIngredients] = useState<RawIngredient[]>(
    recipe.ingredients?.length ? recipe.ingredients : [{ raw: "" }]
  );
  const [instructions, setInstructions] = useState<InstructionStep[]>(
    recipe.instructions?.length
      ? recipe.instructions.map((ins, i) => ({ step: i + 1, text: ins.text }))
      : [{ step: 1, text: "" }]
  );
  const [tags, setTags] = useState<string[]>(recipe.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [prepTime, setPrepTime] = useState(recipe.prepTime ? String(recipe.prepTime) : "");
  const [cookTime, setCookTime] = useState(recipe.cookTime ? String(recipe.cookTime) : "");
  const [servings, setServings] = useState(recipe.servings ? String(recipe.servings) : "");
  const [isPublic, setIsPublic] = useState(false);
  const [imageUrl] = useState<string | undefined>(recipe.imageUrl ?? undefined);
  const [recipeSourceUrl, setRecipeSourceUrl] = useState(recipe.sourceUrl ?? sourceUrl);
  const [sourceName, setSourceName] = useState(recipe.sourceName ?? "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        imageUrl: imageUrl || undefined,
        sourceUrl: recipeSourceUrl.trim() || undefined,
        sourceName: sourceName.trim() || undefined,
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
      const saved = await res.json();
      router.replace(`/recipes/${saved.id}`);
    } catch {
      setErrors({ _form: "Failed to save recipe. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          <Text style={styles.bannerWarnText}>Partial import — {parseError}</Text>
        </View>
      ) : (
        <View style={styles.bannerOk}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#166534" style={{ marginTop: 1 }} />
          <Text style={styles.bannerOkText}>
            {aiGenerated
              ? "Recipe generated by AI — review carefully before saving."
              : "Recipe parsed successfully. Review before saving."}
          </Text>
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
          value={recipeSourceUrl}
          onChangeText={setRecipeSourceUrl}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
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
  imagePreview: { width: "100%", height: 200, marginBottom: 16 },
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
});
