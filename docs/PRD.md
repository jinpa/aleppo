# Aleppo — Product Requirements Document

**Version**: 1.0  
**Date**: 2026-02-27  
**Status**: V1.0 Implementation Complete — Beta Ready  

---

## Implementation Status

**V1.0 MVP: Complete — ready for beta launch.** All core features are implemented and wired up end-to-end. One gap remains before a full public launch:

| Area | Status | Notes |
|------|--------|-------|
| Auth (email/pw + Google OAuth) | ✅ Complete | |
| Recipe CRUD + tags + image upload | ✅ Complete | |
| URL import + review + audit trail | ✅ Complete | Bookmarklet also implemented |
| Cooking log (date, note, count, history) | ✅ Complete | |
| Want-to-cook queue | ✅ Complete | |
| Social (profiles, follow, feed, search) | ✅ Complete | User search added beyond original spec |
| User settings | ✅ Complete | |
| Forgot password email | ⚠️ Needs email provider | UI/API done; email delivery not yet wired up |
| Recipe scaling UI | ✅ Shipped early | Originally scoped to V3+; built during MVP |

---

## 1. Product Vision

> Aleppo is a web-first cooking diary — a place to save, organize, and log the recipes you actually cook, and share that cooking life with people you care about.

Unlike Paprika and other recipe vaults, Aleppo treats cooking as something that *happens*, not just something you plan. Over time, your recipe collection becomes a living record of your cooking life: what you've made, how many times, what you changed, what your friends have been cooking too.

**Positioning**: Strava for cooking. Letterboxd for recipes.

---

## 2. Target Audience

**Primary (MVP)**: Serious home cooks who currently use Paprika or a similar tool and are frustrated by:
- No web access (Paprika is mobile-only; desktop requires a separate $29.99 purchase)
- No way to see what friends are cooking
- No cooking history beyond a single "last made" date

**Secondary (V2+)**: Home cooks who own physical cookbooks they love but can't easily digitize.

**Not the target**: Casual recipe browsers (Pinterest, AllRecipes audience), professional chefs, people looking for recipe discovery/inspiration feeds.

---

## 3. Core Value Proposition

1. **Your recipes, everywhere** — web-first, fully responsive, one account works on every device
2. **Your cooking diary** — every time you cook something, log it; build a real history of your kitchen life
3. **Cook count as quality signal** — "I've made this 14 times" is more trustworthy than any star rating
4. **Cooking social, not recipe social** — follow friends to see what they've *actually cooked*, not what they've saved
5. **Frictionless import** — save from any food website in one step; migrate from Paprika in minutes (V1.5)

---

## 4. MVP — V1.0

The MVP proves the core thesis: **people will track what they cook, and that data becomes more valuable over time and in social context.** All features serve this thesis or are prerequisite infrastructure.

### 4.1 Authentication ✅

| Feature | Status | Detail |
|---------|--------|--------|
| Email / password signup | ✅ Done | Users create an account with email + password |
| Google OAuth | ✅ Done | "Sign in with Google" as an alternative |
| Forgot password / email reset | ⚠️ Partial | UI + API route exist; email delivery not wired up (needs email provider) |
| Auth library | ✅ Done | Auth.js v5 (NextAuth) with Drizzle adapter |

### 4.2 Recipe Management ✅

| Feature | Status | Detail |
|---------|--------|--------|
| Create recipe | ✅ Done | Manual entry form: title, description, ingredients (with amounts/units), instructions (step-by-step), tags, image upload, source URL, source name, prep time, cook time, servings |
| Edit recipe | ✅ Done | Full editing of all fields |
| Delete recipe | ✅ Done | Soft confirmation; no soft-delete at MVP |
| Tags | ✅ Done | Free-form text tags; `text[]` Postgres array with GIN index |
| Recipe detail page | ✅ Done | Clean reading view optimized for use while cooking |
| Recipe list / search | ✅ Done | Search by title, filter by tags; your full recipe collection |
| Public / private toggle | ✅ Done | Per-recipe: private (default) or public |
| Image upload | ✅ Done | Upload a photo; stored on Cloudflare R2; displayed on recipe card and detail |

**Out of MVP scope**: Nutritional info, ingredient shopping lists, collections/lists, recipe versions/forks.  
**Implemented beyond MVP scope**: Recipe scaling UI (originally V3+).

### 4.3 Recipe Import ✅

