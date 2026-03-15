import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useAuth } from "@/contexts/auth";

// Catches unmatched deep links — primarily aleppo://dataUrl=aleppoShareKey from
// the iOS share extension. Waits briefly for the share intent to arrive, then
// navigates directly to the import screen (bypassing index.tsx → recipes redirect).
export default function NotFound() {
  const { shareIntent, resetShareIntent } = useShareIntent();
  const { token } = useAuth();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const url = shareIntent?.webUrl || shareIntent?.text;

    if (url) {
      try {
        new URL(url);
      } catch {
        // Invalid URL — fall through to normal routing below
        const t = setTimeout(() => { if (!handled.current) router.replace("/"); }, 800);
        return () => clearTimeout(t);
      }
      handled.current = true;
      resetShareIntent();
      if (token) {
        router.replace(`/(tabs)/import?shareUrl=${encodeURIComponent(url)}`);
      } else {
        router.replace({
          pathname: "/login",
          params: { returnTo: `/(tabs)/import?shareUrl=${encodeURIComponent(url)}` },
        });
      }
      return;
    }

    // No share intent yet — wait briefly for it to arrive, then fall through
    const t = setTimeout(() => { if (!handled.current) router.replace("/"); }, 800);
    return () => clearTimeout(t);
  }, [shareIntent, token]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafaf9" }}>
      <ActivityIndicator size="large" color="#d97706" />
    </View>
  );
}
