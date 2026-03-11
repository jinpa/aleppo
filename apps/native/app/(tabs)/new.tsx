import { useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";

type Ingredient = { raw: string };
type Instruction = { step: number; text: string };

export default function NewRecipeScreen() {
  const router = useRouter();
  const { token } = useAuth();

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
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (title.length > 300) e.title = "Max 300 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { raw: "" }]);
  };

  const updateIngredient = (index: number, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => i === index ? { raw: value } : ing));
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length === 1) {
      setIngredients([{ raw: "" }]);
    } else {
      setIngredients((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const addInstruction = () => {
    setInstructions((prev) => [...prev, { step: prev.length + 1, text: "" }]);
  };

  const updateInstruction = (index: number, value: string) => {
    setInstructions((prev) => prev.map((ins, i) => i === index ? { ...ins, text: value } : ins));
  };

  const removeInstruction = (index: number) => {
    if (instructions.length === 1) {
      setInstructions([{ step: 1, text: "" }]);
    } else {
      const updated = instructions
        .filter((_, i) => i !== index)
        .map((ins, i) => ({ ...ins, step: i + 1 }));
      setInstructions(updated);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
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
        notes: notes.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
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
      const recipe = await res.json();
      router.replace(`/recipes/${recipe.id}`);
    } catch {
      setErrors({ _form: "Failed to save recipe. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
          <Text style={styles.heading}>New Recipe</Text>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
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
              <TextInput
                style={styles.input}
                value={prepTime}
                onChangeText={setPrepTime}
                placeholder="0"
                placeholderTextColor="#a8a29e"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.row3Item}>
              <Text style={styles.subLabel}>Cook (min)</Text>
              <TextInput
                style={styles.input}
                value={cookTime}
                onChangeText={setCookTime}
                placeholder="0"
                placeholderTextColor="#a8a29e"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.row3Item}>
              <Text style={styles.subLabel}>Servings</Text>
              <TextInput
                style={styles.input}
                value={servings}
                onChangeText={setServings}
                placeholder="0"
                placeholderTextColor="#a8a29e"
                keyboardType="number-pad"
              />
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
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => removeTag(tag)}
                >
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
            placeholder="Source URL (optional)"
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

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Personal notes about this recipe"
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
              <Ionicons
                name={isPublic ? "globe-outline" : "lock-closed-outline"}
                size={20}
                color="#57534e"
              />
              <View>
                <Text style={styles.toggleLabel}>
                  {isPublic ? "Public" : "Private"}
                </Text>
                <Text style={styles.toggleSub}>
                  {isPublic
                    ? "Anyone can view this recipe"
                    : "Only you can see this recipe"}
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

        {/* Bottom save button */}
        <View style={styles.bottomSaveRow}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save recipe</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  heading: { fontSize: 17, fontWeight: "700", color: "#1c1917" },
  saveButton: {
    backgroundColor: "#1c1917",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 56,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  formError: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 12,
  },
  formErrorText: { fontSize: 13, color: "#b91c1c" },

  // Fields
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

  // List items (ingredients / instructions)
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

  addButton: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  addButtonText: { fontSize: 14, color: "#57534e" },

  // Tags
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

  // Toggle
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#e7e5e4",
    padding: 14,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: "500", color: "#1c1917" },
  toggleSub: { fontSize: 12, color: "#78716c", marginTop: 1 },
  bottomSaveRow: { paddingHorizontal: 16, marginTop: 24 },
});
