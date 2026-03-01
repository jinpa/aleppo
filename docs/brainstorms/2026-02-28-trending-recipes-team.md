# Team Brainstorm: Trending Recipes Feature

**Date**: 2026-02-28
**Method**: Agent Team (adversarial multi-perspective)
**Status**: Ready for Planning — with prerequisites
**Team Size**: 5 teammates (Devil's Advocate, Optimist, Creative Explorer, Researcher, Technical Architect)

---

## Executive Summary

Aleppo has a latent community signal — import counts and cook logs aggregated across users by `sourceUrl` — that no surface currently exposes. The team reached consensus that this signal is genuinely valuable, but that the *right first implementation* is not a trending page. It is a single social proof count on the import preview screen ("Saved by 23 Aleppo users"), which sidesteps every cold-start, privacy, and data-quality concern while delivering the highest-leverage version of the core value: validation at the moment of decision. A full trending discovery page is the right longer-term destination but requires a prerequisite: URL normalization must be solved first, or all aggregation is junk data.

---

## Idea Evolution

### Original Concept
Surface "most-imported recipes" and "hot recipes" (lots of recent imports) on a separate Explore tab and/or incorporated into the home page.

### Refined Understanding
After team debate, the concept sharpened considerably: the core value of trending data is **social proof at the moment of decision** (import preview), not broadcast discovery (a trending page). A trending page is the ambitious follow-on, not the MVP. The minimum viable version requires only one query and one UI element, delivers the highest engagement value, and has no cold-start dependency.

### Key Clarifications (from Socratic phase)
- Primary goal: engagement for existing users (not growth/acquisition)
- Signal: both import counts and cook log counts
- No hard constraints — explore freely

---

## Team Debate Summary

### Points of Agreement

- The data infrastructure for this feature already exists — `recipeImports.sourceUrl` and `cookLogs → recipes.sourceUrl` are the linking keys
- Cook count is a meaningfully stronger quality signal than import count, but is sparser data at MVP scale
- **URL normalization is a hard prerequisite**, not optional — without it, aggregation by `sourceUrl` produces fragmented noise (the same recipe imported via different newsletter UTM links appears as separate entries)
- The minimal version — social proof count on the import preview screen — is clearly worth building and sidesteps most risks
- `recipes.imageUrl` (already R2-hosted) + `recipes.title` is the right source for trending card display data (not rawPayload parsing)
- A minimum threshold of N ≥ 3 distinct importers before showing any trending count is a hard requirement

### Points of Contention

| Topic | Devil's Advocate | Optimist | Resolution |
|-------|-----------------|----------|------------|
| Cold-start risk | Fatal — a trending list showing counts of 1–2 actively signals the app is dead | Manageable — threshold gating + the feature scales with the community | **DA is right about the page, Optimist is right about import preview.** Social proof on import preview works at *any* user count (the user already found the recipe; "2 others saved it" is still interesting). A trending page requires density. Gate the page behind a minimum threshold until signal is meaningful. |
| Privacy of cook signal | Using private cook logs to produce public aggregate counts is a policy violation users didn't consent to | Aggregated counts don't expose individual users | **Explicit policy decision required.** Resolution: count cooks from `users.isPublic = true` only, regardless of `recipes.isPublic`. Public users opted into visibility; their aggregate cook behavior is fair game. Private users did not. Document this in user-facing privacy settings. |
| Feature identity risk | "Trending" shifts Aleppo toward "what everyone else is cooking" — antithetical to the diary identity | Social proof validates rather than displaces the diary loop | **The framing matters.** Call it social proof / community signal, not "trending." "23 Aleppo users saved this" reinforces the user's individual decision; "Trending Recipes" positions Aleppo as a content platform. Surface the data contextually (at import, on recipe detail) before building a dedicated discovery page. |
| URL normalization first vs. ship and iterate | Ship with broken deduplication rather than wait | Can iterate | **DA wins.** A trending list full of duplicate cards is a bug, not a beta. The normalization work is a prerequisite. Estimate: ~2–3 hours. Not a blocker — a prerequisite. |

### Debate Highlights

**The most productive exchange** was between DA and Optimist on cold-start. The DA's critique of a trending *page* at MVP scale was correct and well-argued: "A new user who sees 'most cooked this week: Pasta Carbonara (2), Chicken Soup (1), Banana Bread (1)' concludes the app has almost no users." But the Optimist found the way around it: "On a platform with 100 users, a recipe saved by 8 people and cooked by 5 is a legitimately meaningful signal — 5–8% of the entire user base." Both claims are true simultaneously. The resolution is: scope the first implementation to where the numbers *don't need to be large to be meaningful* — the import preview screen.

**The Researcher made the signal quality case definitively:** the "save graveyard" phenomenon (Pocket, Amazon wishlists, TikTok saves) is well-documented. Cook count is the higher-quality signal; import count is noisier but more available. Neither alone is ideal — showing both side-by-side ("Saved by 34 · Cooked by 19") is a richer signal than either alone, and the *gap* between them (saved but not cooked) is itself informative.

**The Architect found a real bug**: `rawPayload` does not currently store `ogImage`. It's extracted from the page but discarded before write. One-line fix: add `ogImage` to `rawPayload` in `lib/recipe-scraper.ts`. Without this, trending cards for URLs where no user completed the import have no image fallback.

---

## Analysis Results

### Validated Strengths (survived adversarial scrutiny)

- **Import preview social proof is the highest-ROI implementation** — one query, one UI element, no new routes, works at any user count. The user is already in a decision frame; social proof is maximally useful there. Survived the DA's cold-start critique because the numbers don't need to be large to be meaningful at the individual import moment.

- **"Saved by X · Cooked by Y" is a genuinely novel signal** — no major recipe app shows both simultaneously. The gap between saves and cooks is itself informative (aspirational vs. proven). AllRecipes and Spillt surface "Made It" counts separately but not in relation to save counts. This is a differentiated data surface.

- **The social graph makes trending data more compelling** — "3 of the people you follow saved this" is more motivating than "143 strangers saved this." Strava and Goodreads both demonstrate this empirically. The follow graph in Aleppo is the right personalization layer: show network-scoped counts first, global as fallback.

- **rawPayload + `recipes` join = sufficient display data** — no new tables needed to render trending recipe cards. The `representative` CTE pattern (DISTINCT ON sourceUrl, oldest import) gives stable title/image/sourceName from existing rows.

- **Cook count is the Aleppo core value prop, expressed publicly** — the PRD says "cook count as quality signal." Trending is just that signal made ambient rather than private. The feature is ideologically consistent with the product's identity when framed correctly.

### Real Risks (not fully mitigated)

| Risk | Likelihood | Impact | Best Mitigation | Residual Concern |
|------|------------|--------|-----------------|------------------|
| URL fragmentation makes aggregation meaningless without normalization | H | H | `canonicalUrl` column at write time (Option C) — 2-3 hours of work, must be done before any trending feature ships | Retroactive backfill of existing rows; redirects/canonical tags on recipe sites are still not handled |
| Cook log signal leaks private user behavior | M | H | Only count cooks from `users.isPublic = true`; document policy in privacy settings | Users with public profiles cooking private recipes still contribute to counts — acceptable but should be noted in settings |
| Trending page looks dead at MVP scale (ghost town) | H | M | Gate behind N ≥ 3 threshold; start with import preview only; add page only when density is meaningful | No clear trigger for "now the page is ready" — needs a defined threshold milestone |
| Rich-get-richer: food media SEO titles dominate | M | M | Weight cook count 3× over import count in trending score (cook = intent + completion); time-window to 30 days | NYT Cooking and Serious Eats still likely to dominate; not a problem at MVP scale but worth watching |
| ogImage missing from rawPayload | H (already exists) | M | One-line fix in `recipe-scraper.ts` — add `ogImage` to rawPayload at write time | Existing import rows don't have it; fallback to recipes.imageUrl handles most cases |

### Creative Alternatives

| Alternative | Pros | Cons | Addresses Risk |
|-------------|------|------|----------------|
| Social proof on import preview only (minimal) | Zero cold-start dependency, highest-leverage placement, 1-2h build | Doesn't create a browseable discovery surface | Ghost town / scale risk |
| "In Your Network" tab on Feed page | Lives where social activity already lives, zero cold-start for social users, pure SQL | Zero value for users with no follows | Cold-start, scale |
| Standalone `/explore` trending page with threshold gating | Full discovery surface, potential SEO | Most complex build, data-starved at MVP | Ghost town — somewhat, via threshold |
| Trending tags/cuisines instead of trending URLs | Sidesteps URL canonicalization problem entirely, forgiving of private recipes | Less specific, harder to act on | URL normalization risk |
| "You're one of N people who cooked this" post-log confirmation | Reverse direction: your cook participates in community signal; delightful moment | Only visible at log time, no discovery | Feature identity risk |

### Gaps Identified

- [ ] **URL normalization utility** — `lib/url-normalize.ts` with Node `URL` class: strip UTM/tracking params, normalize www., sort remaining params, strip fragment. Must be applied at `recipeImports` write time and `recipes` save time. Backfill script needed for existing rows.
- [ ] **`canonicalUrl` migration** — `ALTER TABLE recipeImports ADD COLUMN canonicalUrl text` + same on `recipes`. Populated by normalization utility at write time.
- [ ] **ogImage in rawPayload** — one-line fix in `lib/recipe-scraper.ts` line ~341. Unblocks trending card images for incomplete imports.
- [ ] **Privacy policy wording** — add a note to settings: "When your profile is public, aggregate counts of recipes you've saved or cooked may appear as community signals."
- [ ] **Minimum threshold for trending page** — define the concrete milestone (e.g., "at least 25 distinct URLs with N ≥ 3 importers in the last 30 days") before building the `/explore` page.

### Premortem Findings

- **Failure mode: The trending section launched and showed the same 5 recipes for weeks** → Prevention: don't ship a trending page until the data density milestone is met; start with import preview social proof only
- **Failure mode: URL fragmentation corrupted the data** → Prevention: `canonicalUrl` normalization is a prerequisite, not optional
- **Failure mode: Users complained their private activity was being mined** → Prevention: explicit policy decision documented; only count cooks from public-profile users
- **Failure mode: The feature had no interaction model** → Prevention: every trending card links directly to the import flow for that URL; if user already has it saved, links to their recipe instead
- **Failure mode: "Trending" repositioned the app as a content discovery platform** → Prevention: surface social proof contextually (import preview, recipe detail) before a dedicated trending page; if a page ships, call it "Community" not "Trending"

---

## Research Findings

### External Evidence

- **Epicurious "Most-Saved This Week"** is the closest direct analog — a weekly behavioral-data + editorial-commentary hybrid. Lesson: numbers alone feel cold; editorial framing ("brothy bowls are having a moment") makes trending data feel curated. Aleppo doesn't have editorial budget, but can emulate by using temporal context ("this month" framing, seasonal tags).
- **Goodreads "Books Your Friends Are Reading"** outperforms global popularity as an engagement mechanic. Friend-network scoping is more relevant and drives more behavior than aggregate trending.
- **Strava Local Legends** found that "perceived attainability is the strongest predictor of motivation" — narrow scope (local segment) produces more winners and more behavior than a global leaderboard. Implication: "trending in your network" > "trending globally" for driving cook-log behavior.
- **Cook count > import count** for quality signal: documented across Pocket (saved ≠ read), Amazon wishlists (wishlisted ≠ purchased), Twitter favorites (multi-purpose signal). Cook logs are high-quality, low-volume; import counts are noisier but more available. The Researcher's matrix: cook uniqueness should weight ~3× import uniqueness in a combined score.
- **34% lift in conversions from on-page social proof** (ProveSource, 2025) — validates placing the count on the import preview screen specifically.
- **Rich-get-richer dynamics** in popularity algorithms are well-documented (2024 Springer survey, 2019 ACM WebSci) but primarily concern large platforms. Not an urgent concern at MVP scale; worth monitoring.
- **Spillt's "Made It" distinction from "Saved"** validates the dual-signal approach. No recipe app has yet shown both signals side-by-side on a discovery surface.

### Anti-Patterns to Avoid

- Don't launch a trending page before the minimum density threshold is met — a visibly sparse list is worse than no list
- Don't use raw `sourceUrl` as the grouping key without normalization — newsletter UTM variants will fragment signal
- Don't call it "Trending" — frames the app as content platform; prefer "Popular in the Community" or just show the numbers without a label
- Don't count cook logs from private-profile users in public aggregates
- Don't make trending the primary nav item — it's a discovery supplement, not the core loop

### Codebase Context

- `recipeImports.sourceUrl` — no index currently; add partial index on `(sourceUrl) WHERE status = 'parsed'`
- `recipes.sourceUrl` — no index currently; add partial index on `(sourceUrl) WHERE sourceUrl IS NOT NULL`
- `rawPayload` structure: `{ url, jsonLd, pageTitle, siteName }` — `ogImage` missing (one-line fix needed)
- Import preview UI: `components/recipes/import-flow.tsx` — the review step (line ~455 onwards) is where social proof count should appear
- Feed empty state: `components/feed/feed-view.tsx` lines 38–65 — currently shows "Follow some cooks" + search link; good candidate for showing a mini trending shelf as fallback

---

## Technical Assessment

- **Feasibility**: Moderate — all data is present, no new tables required, core query is expressible in raw SQL via Drizzle
- **Core query**: `FULL OUTER JOIN` of two CTAs — `(recipeImports GROUP BY canonicalUrl)` and `(cookLogs JOIN recipes GROUP BY recipes.canonicalUrl)` — with a `DISTINCT ON` representative for display data; score = `unique_importers × 1 + unique_cookers × 3`
- **URL normalization**: Use Node `URL` class in `lib/url-normalize.ts`; store in a new `canonicalUrl` column at write time; backfill existing rows
- **Display data**: Primary path — join through `recipes` (R2-hosted image + user-cleaned title); fallback — `rawPayload->>'ogImage'` and `rawPayload->>'pageTitle'` (requires one-line fix to store ogImage in rawPayload)
- **Performance**: Live query is fine at MVP scale; add two partial indexes; use `unstable_cache` with 1-hour TTL for the trending page query; no Redis, no queues (consistent with project conventions)
- **Hardest problem**: Privacy policy for cook signal — requires an explicit product decision before shipping, not an implementation choice

---

## Recommended Next Steps

### Phase 1 — Prerequisites (do before any trending surface ships)

1. Add `ogImage` to `rawPayload` in `lib/recipe-scraper.ts` (1 line)
2. Create `lib/url-normalize.ts` — Node URL-based normalization utility
3. Migration: add `canonicalUrl` column to `recipeImports` and `recipes`; populate at write time; backfill script for existing rows
4. Add two partial indexes: `recipeImports(sourceUrl) WHERE status = 'parsed'` and `recipes(sourceUrl) WHERE sourceUrl IS NOT NULL`

### Phase 2 — Minimum Viable (highest ROI, lowest cost)

5. On the import review step (`import-flow.tsx`), after scraping a URL, fetch `COUNT(DISTINCT userId) FROM recipeImports WHERE canonicalUrl = $canonical` and show "Saved by N Aleppo users" if N > 0. Add follow-graph query for "including X people you follow" if user has follows.

### Phase 3 — Feed Empty State (high value, medium cost)

6. When `followingCount === 0` on the feed page, instead of just a "Find people" CTA, show a mini "Trending this week" shelf (3–5 recipe cards from the trending query). This rescues the most barren empty state in the app.

### Phase 4 — Explore Page (ambitious, data-density gated)

7. Build `/explore` page only after the minimum density milestone is met (define as: ≥ 25 URLs with N ≥ 3 distinct importers in the last 30 days). Show two shelves: "Most Saved This Month" and "Most Cooked." Each card links to the import flow or to the user's existing recipe if already saved.

---

## Ready for Create-Plan

**Yes** — prerequisites and phasing are well-defined and adversarially tested.

### Suggested Plan Scope

Phase 1 (prerequisites) + Phase 2 (import preview social proof) are tightly scoped and should be a single plan. Phase 3 (feed empty state) can be added to the same plan. Phase 4 (Explore page) should be its own plan, conditional on hitting the density milestone.
