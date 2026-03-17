/**
 * Returns a thin-loader bookmarklet href.
 *
 * The loader just injects <script src="BASE/bookmarklet.js"> into the current
 * page. The actual extraction logic lives in public/bookmarklet.js, which is
 * served by the app — so updating extraction code takes effect immediately for
 * all users without re-dragging the bookmarklet.
 */
export function bookmarkletHref(appUrl: string): string {
  const code = `(function(){var s=document.createElement('script');s.src=${JSON.stringify(appUrl + "/bookmarklet.js")};document.head.appendChild(s);})()`;
  return `javascript:${encodeURIComponent(code)}`;
}
