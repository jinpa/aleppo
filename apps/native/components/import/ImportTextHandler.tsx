import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";
import { sharedStyles } from "./importStyles";

export type ImportTextResult = {
  recipe: ScrapedRecipe;
  aiGenerated: boolean;
};

type ImportTextHandlerProps = {
  token: string | null;
  onComplete: (result: ImportTextResult) => void;
};

export function ImportTextHandler({ token, onComplete }: ImportTextHandlerProps) {
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
      onComplete({ recipe: data.recipe ?? {}, aiGenerated: data.generated === true });
    } catch {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={sharedStyles.heading}>Import from text</Text>
      <Text style={sharedStyles.subheading}>
        Paste the recipe text below and we'll extract it for you.
      </Text>
      <TextInput
        style={[sharedStyles.input, styles.textInput]}
        value={textInput}
        onChangeText={setTextInput}
        placeholder="Paste recipe text here…"
        placeholderTextColor="#a8a29e"
        multiline
        textAlignVertical="top"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[sharedStyles.importButton, (!textInput.trim() || importing) && sharedStyles.fetchButtonDisabled]}
        onPress={handleTextImport}
        disabled={!textInput.trim() || importing}
      >
        {importing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={sharedStyles.fetchButtonText}>Import</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  textInput: { height: 200, paddingTop: 10 },
});
