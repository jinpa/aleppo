import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function NewRecipeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Ionicons name="add-circle-outline" size={40} color="#d97706" />
        <Text style={styles.title}>New Recipe</Text>
        <Text style={styles.subtitle}>
          Manually create a recipe from scratch.
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
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1c1917",
    marginTop: 4,
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
