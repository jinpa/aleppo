import { useEffect } from "react";
import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth";

export default function Index() {
  const { token, isLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [token, isLoading, router]);

  if (isLoading || !token) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aleppo</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafaf9",
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1c1917",
  },
  button: {
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 15,
    color: "#78716c",
  },
});
