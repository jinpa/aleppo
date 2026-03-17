import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import { sharedStyles } from "./importStyles";
import { RecipeWebExtractor } from "@/components/RecipeWebExtractor";
import { CookingSpinner } from "@/components/CookingSpinner";
import type { ImportOutcome } from "./types";

type ImportUrlHandlerProps = {
  token: string | null;
  modeParam?: string;
  shareUrl?: string;
  onComplete: (outcome: ImportOutcome) => void;
  onAttempt?: () => void;
};

export function ImportUrlHandler({ token, modeParam, shareUrl, onComplete, onAttempt }: ImportUrlHandlerProps) {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [extracting, setExtracting] = useState(!!shareUrl);
  const [extractionUrl, setExtractionUrl] = useState(shareUrl ?? "");
  const extractionDone = useRef(false);
  const [waitingForBookmarklet, setWaitingForBookmarklet] = useState(modeParam === "bookmarklet");
  const bookmarkletReadySent = useRef(false);
  const bookmarkletDataReceived = useRef(false);

  // ── Bookmarklet postMessage handshake ─────────────────────────────────────
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
      const currentToken = Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
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
          onComplete({
            ok: false,
            error: res.status === 401
              ? "Authentication error — please reload and try again."
              : data.error ?? "Import failed.",
          });
          return;
        }
        const sourceUrl = payload?.url ?? "";
        onComplete({
          ok: true,
          recipe: { ...(data.recipe ?? {}), sourceUrl },
          parseError: data.recipe ? undefined : "No recipe structured data found on that page. Please fill in the details manually.",
        });
      } catch {
        onComplete({ ok: false, error: "Failed to connect to server." });
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

  // ── Share sheet / WebView extraction callbacks ────────────────────────────
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

    const currentToken = Platform.OS === "web" ? localStorage.getItem("auth_token") : token;
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
      const sourceUrl = payload?.url ?? "";
      if (!res.ok) {
        onComplete({
          ok: false,
          error: res.status === 401
            ? "Authentication error — please try again."
            : data.error ?? "Import failed.",
        });
      } else {
        onComplete({
          ok: true,
          recipe: { ...(data.recipe ?? {}), sourceUrl },
          parseError: data.recipe ? undefined : "No recipe structured data found on that page. Please fill in the details manually.",
        });
      }
    } catch {
      onComplete({ ok: false, error: "Failed to connect to server." });
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
        onComplete({ ok: false, error: data.error ?? "Failed to fetch URL." });
        return;
      }
      onComplete({
        ok: true,
        recipe: { ...(data.recipe ?? {}), sourceUrl: currentUrl },
        parseError: data.parseError ?? undefined,
      });
    } catch {
      onComplete({ ok: false, error: "Could not connect to server." });
    } finally {
      setFetching(false);
    }
  };

  const handleFetch = () => {
    if (!url.trim()) return;
    onAttempt?.();
    // Always use client-side WebView extraction first; handleExtractError
    // falls back to server-side scraping if the WebView fails.
    extractionDone.current = false;
    setExtractionUrl(url.trim());
    setExtracting(true);
  };

  const busy = fetching || extracting || waitingForBookmarklet;
  let spinnerLabel = "Fetching recipe…";
  if (waitingForBookmarklet) spinnerLabel = "Receiving recipe from your browser…";
  else if (extracting && extractionUrl) {
    let hostname = "";
    try { hostname = new URL(extractionUrl).hostname; } catch {}
    spinnerLabel = `Extracting recipe from ${hostname || "page"}…`;
  }

  return (
    <>
      <Text style={sharedStyles.heading}>Import from URL</Text>
      <Text style={sharedStyles.subheading}>
        Paste a link to any recipe. We'll parse it — you review and edit before saving.
      </Text>

      <View style={styles.urlRow}>
        <TextInput
          style={[sharedStyles.input, styles.urlInput]}
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
          style={[sharedStyles.fetchButton, (!url.trim() || busy) && sharedStyles.fetchButtonDisabled]}
          onPress={handleFetch}
          disabled={!url.trim() || busy}
        >
          <Text style={sharedStyles.fetchButtonText}>Import</Text>
        </TouchableOpacity>
      </View>

      {/* WebView extractor runs hidden — no overlay needed */}
      {extracting && extractionUrl && (
        <View style={styles.hidden}>
          <RecipeWebExtractor
            url={extractionUrl}
            onResult={handleExtractResult}
            onError={handleExtractError}
          />
        </View>
      )}

      {busy ? (
        <CookingSpinner label={spinnerLabel} />
      ) : (
        <>
          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>Works well with:</Text>
            <Text style={styles.hintItem}>· AllRecipes, Simply Recipes, NYT Cooking</Text>
            <Text style={styles.hintItem}>· Food Network, Epicurious, King Arthur</Text>
            <Text style={styles.hintItem}>· Most sites using Schema.org recipe markup</Text>
          </View>

          <BookmarkletSection />
        </>
      )}
    </>
  );
}

