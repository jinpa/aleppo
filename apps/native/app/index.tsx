import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/auth";

export default function Index() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (token) {
      router.replace("/(tabs)/recipes");
    } else {
      router.replace("/login");
    }
  }, [token, isLoading, router]);

  return null;
}
