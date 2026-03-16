import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { API_URL } from "@/constants/api";
import { sharedStyles } from "./importStyles";
import type { ImportOutcome } from "./types";

type ImportTextHandlerProps = {
  token: string | null;
  onComplete: (outcome: ImportOutcome) => void;
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
      if (!res.ok || data.error) {
        onComplete({ ok: false, error: data.error ?? "Import failed." });
        return;
      }
      onComplete({ ok: true, recipe: data.recipe ?? {}, aiGenerated: data.generated === true });
    } catch {
      onComplete({ ok: false, error: "Could not connect to server." });
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
