import { useEffect } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth";

export default function Index() {
  const { token, isLoading } = useAuth();
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fafaf9",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1c1917",
  },
});