| Feature | Status | Detail |
|---------|--------|--------|
| URL import | ✅ Done | Paste a URL; app fetches and parses via Schema.org JSON-LD; user reviews/edits before saving |
| Import review step | ✅ Done | Parsed fields shown in an editable form before saving — never auto-save |
| Failed import fallback | ✅ Done | Shows "couldn't parse" state with whatever fields were recovered; allows manual entry |
| Import audit trail | ✅ Done | Every import stores source URL, import type, and raw payload (jsonb) in `recipe_imports` |
| Bookmarklet | ✅ Done | `/api/import/bookmarklet` + `lib/bookmarklet.ts` (originally V2 scope) |

**Out of MVP scope**: Paprika import (V1.5), browser extension (V2), JSON/Markdown bulk import (V1.5), AI OCR (V2).

### 4.4 Cooking Log ✅

| Feature | Status | Detail |
|---------|--------|--------|
| "I cooked this" button | ✅ Done | One-tap logging on any recipe via `CookLogDialog`; records today's date |
| Custom date | ✅ Done | Date picker in dialog for retroactive logging |
| One-line cook note | ✅ Done | 500-char text field: "How did it go? Any changes?" |
| Cook count display | ✅ Done | "Made X times" shown on recipe cards and detail pages |
| Cook history list | ✅ Done | Chronological list of all cook-log entries with dates and notes on recipe detail |
| "Tried it" status | ✅ Done | Derived automatically from cook log count |

**Note**: There is no separate "tried it" flag. The cook log subsumes it: one cook log entry = tried it, zero = not yet.

### 4.5 "Want to Cook" Queue ✅

| Feature | Status | Detail |
|---------|--------|--------|
| Queue a recipe | ✅ Done | "Add to my queue" on any recipe; dedicated `want_to_cook` table |
| Queue view | ✅ Done | `/queue` page with `QueueView` component |
| Remove from queue | ✅ Done | Prompt to remove from queue when logging a cook via `CookLogDialog` |

**Rationale**: The queue creates the habit loop that brings users back weekly ("what am I cooking this week?"). It's also the #1 Goodreads-analogue feature.

### 4.6 Social Features ✅

| Feature | Status | Detail |
|---------|--------|--------|
| Public profiles | ✅ Done | `/u/[id]` with `ProfileView`; shows display name, avatar, bio, cook counts for public recipes |
| Follow / unfollow | ✅ Done | `/api/follows`; no approval required |
| Following feed | ✅ Done | `/feed` with `FeedView`; recent cook logs from followed users on public recipes |
| Shareable recipe link | ✅ Done | Public recipes accessible at `/recipes/[id]` without auth |
| Cook log visibility | ✅ Done | Cook logs on public recipes visible on public profiles and in follower feeds |
| User search | ✅ Done | `/search` + `/api/users/search` (added beyond original spec) |

**Out of MVP scope**: Notifications (push or in-app), likes, comments, recipe collections/playlists, "share with a specific person" (private sharing link), direct messaging.

**Cold-start design principle**: Every screen must be fully functional and valuable with zero followers. The social layer is additive, not foundational.

### 4.7 User Settings ✅

| Feature | Status | Detail |
|---------|--------|--------|
| Profile settings | ✅ Done | Name, avatar, bio via `SettingsView` + `PATCH /api/users/me` |
| Public / private profile toggle | ✅ Done | `is_public` field; private by default |
| Change password | ✅ Done | For email/password users; validates current password before updating |
| Connected accounts | ✅ Done | Shows Google OAuth connection status and password setup state |

### 4.8 Monetization

The core product is free with no artificial limits. Monetization is through a one-time purchase for AI features when they ship in V2 — no subscription required.

| Tier | Price | Features |
|------|-------|---------|
| **Free (forever)** | $0 | Unlimited recipes, URL import, cooking log, cook count, want-to-cook queue, public profile, follow/feed, data export |
| **AI Add-on** | ~$18 one-time (exact price TBD at V2 launch) | AI cookbook OCR, dish-to-recipe generation, AI nutritional info — all permanently unlocked |

**Rationale**: The core recipe management, social, and logging features are the growth engine — gating them hurts adoption and network effects. A recipe limit or import rate limit would specifically punish the power users (ex-Paprika users migrating their collections) who are the primary target audience.

AI features are genuinely optional and have a clear, tangible value: "photograph your cookbook and import it." A one-time ~$18 charge matches the mental model of someone who already paid once for Paprika. It avoids the subscription fatigue that makes people avoid new tools.

**Economics**: Railway + Postgres runs ~$15/month. Gemini 2.5 Flash costs roughly $0.001 per AI recipe import — even a power user running 200 AI imports/month costs $0.20 in API fees. The one-time model is fully sustainable at low scale, and the math holds until at least tens of thousands of users.

