import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";

export default function JoinScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (authLoading) return;

    if (!token) {
      // Not authenticated — redirect to register with ref
      router.replace(`/register?ref=${id}`);
      return;
    }

    // Authenticated — auto-follow the inviter
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/follows`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ followingId: id }),
        });
        if (res.ok || res.status === 400) {
          // 400 could be "already following" or "cannot follow yourself" — both fine
          setStatus("done");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    })();
  }, [token, authLoading, id, router]);

  if (authLoading || status === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1c1917" />
        <Text style={styles.loadingText}>Setting up your follow...</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={48} color="#b91c1c" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.buttonText}>Go home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle-outline" size={48} color="#16a34a" />
      <Text style={styles.doneTitle}>You're now following them!</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace(`/u/${id}`)}
        >
          <Text style={styles.buttonText}>View profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => router.replace("/")}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Go home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafaf9",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 32,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
  },
  loadingText: { fontSize: 15, color: "#78716c" },
  errorTitle: { fontSize: 18, fontWeight: "600", color: "#1c1917" },
  doneTitle: { fontSize: 18, fontWeight: "600", color: "#1c1917" },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  button: {
    backgroundColor: "#1c1917",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
  },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  buttonTextSecondary: { color: "#1c1917" },
});