// ── Bookmarklet section (web-only) ────────────────────────────────────────
// Renders a draggable bookmarklet button for web; hidden on native.
// Uses React.createElement('a', ...) to produce a real HTML <a> element in
// React Native Web — the only way to get browser drag-to-bookmark behaviour.
function BookmarkletSection() {
  const [open, setOpen] = useState(false);
  const linkRef = useRef<any>(null);

  useEffect(() => {
    if (!open || !linkRef.current || Platform.OS !== "web") return;
    const appUrl = (window as any).location.origin;
    // Thin loader: injects bookmarklet.js from the server so extraction
    // logic stays up-to-date without users needing to re-drag the bookmark.
    const code = `(function(){var s=document.createElement('script');s.src=${JSON.stringify(appUrl + "/bookmarklet.js")};document.head.appendChild(s);})()`;
    linkRef.current.href = `javascript:${encodeURIComponent(code)}`;
  }, [open]);

  if (Platform.OS !== "web") return null;

  // Cast to any so TypeScript doesn't complain about the raw 'a' element
  const A = "a" as unknown as React.ComponentType<any>;

  return (
    <View style={bkStyles.container}>
      <TouchableOpacity style={bkStyles.toggle} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="bookmark-outline" size={16} color="#d97706" />
        <Text style={bkStyles.toggleText}>Use the Aleppo bookmarklet (works on any site)</Text>
        <Text style={bkStyles.toggleChevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={bkStyles.panel}>
          <View style={bkStyles.infoRow}>
            <Ionicons name="information-circle-outline" size={15} color="#78716c" />
            <Text style={bkStyles.infoText}>
              The bookmarklet runs in your browser on the recipe page — Cloudflare and bot
              protection can't block it because you're already there.
            </Text>
          </View>

          <Text style={bkStyles.stepLabel}>Step 1 — Drag this button to your bookmarks bar:</Text>
          <View style={bkStyles.dragRow}>
            {/* Real HTML <a> for drag-to-bookmark; href set via ref in useEffect */}
            <A
              ref={linkRef}
              href="#"
              draggable
              onClick={(e: any) => {
                e.preventDefault();
                alert("Drag this button to your bookmarks bar — don't click it here!");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                backgroundColor: "#d97706",
                color: "#fff",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: "600",
                cursor: "grab",
                userSelect: "none",
                textDecoration: "none",
              }}
            >
              🔖 + Aleppo
            </A>
            <Text style={bkStyles.dragHint}>← drag me to your bookmarks bar</Text>
          </View>

          <Text style={bkStyles.stepLabel}>Step 2 — Use it:</Text>
          <Text style={bkStyles.stepItem}>1. Go to any recipe page (e.g. Serious Eats)</Text>
          <Text style={bkStyles.stepItem}>2. Click <Text style={{ fontWeight: "700" }}>+ Aleppo</Text> in your bookmarks bar</Text>
          <Text style={bkStyles.stepItem}>3. You'll be brought here to review and save the recipe</Text>

          <Text style={bkStyles.fine}>
            The bookmarklet only reads recipe data from the current page — nothing else.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { height: 0, overflow: "hidden" },
  urlRow: { flexDirection: "row", gap: 8 },
  urlInput: { flex: 1 },
  hintBox: {
    backgroundColor: "#f5f5f4",
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  hintTitle: { fontSize: 13, fontWeight: "600", color: "#57534e", marginBottom: 4 },
  hintItem: { fontSize: 13, color: "#78716c" },
});

const bkStyles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingTop: 16,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: { flex: 1, fontSize: 14, fontWeight: "500", color: "#57534e" },
  toggleChevron: { fontSize: 11, color: "#a8a29e" },
  panel: {
    marginTop: 14,
    backgroundColor: "#f5f5f4",
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  infoRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, color: "#78716c", lineHeight: 18 },
  stepLabel: { fontSize: 13, fontWeight: "600", color: "#1c1917" },
  dragRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dragHint: { fontSize: 12, color: "#a8a29e", fontStyle: "italic" },
  stepItem: { fontSize: 13, color: "#57534e", lineHeight: 20 },
  fine: { fontSize: 11, color: "#a8a29e" },
});
