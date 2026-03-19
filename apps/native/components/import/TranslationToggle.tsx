import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Localization from "expo-localization";
import { API_URL } from "@/constants/api";

type TranslationToggleProps = {
  language: string | undefined;
  onLanguageChange: (language: string | undefined) => void;
  token: string | null;
};

/**
 * Gets the English name of a language code using the Intl.DisplayNames API.
 * e.g. "fr" -> "French"
 */
function getLanguageNameFromCode(code: string): string {
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    return displayNames.of(code) || "my language";
  } catch (err) {
    console.error("Failed to get language name for code:", code, err);
    return "my language";
  }
}

export function TranslationToggle({ language, onLanguageChange, token }: TranslationToggleProps) {
  const userLanguage = useMemo(() => {
    return getClientLanguage();
  }, []);

  const enabled = !!language;

  const handleToggle = async () => {
    const nextEnabled = !enabled;
    const nextLanguage = nextEnabled ? userLanguage : undefined;
    onLanguageChange(nextLanguage);

    // Persist to settings
    if (token) {
      try {
        await fetch(`${API_URL}/api/users/me`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ translateAI: nextEnabled }),
        });
      } catch (err) {
        console.error("Failed to save translateAI setting:", err);
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, enabled && styles.checkboxActive]}>
        {enabled && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.label}>Translate to {userLanguage}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d6d3d1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#d97706",
    borderColor: "#d97706",
  },
  label: {
    fontSize: 14,
    color: "#44403c",
    fontWeight: "500",
  },
});

export function getClientLanguage() {
  const code = Localization.getLocales()[0]?.languageCode || "en";
  return getLanguageNameFromCode(code);
}