**Note**: If usage grows to a point where infrastructure costs materially increase, the options are: (a) introduce an optional "supporter" tier, (b) add a second one-time unlock for future feature sets, or (c) revisit subscription at that time with evidence. This is not a decision for MVP.

---

## 5. V1.5 — First Update Post-MVP

After MVP ships and initial feedback is gathered (target: 300+ MAU before starting V1.5):

- **Paprika import**: Parse Paprika's YAML/HTML export format; "migrate from Paprika in 60 seconds" as a marketing hook
- **Data export**: Export all recipes as JSON or PDF — critical trust feature post-Yummly
- **Private sharing link**: Generate a token-based share link for a private recipe (no account required to view)
- **"Adapted from" provenance field**: Optional field on each recipe to link to source (another Aleppo recipe, URL, or free text). Lays the data foundation for the V3 recipe genealogy feature.
- **JSON / CSV bulk import**: For power users migrating from other tools
- **Recipe collections / lists**: Curated lists of recipes with a title and description (e.g. "My weeknight staples", "Recipes for guests")
- **Cook note length increase**: Allow longer cook notes (full paragraph) for users who want to write detailed reflections

---

## 6. V2 — AI Features

Target: Start development after V1.5 ships, when AI features are the primary reason to upgrade to Pro.

### 6.1 AI Cookbook OCR (Photo → Recipe)

- User uploads a photo of a cookbook page
- App sends to Gemini 2.5 Flash with a structured prompt requesting JSON output matching the recipe schema
- User reviews all parsed fields in an editable form before saving
- Handles: single-page recipes, two-column layouts, handwritten recipe cards (partial support)
- Graceful degradation: if confidence is low, highlight uncertain fields for user correction
- Requires AI add-on purchase

### 6.2 AI Dish-to-Recipe (Photo → Generated Recipe)

- User uploads a photo of a finished dish
- App sends to Gemini 2.5 Flash to generate a plausible recipe
- **Prominently labeled as "AI-generated — not tested"** to maintain trust
- User reviews and edits before saving
- Useful for: replicating a restaurant dish, recreating something from memory
- Requires AI add-on purchase

### 6.3 AI Nutritional Info

- For any saved recipe, generate nutritional info from the ingredients list using Gemini 2.5 Flash
- Output: calories, protein, fat, carbohydrates, fiber per serving
- **Prominently labeled as "Estimated — not verified by a dietitian"**
- Stored per-recipe; can be regenerated if recipe is edited
- Requires AI add-on purchase

### 6.4 Browser Extension

- Chrome and Safari extensions for one-tap recipe saving from any page
- Invokes the URL import flow without leaving the tab
- Available to all users at no cost

---

## 7. V3+ — Future Features

These are validated opportunities identified during the brainstorm. Timing and scoping to be determined based on V1/V2 usage data.

| Feature | Description | Strategic Value |
|---------|-------------|-----------------|
| **Recipe fork / inheritance tree** | Every recipe is forkable; forks preserve a link to the original; visualize the "family tree" of recipe adaptations across users | Creates network effects; builds Aleppo's unique data moat; deeply human food provenance story |
| **"Cooking Wrapped"** | Annual summary: total cooks, most-cooked recipe, new cuisines, most active month — shareable card | Organic social sharing outside the app; builds brand awareness |
| **Meal planning** | Weekly planner: assign recipes to days, auto-generate grocery list | Increases daily active use; high LTV feature |
| **Grocery list generation** | From any recipe or weekly plan: generate a shopping list with quantities aggregated | Monetization through Instacart/grocery affiliate |
| **Recipe scaling** | Scale ingredients by number of servings | Common request; moderate effort |
| **Mobile app** | React Native or PWA with offline access | Addresses the legitimate critique that cooking from a phone browser is suboptimal |
| **Cooking challenges** | "Cook 5 new recipes this month" — opt-in, streak-based habit formation | Engagement; Strava-style community feature |
| **Seasonal suggestions** | Based on cook history: "You haven't made anything with squash lately — it's fall" | Makes Aleppo feel intelligent without requiring explicit AI interaction |
| **B2B: recipe creators / educators** | Tools for cookbook authors, cooking educators, food brands to publish and distribute recipes to followers | Alternative revenue stream; Year 3 opportunity |

---

