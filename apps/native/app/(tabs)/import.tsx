import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AddScreen() {
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
  },
});
