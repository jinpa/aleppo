import { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import { PhotoPicker } from "@/components/PhotoPicker";
import { sharedStyles } from "./importStyles";
import { CookingSpinner } from "@/components/CookingSpinner";
import { TranslationToggle, getClientLanguage } from "./TranslationToggle";
import type { ImportOutcome } from "./types";

type ImportImagesHandlerProps = {
  token: string | null;
  onComplete: (outcome: ImportOutcome) => void;
  onAttempt?: () => void;
  initialLanguage?: string;
};

export function ImportImagesHandler({ token, onComplete, onAttempt, initialLanguage }: ImportImagesHandlerProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [language, setLanguage] = useState<string | undefined>(initialLanguage);

  useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  const handleImagesImport = async () => {
    if (photos.length === 0) return;
    onAttempt?.();
    setImporting(true);
    try {
      const body = new FormData();
      if (language) {
        body.append("language", language);
      }
      await Promise.all(
        photos.map(async (uri, i) => {
          const blob = await fetch(uri).then((r) => r.blob());
          body.append("images", blob, `photo${i}.jpg`);
        })
      );
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
    return <CookingSpinner label="Analysing photos…" sublabel="Extracting the recipe with AI, this takes a few seconds." />;
  }

  return (
    <View style={styles.container}>
      <Text style={sharedStyles.heading}>Import from photos</Text>
      <Text style={sharedStyles.subheading}>
        Add photos of a recipe (handwritten, printed, or a screenshot) or a photo of a dish — we'll extract or generate a recipe for you.
      </Text>
      <PhotoPicker mode="multiple" onPhotos={setPhotos}>
        {(open, pickedPhotos, removePhoto, isDragging) => (
          <View style={[styles.photoRow, isDragging && styles.photoRowDragging]}>
            <TouchableOpacity style={styles.cameraButton} onPress={open}>
              <Ionicons name="camera" size={22} color="#78716c" />
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={11} color="#fff" />
              </View>
            </TouchableOpacity>
            {pickedPhotos.map((uri, i) => (
              <View key={uri} style={styles.thumbWrapper}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={18} color="#1c1917" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </PhotoPicker>

      <TranslationToggle language={language} onLanguageChange={setLanguage} token={token} />

      <TouchableOpacity
        style={[sharedStyles.importButton, photos.length === 0 && sharedStyles.fetchButtonDisabled]}
        onPress={handleImagesImport}
        disabled={photos.length === 0}
      >
        <Text style={sharedStyles.fetchButtonText}>Import</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 4,
  },
  photoRowDragging: {
    borderWidth: 2,
    borderColor: "#d97706",
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    padding: 8,
  },
  cameraButton: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#f5f5f4",
    borderWidth: 1.5,
    borderColor: "#d6d3d1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  plusBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#78716c",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbWrapper: { position: "relative" },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#f5f5f4",
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 9,
  },
});
