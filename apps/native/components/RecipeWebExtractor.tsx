import { useRef, useEffect } from "react";
import { View, Platform } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

interface RecipePayload {
  jsonld: unknown[];
  url: string;
  title: string;
  ogImage: string;
  siteName: string;
  commentsUrl: string | null;
}

interface Props {
  url: string;
  onResult: (payload: RecipePayload) => void;
  onError: (message: string) => void;
}

// Extraction script — same logic as the bookmarklet (bookmarklet.ts lines 20-61),
// but posts via ReactNativeWebView instead of window.opener handshake.
// Wrapped in try-catch so silent JS errors don't cause a timeout.
const EXTRACTION_SCRIPT = `
(function(){
  try {
    var scripts=document.querySelectorAll('script[type="application/ld+json"]');
    var jsonld=[];
    for(var i=0;i<scripts.length;i++){try{jsonld.push(JSON.parse(scripts[i].textContent));}catch(e){}}

    var re=document.querySelector('[itemtype="https://schema.org/Recipe"],[itemtype="http://schema.org/Recipe"]');
    if(re){
      var md={'@type':'Recipe','recipeIngredient':[],'recipeInstructions':[]};
      var n=re.querySelector('[itemprop="name"]');
      if(n)md.name=n.textContent.trim();
      var ings=re.querySelectorAll('[itemprop="recipeIngredient"]');
      for(var j=0;j<ings.length;j++){var s=ings[j].textContent.trim();if(s)md.recipeIngredient.push(s);}
      var yr=re.querySelector('[itemprop="recipeYield"]');
      if(yr)md.recipeYield=yr.textContent.trim().replace(/^servings:\\s*/i,'');
      var tf=['totalTime','cookTime','prepTime'];
      for(var j=0;j<tf.length;j++){var tel=re.querySelector('[itemprop="'+tf[j]+'"]');if(tel)md[tf[j]]=tel.getAttribute('datetime')||tel.textContent.trim();}
      var iels=re.querySelectorAll('[itemprop="recipeInstructions"]');
      if(iels.length){
        for(var j=0;j<iels.length;j++){var s=iels[j].textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}
      }else{
        var de=re.querySelector('.e-instructions,.jetpack-recipe-directions');
        if(de){
          var ps=de.querySelectorAll('p');
          if(ps.length){for(var j=0;j<ps.length;j++){var s=ps[j].textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}}
          else{var s=de.textContent.trim();if(s)md.recipeInstructions.push({'@type':'HowToStep','text':s});}
        }
      }
      if(md.name||md.recipeIngredient.length)jsonld.push(md);
    }

    var commentIds=['comments','disqus_thread','respond'];
    var commentClasses=['.comments-area','.comment-list'];
    var commentsUrl=null;
    for(var ci=0;ci<commentIds.length;ci++){if(document.getElementById(commentIds[ci])){commentsUrl=location.href+'#'+commentIds[ci];break;}}
    if(!commentsUrl){for(var ci=0;ci<commentClasses.length;ci++){if(document.querySelector(commentClasses[ci])){commentsUrl=location.href+'#comments';break;}}}

    var payload={
      jsonld:jsonld,
      url:location.href,
      title:document.title,
      ogImage:((document.querySelector('meta[property="og:image"]')||{}).content)||'',
      siteName:((document.querySelector('meta[property="og:site_name"]')||{}).content)||'',
      commentsUrl:commentsUrl
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({error: e.message || 'extraction failed'}));
  }
})();
true;
`;

const MOBILE_USER_AGENT =
  Platform.OS === "ios"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export function RecipeWebExtractor({ url, onResult, onError }: Props) {
  const resultReceived = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!resultReceived.current) {
        resultReceived.current = true;
        onError("Timed out loading page. The site may be too slow or blocking access.");
      }
    }, 15000);
    return () => clearTimeout(timeoutRef.current);
  }, [onError]);

  const handleMessage = (event: WebViewMessageEvent) => {
    if (resultReceived.current) return;
    resultReceived.current = true;
    clearTimeout(timeoutRef.current);
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.error) {
        onError(data.error);
        return;
      }
      onResult(data as RecipePayload);
    } catch {
      onError("Failed to parse recipe data from page.");
    }
  };

  const handleError = () => {
    if (resultReceived.current) return;
    resultReceived.current = true;
    clearTimeout(timeoutRef.current);
    onError("Failed to load the page. Please check the URL and try again.");
  };

  const handleLoadEnd = () => {
    // Inject extraction script after page finishes loading.
    // This is more reliable than injectedJavaScriptAfterDOMContentLoaded,
    // which can silently fail on some sites. Small delay lets JS-rendered
    // content settle (e.g. client-side hydration of JSON-LD).
    if (resultReceived.current) return;
    setTimeout(() => {
      if (!resultReceived.current && webViewRef.current) {
        webViewRef.current.injectJavaScript(EXTRACTION_SCRIPT);
      }
    }, 1500);
  };

  return (
    <View style={{ width: 0, height: 0, overflow: "hidden" }}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        userAgent={MOBILE_USER_AGENT}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        onError={handleError}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        style={{ width: 0, height: 0 }}
      />
    </View>
  );
}
