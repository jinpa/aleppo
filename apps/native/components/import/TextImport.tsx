import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";

interface TextImportProps {
  token: string | null;
  onImportSuccess: (recipe: ScrapedRecipe, fetchedUrl?: string, error?: string | null) => void;
}

export function TextImport({ token, onImportSuccess }: TextImportProps) {
  const [textInput, setTextInput] = useState("");
  const [importing, setImporting] = useState(false);

  const handleTextImport = async () => {
    if (!textInput.trim()) return;
    setImporting(true);
    try {
      const body = new FormData();
      body.append("text", textInput.trim());
      const res = await fetch(`${API_URL}/api/import/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Import failed");
        return;
      }
      onImportSuccess(data.recipe ?? {}, "");
    } catch {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.textMode}>
      <Text style={styles.heading}>Import from text</Text>
      <Text style={styles.subheading}>
        Paste the recipe text below and we'll extract it for you.
      </Text>
      <TextInput
        style={[styles.input, styles.textModeInput]}
        value={textInput}
        onChangeText={setTextInput}
        placeholder="Paste recipe text here…"
        placeholderTextColor="#a8a29e"
        multiline
        textAlignVertical="top"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[styles.importButton, (!textInput.trim() || importing) && styles.fetchButtonDisabled]}
        onPress={handleTextImport}
        disabled={!textInput.trim() || importing}
      >
        {importing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.fetchButtonText}>Import</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  textMode: { gap: 16 },
  heading: { fontSize: 24, fontWeight: "700", color: "#1c1917" },
  subheading: { fontSize: 14, color: "#78716c", lineHeight: 20 },
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
  textModeInput: { height: 200, paddingTop: 10 },
  importButton: {
    backgroundColor: "#1c1917",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  fetchButtonDisabled: { opacity: 0.5 },
  fetchButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
