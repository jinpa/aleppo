import { useState } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PhotoPicker } from "@/components/PhotoPicker";

export default function AddScreen() {
  const [, setPhotos] = useState<string[]>([]);

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.icon}>
          <Ionicons name="arrow-down-circle-outline" size={40} color="#fff" />
        </View>
        <Text style={styles.title}>Import a Recipe</Text>
        <Text style={styles.subtitle}>
          Paste a URL to import a recipe from any site.
        </Text>
        <Text style={styles.coming}>Coming soon</Text>

        <PhotoPicker mode="single" onPhotos={setPhotos}>
          {(open, pickedPhotos, removePhoto) => (
            <View style={styles.photoRow}>
              {/* Camera button — always first */}
              <TouchableOpacity style={styles.cameraButton} onPress={open}>
                <Ionicons name="camera" size={22} color="#78716c" />
                <View style={styles.plusBadge}>
                  <Ionicons name="add" size={11} color="#fff" />
                </View>
              </TouchableOpacity>

              {/* Thumbnails */}
              {pickedPhotos.map((uri, i) => (
                <View key={uri} style={styles.thumbWrapper}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(i)}
                  >
                    <Ionicons name="close-circle" size={18} color="#1c1917" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </PhotoPicker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafaf9",
    paddingTop: Platform.OS === "ios" ? 60 : 24,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1c1917",
  },
  subtitle: {
    fontSize: 14,
    color: "#78716c",
    textAlign: "center",
  },
  coming: {
    fontSize: 12,
    color: "#a8a29e",
    marginTop: 4,
    marginBottom: 12,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
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
  thumbWrapper: {
    position: "relative",
  },
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
