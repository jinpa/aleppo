import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { RecipeWebExtractor } from "@/components/RecipeWebExtractor";

type ImportBookmarkletWaitingProps = {
  extracting: boolean;
  extractionUrl: string;
  waitingForBookmarklet: boolean;
  handleExtractResult: (payload: {
    jsonld: unknown[];
    url: string;
    title: string;
    ogImage: string;
    siteName: string;
    commentsUrl: string | null;
  }) => void;
  handleExtractError: (message: string) => void;
};

export function ImportBookmarkletWaiting({
  extracting,
  extractionUrl,
  waitingForBookmarklet,
  handleExtractResult,
  handleExtractError,
}: ImportBookmarkletWaitingProps) {
  if (extracting && extractionUrl) {
    let hostname = "";
    try { hostname = new URL(extractionUrl).hostname; } catch {}
    return (
      <View style={styles.bookmarkletWaiting}>
        <ActivityIndicator size="large" color="#d97706" />
        <Text style={styles.bookmarkletWaitingText}>
          Extracting recipe from {hostname || "page"}…
        </Text>
        <RecipeWebExtractor
          url={extractionUrl}
          onResult={handleExtractResult}
          onError={handleExtractError}
        />
      </View>
    );
  }

  if (waitingForBookmarklet) {
    return (
      <View style={styles.bookmarkletWaiting}>
        <ActivityIndicator size="large" color="#d97706" />
        <Text style={styles.bookmarkletWaitingText}>Receiving recipe from your browser…</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bookmarkletWaiting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#fafaf9",
  },
  bookmarkletWaitingText: { fontSize: 15, color: "#78716c" },
});
