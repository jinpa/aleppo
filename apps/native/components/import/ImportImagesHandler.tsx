import { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";
import { PhotoPicker } from "@/components/PhotoPicker";
import { sharedStyles } from "./importStyles";

export type ImportImagesResult = {
  recipe: ScrapedRecipe;
  aiGenerated: boolean;
};

type ImportImagesHandlerProps = {
  token: string | null;
  onComplete: (result: ImportImagesResult) => void;
};

export function ImportImagesHandler({ token, onComplete }: ImportImagesHandlerProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleImagesImport = async () => {
    if (photos.length === 0) return;
    setImporting(true);
    try {
      const body = new FormData();
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
      <Text style={sharedStyles.heading}>Import from photos</Text>
      <Text style={sharedStyles.subheading}>
        Add photos of a recipe (handwritten, printed, or a screenshot) or a photo of a dish — we'll extract or generate a recipe for you.
      </Text>
      <PhotoPicker mode="multiple" onPhotos={setPhotos}>
        {(open, pickedPhotos, removePhoto) => (
          <View style={styles.photoRow}>
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
      {photos.length > 0 && (
        <TouchableOpacity
          style={[sharedStyles.importButton, importing && sharedStyles.fetchButtonDisabled]}
          onPress={handleImagesImport}
          disabled={importing}
        >
          {importing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={sharedStyles.fetchButtonText}>Import</Text>
          }
        </TouchableOpacity>
      )}
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
