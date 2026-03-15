import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";
import { RecipeWebExtractor } from "@/components/RecipeWebExtractor";
import { BookmarkletSection } from "@/components/import/BookmarkletSection";

interface UrlImportProps {
  token: string | null;
  onImportSuccess: (recipe: ScrapedRecipe, fetchedUrl?: string, error?: string | null) => void;
  modeParam: string | undefined;
  shareUrl: string | undefined;
}

export function UrlImport({ token, onImportSuccess, modeParam, shareUrl }: UrlImportProps) {
  // ── Share sheet extraction (native) ───────────────────────────────────────
  const [extracting, setExtracting] = useState(!!shareUrl);
  const [extractionUrl, setExtractionUrl] = useState(shareUrl ?? "");
  const extractionDone = useRef(false);

  // ── Bookmarklet mode ────────────────────────────────────────────────────────
  const [waitingForBookmarklet, setWaitingForBookmarklet] = useState(
    modeParam === "bookmarklet"
  );
  const bookmarkletReadySent = useRef(false);
  const bookmarkletDataReceived = useRef(false);

  // ── URL step state ──────────────────────────────────────────────────────────
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);

  // ── Bookmarklet postMessage handshake ───────────────────────────────────────

  useEffect(() => {
    if (modeParam !== "bookmarklet" || Platform.OS !== "web") return;
    if (bookmarkletDataReceived.current) return;

    const w = window as any;
    if (!w.opener) {
      setWaitingForBookmarklet(false);
      return;
    }

    async function handleMessage(e: MessageEvent) {
      if (bookmarkletDataReceived.current) return;
      if (!e.data || e.data.type !== "aleppo:data") return;

      bookmarkletDataReceived.current = true;
      setWaitingForBookmarklet(false);

      const payload = e.data.payload;
      // Read token fresh from localStorage — the closure may have captured a
      // null value if auth hadn't finished loading when the effect first ran.
      const currentToken =
        Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
      try {
        const res = await fetch(`${API_URL}/api/import/bookmarklet`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = res.status === 401
            ? "Authentication error — please reload and try again."
            : data.error ?? "Import failed. Please fill in the details manually.";
          onImportSuccess({} as ScrapedRecipe, payload?.url ?? "", errMsg);
          return;
        }
        if (data.recipe) {
          onImportSuccess(data.recipe, payload?.url ?? "");
        } else {
          onImportSuccess({} as ScrapedRecipe, payload?.url ?? "", "No recipe structured data found on that page. Please fill in the details manually.");
        }
        setUrl(payload?.url ?? "");
      } catch {
        onImportSuccess({} as ScrapedRecipe, payload?.url ?? "", "Failed to connect to server.");
      }
    }

    window.addEventListener("message", handleMessage as any);

    if (!bookmarkletReadySent.current) {
      bookmarkletReadySent.current = true;
      w.opener.postMessage({ type: "aleppo:ready" }, "*");
    }

    const timeout = setTimeout(() => {
      if (!bookmarkletDataReceived.current) setWaitingForBookmarklet(false);
    }, 10000);

    return () => {
      window.removeEventListener("message", handleMessage as any);
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeParam]);

  // ── Share sheet extraction callbacks ────────────────────────────────────────

  const handleExtractResult = async (payload: {
    jsonld: unknown[];
    url: string;
    title: string;
    ogImage: string;
    siteName: string;
    commentsUrl: string | null;
  }) => {
    if (extractionDone.current) return;
    extractionDone.current = true;

    // Read token fresh — same pattern as bookmarklet handler
    const currentToken =
      Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
    try {
      const res = await fetch(`${API_URL}/api/import/bookmarklet`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = res.status === 401
          ? "Authentication error — please try again."
          : data.error ?? "Import failed. Please fill in the details manually.";
        onImportSuccess({} as ScrapedRecipe, payload?.url ?? "", errMsg);
      } else if (data.recipe) {
        setUrl(payload?.url ?? "");
        onImportSuccess(data.recipe, payload?.url ?? "");
      } else {
        setUrl(payload?.url ?? "");
        onImportSuccess({} as ScrapedRecipe, payload?.url ?? "", "No recipe structured data found on that page. Please fill in the details manually.");
      }
    } catch {
      onImportSuccess({} as ScrapedRecipe, payload?.url ?? "", "Failed to connect to server.");
      setUrl(payload?.url ?? "");
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractError = async (_message: string) => {
    if (extractionDone.current) return;
    extractionDone.current = true;
    const currentUrl = extractionUrl;
    // Stop the WebView, pre-fill the URL field, show fetch spinner
    setExtracting(false);
    setExtractionUrl("");
    setUrl(currentUrl);
    setFetching(true);
    // Automatically fall back to server-side scraping (has Playwright fallback)
    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: currentUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Failed to fetch URL");
        return;
      }
      const parseError = data.parseError ?? null;
      if (data.recipe) onImportSuccess(data.recipe, currentUrl, parseError);
      else onImportSuccess({} as ScrapedRecipe, currentUrl, parseError);
    } finally {
      setFetching(false);
    }
  };

  // ── URL fetch ────────────────────────────────────────────────────────────────

  const handleFetch = () => {
    if (!url.trim()) return;
    // Always use client-side WebView extraction first; handleExtractError
    // falls back to server-side scraping if the WebView fails.
    extractionDone.current = false;
    setExtractionUrl(url.trim());
    setExtracting(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

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

  return (
    <>
      <Text style={styles.heading}>Import from URL</Text>
      <Text style={styles.subheading}>
        Paste a link to any recipe. We'll parse it — you review and edit before saving.
      </Text>

      <View style={styles.urlRow}>
        <TextInput
          style={[styles.input, styles.urlInput]}
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor="#a8a29e"
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleFetch}
        />
        <TouchableOpacity
          style={[styles.fetchButton, (!url.trim() || fetching) && styles.fetchButtonDisabled]}
          onPress={handleFetch}
          disabled={!url.trim() || fetching}
        >
          {fetching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.fetchButtonText}>Import</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>Works well with:</Text>
        <Text style={styles.hintItem}>· AllRecipes, Simply Recipes, NYT Cooking</Text>
        <Text style={styles.hintItem}>· Food Network, Epicurious, King Arthur</Text>
        <Text style={styles.hintItem}>· Most sites using Schema.org recipe markup</Text>
      </View>

      <BookmarkletSection />
    </>
  );
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
  heading: { fontSize: 24, fontWeight: "700", color: "#1c1917" },
  subheading: { fontSize: 14, color: "#78716c", lineHeight: 20 },
  urlRow: { flexDirection: "row", gap: 8 },
  urlInput: { flex: 1 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1c1917",
  },
  fetchButton: {
    backgroundColor: "#1c1917",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  fetchButtonDisabled: { opacity: 0.5 },
  fetchButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  hintBox: {
    backgroundColor: "#f5f5f4",
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  hintTitle: { fontSize: 13, fontWeight: "600", color: "#57534e", marginBottom: 4 },
  hintItem: { fontSize: 13, color: "#78716c" },
});
