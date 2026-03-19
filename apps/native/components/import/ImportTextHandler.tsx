import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { API_URL } from "@/constants/api";
import { sharedStyles } from "./importStyles";
import { CookingSpinner } from "@/components/CookingSpinner";
import { TranslationToggle, getClientLanguage } from "./TranslationToggle";
import type { ImportOutcome } from "./types";

type ImportTextHandlerProps = {
  token: string | null;
  onComplete: (outcome: ImportOutcome) => void;
  onAttempt?: () => void;
  initialLanguage?: string;
};

export function ImportTextHandler({ token, onComplete, onAttempt, initialLanguage }: ImportTextHandlerProps) {
  const [textInput, setTextInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [language, setLanguage] = useState<string | undefined>(initialLanguage);

  useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  const handleTextImport = async () => {
    if (!textInput.trim()) return;
    onAttempt?.();
    setImporting(true);
    try {
      const body = new FormData();
      body.append("text", textInput.trim());
      if (language) {
        body.append("language", language);
      }
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

  if (importing) {
    return <CookingSpinner label="Extracting recipe…" sublabel="Reading your text with AI, this takes a few seconds." />;
  }

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

      <TranslationToggle language={language} onLanguageChange={setLanguage} token={token} />

      <TouchableOpacity
        style={[sharedStyles.importButton, !textInput.trim() && sharedStyles.fetchButtonDisabled]}
        onPress={handleTextImport}
        disabled={!textInput.trim()}
      >
        <Text style={sharedStyles.fetchButtonText}>Import</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  textInput: { height: 200, paddingTop: 10 },
});