## 8. Technical Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | Railway deploys automatically |
| Language | TypeScript (strict) | Required for solo maintainability |
| ORM | Drizzle ORM | Type-safe, SQL-close, excellent Postgres support, no Rust binary |
| Auth | Auth.js v5 (`next-auth@beta`) | Google OAuth + credentials provider, Drizzle adapter |
| Database | PostgreSQL 16 | Railway managed add-on |
| Styling | Tailwind CSS v4 | Fastest responsive UI path solo |
| Components | shadcn/ui | Copy-paste, fully owned, Tailwind-native |
| URL scraping | `@extractus/recipe-extractor` | Schema.org JSON-LD first; Playwright fallback for JS-heavy sites |
| Image storage | Cloudflare R2 | No egress fees; S3-compatible API |
| Image processing | `sharp` | Server-side resize before R2 upload |
| Forms | React Hook Form + Zod | Shared validation between client and API |
| AI (V2) | `@google/generative-ai` | Official Gemini SDK |
| Hosting | Railway (Hobby plan) | ~$10–15/month at MVP scale |
| Migrations | Drizzle Kit | Generates SQL migrations from schema |

**Explicitly excluded from MVP**: Redis, tRPC, job queues, Elasticsearch, React Native, any microservices.

---

## 9. Key Data Model (Overview)

### Core tables

- **`users`** — id, email, name, avatar_url, bio, is_public, password_hash (nullable for OAuth users)
- **`accounts`** — OAuth provider records (Auth.js pattern)
- **`recipes`** — id, user_id, title, description, source_url, source_name, image_url, ingredients (jsonb), instructions (jsonb), tags (text[]), is_public, notes, nutritional_info (jsonb, V2)
- **`cook_logs`** — id, recipe_id, user_id, cooked_on (date), notes (text), rating (nullable smallint)
- **`follows`** — follower_id, following_id (composite PK)
- **`recipe_imports`** — audit trail: import_type, source_url, raw_payload (jsonb), status, error_message

### Key design decisions

- **Ingredients**: Store both `raw` (original string) and parsed `{amount, unit, name, notes}` fields — never lose the original
- **Tags**: `text[]` Postgres array with GIN index — no junction table needed at this scale
- **Privacy**: `is_public` on both `users` and `recipes`; a cook log is visible in feeds only if both are public
- **No soft deletes** at MVP — simplifies queries; add if needed
- **`recipe_imports.raw_payload`**: Always store what was scraped — essential for debugging bad imports

---

## 10. Success Metrics

### MVP Launch (Month 0–3)
- [ ] 100 registered users
- [ ] Average of 8+ recipes saved per active user (signals recipe library is being built)
- [ ] 30% of registered users have at least one cook log entry (signals the diary behavior is activating)
- [ ] Import success rate > 80% (URL scraper quality)
- [ ] <5 user-reported critical bugs per week

### Growth (Month 3–9)
- [ ] 500 monthly active users
- [ ] Social feed engagement: 20%+ of users follow at least one other user
- [ ] Recipe import: 3+ recipes added per user per week in the first month (migration success)

### Sustainability (Month 9–18)
- [ ] V2 AI features launched
- [ ] 150+ one-time AI add-on purchases (covers Railway + API costs at this scale)
- [ ] Net Promoter Score > 40 among active users
- [ ] AI features used by > 25% of users who purchased the add-on within 30 days of purchase

---

## 11. Open Questions

Pre-launch items still outstanding:

1. **App name trademark / domain** — Is "aleppo.app" or a similar domain available? "Aleppo" is primarily known as a city; does that create confusion or sensitivity?
2. **Email provider for password reset** — UI and API route are implemented; need to wire up an email provider (Resend, Postmark, or similar) to actually send reset emails
3. **NYT Cooking and paywalled sites** — Confirm the UX for sites we can't scrape (error messaging is in place; verify it's clear enough)
4. **Paprika import format specifics** — Verify Paprika's current export format (YAML/HTML); validate the import script approach before V1.5

*Resolved during implementation*:
- ~~Google OAuth credentials~~ — Set up and working
- ~~Cloudflare R2 setup~~ — R2 bucket configured and tested

---

## 12. Out of Scope (Explicitly)

The following were considered and explicitly deferred or rejected:

| Feature | Decision | Reason |
|---------|----------|--------|
| Native mobile app | V3+ | Web-first proves the model first; native is expensive to maintain solo |
| In-app notifications | V1.5+ | Adds significant infrastructure (push tokens, email service) before users exist |
| Recipe ratings / stars | Never (replaced by cook count) | Cook count is a better signal; ratings without context are noise |
| "Dish-to-recipe" as free feature | Pro-only | Gemini API cost, and the feature's speculative nature warrants gating |
| Advertising | Never | Undermines "respectful, clean" positioning; target users will pay to avoid ads |
| Open-source / self-hosting | Not planned | Different product; serves a different audience (technical self-hosters, well-served by Mealie/Tandoor) |
