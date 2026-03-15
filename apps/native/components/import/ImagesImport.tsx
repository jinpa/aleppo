import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PhotoPicker } from "@/components/PhotoPicker";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";

interface ImagesImportProps {
  token: string | null;
  onImportSuccess: (recipe: ScrapedRecipe, fetchedUrl?: string, error?: string | null) => void;
}

export function ImagesImport({ token, onImportSuccess }: ImagesImportProps) {
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
      onImportSuccess(data.recipe ?? {}, "");
    } catch {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.imagesMode}>
      <Text style={styles.heading}>Import from photos</Text>
      <Text style={styles.subheading}>
        Add photos of a recipe — handwritten, printed, or a screenshot — and we'll extract it for you.
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
          style={[styles.importButton, importing && styles.fetchButtonDisabled]}
          onPress={handleImagesImport}
          disabled={importing}
        >
          {importing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.fetchButtonText}>Import</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  imagesMode: { gap: 16 },
  heading: { fontSize: 24, fontWeight: "700", color: "#1c1917" },
  subheading: { fontSize: 14, color: "#78716c", lineHeight: 20 },
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
  importButton: {
    backgroundColor: "#1c1917",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  fetchButtonDisabled: { opacity: 0.5 },
  fetchButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
