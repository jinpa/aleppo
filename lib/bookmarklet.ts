/**
 * Generates the bookmarklet JavaScript source.
 *
 * Approach: open Aleppo in a new window, then pass recipe data via
 * window.postMessage.  This avoids every transport problem:
 *   - No cross-origin fetch (no CORS headers needed)
 *   - No mixed-content block (HTTPS → HTTP localhost is fine with postMessage)
 *   - No URL length limit (data never goes in a query string)
 *
 * Flow:
 *   1. Bookmarklet opens /recipes/import?mode=bookmarklet in a new window.
 *   2. That page sends window.opener.postMessage({type:'aleppo:ready'}).
 *   3. Bookmarklet receives the signal and replies with {type:'aleppo:data', payload}.
 *   4. Import page processes the payload and shows the review form.
 */
export function buildBookmarkletCode(appUrl: string): string {
  const code = `
(function(){
  var base=${JSON.stringify(appUrl)};
  var scripts=document.querySelectorAll('script[type="application/ld+json"]');
  var jsonld=[];
  for(var i=0;i<scripts.length;i++){try{jsonld.push(JSON.parse(scripts[i].textContent));}catch(e){}}
  // Microdata fallback for sites like WordPress/Jetpack that use itemprop attributes
  // instead of JSON-LD script tags (e.g. smittenkitchen.com).
  var re=document.querySelector('[itemtype="https://schema.org/Recipe"],[itemtype="http://schema.org/Recipe"]');
  if(re){
    var md={'@type':'Recipe','recipeIngredient':[],'recipeInstructions':[]};
    var n=re.querySelector('[itemprop="name"]');
    if(n)md.name=n.textContent.trim();
    var ings=re.querySelectorAll('[itemprop="recipeIngredient"]');
    for(var j=0;j<ings.length;j++){var s=ings[j].textContent.trim();if(s)md.recipeIngredient.push(s);}
    var yr=re.querySelector('[itemprop="recipeYield"]');
    if(yr)md.recipeYield=yr.textContent.trim().replace(/^servings:\s*/i,'');
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
  var payload={
    jsonld:jsonld,
    url:location.href,
    title:document.title,
    ogImage:((document.querySelector('meta[property="og:image"]')||{}).content)||'',
    siteName:((document.querySelector('meta[property="og:site_name"]')||{}).content)||''
  };
  var w=window.open(base+'/recipes/import?mode=bookmarklet','aleppo_import','width=1100,height=800');
  if(!w){alert('Aleppo: allow popups for this site, then click the bookmarklet again.');return;}
  var sent=false;
  function onMsg(e){
    if(!e.data||e.data.type!=='aleppo:ready'||sent)return;
    sent=true;
    window.removeEventListener('message',onMsg);
    w.postMessage({type:'aleppo:data',payload:payload},base);
  }
  window.addEventListener('message',onMsg);
  setTimeout(function(){window.removeEventListener('message',onMsg);},30000);
})();
`.trim();

  return `javascript:${encodeURIComponent(code)}`;
}
