import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Renders a draggable bookmarklet button for web; hidden on native.
// Uses React.createElement('a', ...) to produce a real HTML <a> element in
// React Native Web — the only way to get browser drag-to-bookmark behaviour.
export function BookmarkletSection() {
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
