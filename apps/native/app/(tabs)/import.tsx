import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe, UserSettings } from "@aleppo/shared";
import { UserAvatar } from "@/components/UserAvatar";
import { ImportUrlHandler } from "@/components/import/ImportUrlHandler";
import { ImportImagesHandler } from "@/components/import/ImportImagesHandler";
import { ImportTextHandler } from "@/components/import/ImportTextHandler";
import { ImportFileMode } from "@/components/import/ImportFileMode";
import { ImportReview } from "@/components/import/ImportReview";
import { getClientLanguage } from "@/components/import/TranslationToggle";
import type { ImportOutcome } from "@/components/import/types";

type Mode = "url" | "images" | "text" | "file";

type ReviewData = {
  recipe: ScrapedRecipe;
  parseError?: string;
  aiGenerated?: boolean;
  commentsUrl?: string;
};

const segments: { key: Mode; label: string; icon: string }[] = [
  { key: "url",    label: "URL",    icon: "link-outline" },
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
          onAttempt={() => setError(null)}
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
        <ImportFileMode token={token} router={router} />
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
