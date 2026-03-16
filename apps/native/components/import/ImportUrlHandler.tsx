import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import type { ScrapedRecipe } from "@aleppo/shared";
import { sharedStyles } from "./importStyles";
import { ImportBookmarkletWaiting } from "./ImportBookmarkletWaiting";

export type ImportUrlResult = {
  recipe: ScrapedRecipe;
  url: string;
  parseError?: string | null;
};

type ImportUrlHandlerProps = {
  token: string | null;
  modeParam?: string;
  shareUrl?: string;
  onComplete: (result: ImportUrlResult) => void;
};

export function ImportUrlHandler({ token, modeParam, shareUrl, onComplete }: ImportUrlHandlerProps) {
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
            recipe: {},
            url: payload?.url ?? "",
            parseError: res.status === 401
              ? "Authentication error — please reload and try again."
              : data.error ?? "Import failed. Please fill in the details manually.",
          });
          return;
        }
        onComplete({
          recipe: data.recipe ?? {},
          url: payload?.url ?? "",
          parseError: data.recipe ? null : "No recipe structured data found on that page. Please fill in the details manually.",
        });
      } catch {
        onComplete({ recipe: {}, url: payload?.url ?? "", parseError: "Failed to connect to server." });
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
      if (!res.ok) {
        onComplete({
          recipe: {},
          url: payload?.url ?? "",
          parseError: res.status === 401
            ? "Authentication error — please try again."
            : data.error ?? "Import failed. Please fill in the details manually.",
        });
      } else {
        onComplete({
          recipe: data.recipe ?? {},
          url: payload?.url ?? "",
          parseError: data.recipe ? null : "No recipe structured data found on that page. Please fill in the details manually.",
        });
      }
    } catch {
      onComplete({ recipe: {}, url: payload?.url ?? "", parseError: "Failed to connect to server." });
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
      onComplete({
        recipe: data.recipe ?? {},
        url: currentUrl,
        parseError: data.parseError ?? null,
      });
    } finally {
      setFetching(false);
    }
  };

  const handleFetch = () => {
    if (!url.trim()) return;
    // Always use client-side WebView extraction first; handleExtractError
    // falls back to server-side scraping if the WebView fails.
    extractionDone.current = false;
    setExtractionUrl(url.trim());
    setExtracting(true);
  };

  // Full-screen overlay during extraction / bookmarklet wait
  if ((extracting && extractionUrl) || waitingForBookmarklet) {
    return (
      <View style={styles.fullScreen}>
        <ImportBookmarkletWaiting
          extracting={extracting}
          extractionUrl={extractionUrl}
          waitingForBookmarklet={waitingForBookmarklet}
          handleExtractResult={handleExtractResult}
          handleExtractError={handleExtractError}
        />
      </View>
    );
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
          style={[sharedStyles.fetchButton, (!url.trim() || fetching) && sharedStyles.fetchButtonDisabled]}
          onPress={handleFetch}
          disabled={!url.trim() || fetching}
        >
          {fetching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={sharedStyles.fetchButtonText}>Import</Text>
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
    // Same bookmarklet as the web app, but opens /import instead of /recipes/import
    const code = `(function(){var base=${JSON.stringify(appUrl)};var scripts=document.querySelectorAll('script[type="application/ld+json"]');var jsonld=[];for(var i=0;i<scripts.length;i++){try{jsonld.push(JSON.parse(scripts[i].textContent));}catch(e){}}var re=document.querySelector('[itemtype="https://schema.org/Recipe"],[itemtype="http://schema.org/Recipe"]');if(re){var md={'@type':'Recipe','recipeIngredient':[],'recipeInstructions':[]};var n=re.querySelector('[itemprop="name"]');if(n)md.name=n.textContent.trim();var ings=re.querySelectorAll('[itemprop="recipeIngredient"]');for(var j=0;j<ings.length;j++){var s=ings[j].textContent.trim();if(s)md.recipeIngredient.push(s);}var yr=re.querySelector('[itemprop="recipeYield"]');if(yr)md.recipeYield=yr.textContent.trim().replace(/^servings:\\s*/i,'');var tf=['totalTime','cookTime','prepTime'];for(var j=0;j<tf.length;j++){var tel=re.querySelector('[itemprop="'+tf[j]+'"]');if(tel)md[tf[j]]=tel.getAttribute('datetime')||tel.textContent.trim();}var iels=re.querySelectorAll('[itemprop="recipeInstructions"]');if(iels.length){for(var j=0;j<iels.length;j++){var s=iels[j].textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}else{var de=re.querySelector('.e-instructions,.jetpack-recipe-directions');if(de){var ps=de.querySelectorAll('p');if(ps.length){for(var j=0;j<ps.length;j++){var s=ps[j].textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}else{var s=de.textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}}if(md.name||md.recipeIngredient.length)jsonld.push(md);}var commentIds=['comments','disqus_thread','respond'];var commentClasses=['.comments-area','.comment-list'];var commentsUrl=null;for(var ci=0;ci<commentIds.length;ci++){if(document.getElementById(commentIds[ci])){commentsUrl=location.href+'#'+commentIds[ci];break;}}if(!commentsUrl){for(var ci=0;ci<commentClasses.length;ci++){if(document.querySelector(commentClasses[ci])){commentsUrl=location.href+'#comments';break;}}}var payload={jsonld:jsonld,url:location.href,title:document.title,ogImage:((document.querySelector('meta[property="og:image"]')||{}).content)||'',siteName:((document.querySelector('meta[property="og:site_name"]')||{}).content)||'',commentsUrl:commentsUrl};var w=window.open(base+'/import?mode=bookmarklet','aleppo_import','width=1100,height=800');if(!w){alert('Aleppo: allow popups for this site, then click the bookmarklet again.');return;}var sent=false;function onMsg(e){if(!e.data||e.data.type!=='aleppo:ready'||sent)return;sent=true;window.removeEventListener('message',onMsg);w.postMessage({type:'aleppo:data',payload:payload},base);}window.addEventListener('message',onMsg);setTimeout(function(){window.removeEventListener('message',onMsg);},30000);})();`;
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
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fafaf9",
    zIndex: 100,
  },
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
