/**
 * Generates the bookmarklet JavaScript source.
 * The bookmarklet runs in the user's browser on any recipe page,
 * POSTs the page HTML to Aleppo's import endpoint, and redirects
 * to the review screen — bypassing server-side bot protection entirely.
 */
export function buildBookmarkletCode(appUrl: string): string {
  // Runs inside the user's browser on any recipe page.
  // Extracts JSON-LD structured data, POSTs to Aleppo's API,
  // then redirects to the review screen.
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
    ogImage:(document.querySelector('meta[property="og:image"]')||{}).content||'',
    siteName:(document.querySelector('meta[property="og:site_name"]')||{}).content||''
  };
  var btn=document.createElement('div');
  btn.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;background:#1c1917;color:#fff;padding:12px 18px;border-radius:12px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.3)';
  btn.textContent='Importing to Aleppo\u2026';
  document.body.appendChild(btn);
  fetch(base+'/api/import/bookmarklet',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    body:JSON.stringify(payload)
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.importId){location.href=base+'/recipes/import?importId='+d.importId;}
    else{btn.textContent='Import failed \u2014 are you signed in to Aleppo?';btn.style.background='#dc2626';}
  })
  .catch(function(){btn.textContent='Could not connect to Aleppo';btn.style.background='#dc2626';});
})();
`.trim();

  return `javascript:${encodeURIComponent(code)}`;
}
