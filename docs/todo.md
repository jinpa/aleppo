# Ideas & Backlog

Random ideas and non-urgent improvements to revisit later.

## UX / Features

- [ ] Make the "want to cook" queue re-orderable (drag-and-drop or up/down arrows)

## Import / Scraping

- [ ] **Heuristic plain-text recipe extraction** — older blog posts (e.g. smittenkitchen.com pre-2012) have no JSON-LD or microdata; the recipe is just prose in the post body. Options: (a) pattern-match ingredient-looking lines (quantities + unit words) and paragraph blocks for instructions, or (b) wait for V2 AI extraction and pass the post body to Gemini. The bookmarklet already pre-fills the title and image for these pages, so manual entry is the current fallback. Example: https://smittenkitchen.com/2007/07/red-pepper-soup/

