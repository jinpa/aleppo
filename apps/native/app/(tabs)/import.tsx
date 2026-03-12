import { useState } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PhotoPicker } from "@/components/PhotoPicker";

export default function AddScreen() {
  const [pickedFiles, setPickedFiles] = useState<string[]>([]);

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

        <PhotoPicker mode="multiple" onPhotos={setPickedFiles}>
          {(open) => (
            <TouchableOpacity style={styles.button} onPress={open}>
              <Ionicons name="images-outline" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Pick photos</Text>
            </TouchableOpacity>
          )}
        </PhotoPicker>

        {pickedFiles.length > 0 && (
          <View style={styles.resultBox}>
            {pickedFiles.map((uri, i) => (
              <Text key={i} style={styles.resultLine} numberOfLines={1}>
                {uri.split("/").pop()}
              </Text>
            ))}
          </View>
        )}
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
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1917",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  buttonIcon: {
    marginRight: 2,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  resultBox: {
    marginTop: 16,
    backgroundColor: "#f5f5f4",
    borderRadius: 8,
    padding: 12,
    width: "100%",
    gap: 4,
  },
  resultLine: {
    fontSize: 13,
    color: "#57534e",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
