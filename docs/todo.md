# Ideas & Backlog

Random ideas and non-urgent improvements to revisit later.

## UX / Features

- [ ] Make the "want to cook" queue re-orderable (drag-and-drop or up/down arrows)

## Infrastructure / Ops

- [ ] **R2 production setup** — local dev uses `aleppo-images-local` with the free `.r2.dev` public URL (rate-limited, fine for dev). Before launch, set up a separate `aleppo-images` production bucket on Railway with a custom domain connected (Cloudflare R2 → bucket → Settings → Custom Domains). Also backfill existing recipes that have third-party `imageUrl` values (hotlinked from original recipe sites) — these will rot over time and should be re-uploaded to R2.

## Dependencies / Infrastructure

- [ ] **Duplicate `sharp` install** — Next.js bundles its own copy of `@img/sharp-libvips-darwin-arm64` inside `next/node_modules/`, which conflicts with the root-level `sharp` install. Dev server logs show: `"Class GNotificationCenterDelegate is implemented in both … One of the duplicates must be removed or renamed."` Harmless so far but could cause mysterious crashes. Options: (a) pin `sharp` to a version that matches what Next.js 15 ships internally, or (b) add a `resolutions`/`overrides` field in `package.json` to force a single copy.

## Import / Scraping

- [ ] **Heuristic plain-text recipe extraction** — older blog posts (e.g. smittenkitchen.com pre-2012) have no JSON-LD or microdata; the recipe is just prose in the post body. Options: (a) pattern-match ingredient-looking lines (quantities + unit words) and paragraph blocks for instructions, or (b) wait for V2 AI extraction and pass the post body to Gemini. The bookmarklet already pre-fills the title and image for these pages, so manual entry is the current fallback. Example: https://smittenkitchen.com/2007/07/red-pepper-soup/

