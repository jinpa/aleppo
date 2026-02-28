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
