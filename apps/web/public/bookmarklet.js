// Aleppo bookmarklet — served from the app so updates take effect immediately.
// Injected via a thin loader: javascript:(function(){var s=document.createElement('script');s.src='BASE/bookmarklet.js';document.head.appendChild(s);})()
(function () {
  // Derive base URL from this script's src attribute
  var scriptEl = document.currentScript;
  if (!scriptEl || !scriptEl.src) {
    alert("Aleppo bookmarklet: could not determine app URL.");
    return;
  }
  var base = scriptEl.src.replace(/\/bookmarklet\.js(\?.*)?$/, "");

  // ── 1. Collect JSON-LD blocks ───────────────────────────────────────────
  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  var jsonld = [];
  for (var i = 0; i < scripts.length; i++) {
    try {
      jsonld.push(JSON.parse(scripts[i].textContent));
    } catch (e) {}
  }

  // ── 2. Microdata fallback (e.g. smittenkitchen.com) ─────────────────────
  var re = document.querySelector(
    '[itemtype="https://schema.org/Recipe"],[itemtype="http://schema.org/Recipe"]'
  );
  if (re) {
    var md = { "@type": "Recipe", recipeIngredient: [], recipeInstructions: [] };
    var n = re.querySelector('[itemprop="name"]');
    if (n) md.name = n.textContent.trim();
    var ings = re.querySelectorAll('[itemprop="recipeIngredient"]');
    for (var j = 0; j < ings.length; j++) {
      var s = ings[j].textContent.trim();
      if (s) md.recipeIngredient.push(s);
    }
    var yr = re.querySelector('[itemprop="recipeYield"]');
    if (yr) md.recipeYield = yr.textContent.trim().replace(/^servings:\s*/i, "");
    var tf = ["totalTime", "cookTime", "prepTime"];
    for (var j = 0; j < tf.length; j++) {
      var tel = re.querySelector('[itemprop="' + tf[j] + '"]');
      if (tel) md[tf[j]] = tel.getAttribute("datetime") || tel.textContent.trim();
    }
    var iels = re.querySelectorAll('[itemprop="recipeInstructions"]');
    if (iels.length) {
      for (var j = 0; j < iels.length; j++) {
        var s = iels[j].textContent.trim();
        if (s) md.recipeInstructions.push({ "@type": "HowToStep", text: s });
      }
    } else {
      var de = re.querySelector(".e-instructions,.jetpack-recipe-directions");
      if (de) {
        var ps = de.querySelectorAll("p");
        if (ps.length) {
          for (var j = 0; j < ps.length; j++) {
            var s = ps[j].textContent.trim();
            if (s) md.recipeInstructions.push({ "@type": "HowToStep", text: s });
          }
        } else {
          var s = de.textContent.trim();
          if (s) md.recipeInstructions.push({ "@type": "HowToStep", text: s });
        }
      }
    }
    if (md.name || md.recipeIngredient.length) jsonld.push(md);
  }

  // ── 3. Detect comments section ──────────────────────────────────────────
  var commentIds = ["comments", "disqus_thread", "respond"];
  var commentClasses = [".comments-area", ".comment-list"];
  var commentsUrl = null;
  for (var ci = 0; ci < commentIds.length; ci++) {
    if (document.getElementById(commentIds[ci])) {
      commentsUrl = location.href + "#" + commentIds[ci];
      break;
    }
  }
  if (!commentsUrl) {
    for (var ci = 0; ci < commentClasses.length; ci++) {
      if (document.querySelector(commentClasses[ci])) {
        commentsUrl = location.href + "#comments";
        break;
      }
    }
  }

  // ── 4. Build payload ────────────────────────────────────────────────────
  var payload = {
    jsonld: jsonld,
    url: location.href,
    title: document.title,
    ogImage:
      ((document.querySelector('meta[property="og:image"]') || {}).content) ||
      "",
    siteName:
      ((document.querySelector('meta[property="og:site_name"]') || {}).content) ||
      "",
    commentsUrl: commentsUrl,
  };

  // ── 5. Open Aleppo import page and postMessage handshake ────────────────
  var w = window.open(
    base + "/import?mode=bookmarklet",
    "aleppo_import",
    "width=1100,height=800"
  );
  if (!w) {
    alert(
      "Aleppo: allow popups for this site, then click the bookmarklet again."
    );
    return;
  }
  var sent = false;
  function onMsg(e) {
    if (!e.data || e.data.type !== "aleppo:ready" || sent) return;
    sent = true;
    window.removeEventListener("message", onMsg);
    w.postMessage({ type: "aleppo:data", payload: payload }, base);
  }
  window.addEventListener("message", onMsg);
  setTimeout(function () {
    window.removeEventListener("message", onMsg);
  }, 30000);
})();
