# Aleppo — Product Requirements Document

**Version**: 2.0  
**Date**: 2026-03-05  
**Status**: V1.1 in active use — Pre-launch and V2 in planning

---

## Implementation Status at a Glance

| Area | Status | Notes |
|------|--------|-------|
| Auth (email/pw) | ✅ Complete | |
| Google OAuth | ⚠️ Pre-launch | Auth.js provider code exists; UI removed pending credentials setup |
| Recipe CRUD + tags + image upload | ✅ Complete | |
| URL import + review + audit trail + bookmarklet | ✅ Complete | |
| Cooking log (date, note, count, history) | ✅ Complete | |
| Want-to-cook queue | ✅ Complete | |
| Social (profiles, follow, feed, search) | ✅ Complete | |
| User settings | ✅ Complete | |
| Recipe scaling | ✅ Complete | Shipped early (originally V3+) |
| Recipe attribution (from / adapted from) | ✅ Complete | `isAdapted` + `commentsUrl` detection |
| Forgot password email | ⚠️ Pre-launch | UI/API done; email delivery not wired up |
| Admin interface | ⚠️ Pre-launch | Needed before broad launch |
| "Follow me" invite link | ⚠️ Pre-launch | |
| Fork recipe from feed | ⚠️ Pre-launch | |
| Full-text recipe search (ingredients, description, instructions) | ⚠️ Pre-launch | Currently title + tags only |
| Data export | ⚠️ Pre-launch | Export full recipe collection in a portable format |
| AI features (photo import, text paste) | 🔲 V2 | |
| Native mobile apps (iOS/Android) | 🔲 V2 | |

---

## 1. Product Vision

> Aleppo is a cooking diary — a place to save, organize, and log the recipes you actually cook, and share that cooking life with people you care about.

Unlike Paprika and other recipe vaults, Aleppo treats cooking as something that *happens*, not just something you plan. Over time, your recipe collection becomes a living record of your cooking life: what you've made, how many times, what you changed, what your friends have been cooking too.

In V2, Aleppo adds a first-class way to digitize physical cookbooks and handwritten recipe cards using your phone's camera — bringing your entire existing recipe life into the app, not just the web-native part of it.

**Positioning**: Strava for cooking. Letterboxd for recipes.

**Platforms**: Web (primary, fully responsive); iOS and Android native apps in V2.

---

## 2. Target Audience

**Primary**: Serious home cooks who currently use Paprika or a similar tool and are frustrated by:
- No web access (Paprika is mobile-only; desktop requires a separate $29.99 purchase)
- No way to see what friends are cooking
- No cooking history beyond a single "last made" date

**Secondary (V2+)**: Home cooks who own physical cookbooks and recipe cards they love but can't easily digitize. This is a large latent market — the people who have three shelves of Ottolenghi and a tin of index cards from their grandmother.

**Not the target**: Casual recipe browsers (Pinterest, AllRecipes audience), professional chefs, people looking for recipe discovery or inspiration feeds.

---

## 3. Core Value Proposition

1. **Your recipes, everywhere** — web-first, fully responsive; one account works on every device; native mobile apps in V2
2. **Your cooking diary** — every time you cook something, log it; build a real history of your kitchen life
3. **Cook count as quality signal** — "I've made this 14 times" is more trustworthy than any star rating
4. **Cooking social, not recipe social** — follow friends to see what they've *actually cooked*, not what they've saved
5. **Frictionless import** — save from any food website in one step; migrate from Paprika in minutes
6. **Digitize your cookbook shelf** — photograph any cookbook page or handwritten recipe card and import it in seconds (V2)

---

## 4. Current State — V1.1

### 4.1 Authentication

| Feature | Status | Detail |
|---------|--------|--------|
| Email / password signup | ✅ Done | Users create an account with email + password |
| Google OAuth | ⚠️ Pre-launch | Auth.js provider code exists; UI removed pending Google OAuth credentials setup |
| Forgot password / email reset | ⚠️ Partial | UI + API route exist; email delivery not wired up (needs email provider) |
| Auth library | ✅ Done | Auth.js v5 (NextAuth) with Drizzle adapter |

### 4.2 Recipe Management

| Feature | Status | Detail |
|---------|--------|--------|
| Create recipe | ✅ Done | Manual entry: title, description, ingredients (amount/unit/name/notes), instructions, tags, image, source URL/name, prep/cook time, servings |
| Edit recipe | ✅ Done | Full editing of all fields; public/private toggle saves immediately |
| Delete recipe | ✅ Done | Confirmation dialog from edit page |
| Tags | ✅ Done | Free-form text tags; `text[]` Postgres array with GIN index |
| Recipe detail page | ✅ Done | Clean reading view optimized for use while cooking |
| Recipe list / search | ⚠️ Pre-launch | Currently: search by title, filter by tags. Pre-launch: expand to full-text search across ingredients, description, and instructions (see §5.6) |
| Public / private toggle | ✅ Done | Per-recipe: private (default) or public |
| Image upload | ✅ Done | Stored on Cloudflare R2; displayed on cards and detail pages |
| Recipe scaling | ⚠️ Replacing | Current custom logic to be replaced with `scale-chef` library |

### 4.3 Recipe Import

| Feature | Status | Detail |
|---------|--------|--------|
| URL import | ✅ Done | Paste a URL; parsed via Schema.org JSON-LD; user reviews/edits before saving |
| Import review step | ✅ Done | Parsed fields in editable form — never auto-save |
| Failed import fallback | ✅ Done | Shows recovered fields; allows manual completion |
| Import audit trail | ✅ Done | Every import stores source URL, import type, raw payload (jsonb) in `recipe_imports` |
| Bookmarklet | ✅ Done | `/api/import/bookmarklet` for one-click saves from any browser |
| Comments URL detection | ✅ Done | Auto-detects link to source page's comments section on import; editable in review step |

### 4.4 Cooking Log

| Feature | Status | Detail |
|---------|--------|--------|
| "I cooked this" button | ✅ Done | One-tap logging via `CookLogDialog`; records today's date |
| Custom date | ✅ Done | Date picker for retroactive logging |
| Cook note | ✅ Done | 500-char text field: "How did it go? Any changes?" |
| Cook count display | ✅ Done | "Made X times" on recipe cards and detail pages |
| Cook history list | ✅ Done | Chronological list of all entries with dates and notes |

### 4.5 Want-to-Cook Queue

| Feature | Status | Detail |
|---------|--------|--------|
| Queue a recipe | ✅ Done | "Add to my queue" on any recipe; dedicated `want_to_cook` table |
| Queue view | ✅ Done | `/queue` page |
| Remove from queue | ✅ Done | Prompted when logging a cook |

### 4.6 Social Features

| Feature | Status | Detail |
|---------|--------|--------|
| Public profiles | ✅ Done | `/u/[id]` with display name, avatar, bio, cook counts for public recipes |
| Follow / unfollow | ✅ Done | No approval required |
| Following feed | ✅ Done | Recent cook logs from followed users on public recipes; shows attribution ("from / adapted from [source]") |
| Shareable recipe link | ✅ Done | Public recipes accessible without auth at `/recipes/[id]` |
| User search | ✅ Done | `/search` + `/api/users/search` |

### 4.7 Recipe Attribution

| Feature | Status | Detail |
|---------|--------|--------|
| `isAdapted` flag | ✅ Done | Auto-set when title, description, ingredients, or instructions are edited; manually clearable |
| `commentsUrl` | ✅ Done | Auto-detected on import (DOM scan + `config/comment-anchors.json`); editable in review step |
| Feed display | ✅ Done | Feed and recipe detail both show "from / adapted from [source]" with link |

### 4.8 User Settings

| Feature | Status | Detail |
|---------|--------|--------|
| Profile settings | ✅ Done | Name, avatar, bio |
| Public / private profile toggle | ✅ Done | Public by default |
| Change password | ✅ Done | Validates current password before updating |

---

## 5. Pre-Launch Requirements

These features must ship before a broad public launch.

### 5.1 Google OAuth

Re-enable the Auth.js Google provider and its UI. The provider code already exists in the codebase; it was removed from the UI pending Google Cloud Console credentials setup. Requires: Google Cloud Console project, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 5.2 Email Provider for Password Reset

Wire up an email delivery service (Resend or Postmark) to the existing forgot-password UI and API route. The UI and API are complete; only the actual send call is missing.

### 5.3 Admin Interface

An internal-only admin dashboard (access gated to admin users). Required before launch to:
- View and manage registered users (email, join date, recipe count, AI usage)
- Set a user's AI tier or grant a tier override (for testing and beta access)
- Suspend / unsuspend accounts
- View per-user image storage consumption
- Receive and process DMCA takedown requests: view flagged content, remove recipes, log resolution, notify the reporting party

### 5.4 "Follow Me on Aleppo" Invite Link

A user can generate a signed invite URL (e.g. `/join?ref=<token>`) from their profile or settings page. When a new user signs up via that link, they are automatically prompted to follow the inviter and the inviter is prompted to follow them back. This is the primary organic growth mechanism.

### 5.5 Data Export

Users must be able to export their full recipe collection in a portable format before we launch publicly. This is a trust and retention feature — it signals that Aleppo is not a data trap, which is especially important given the well-known loss of Yummly and other recipe services.

Export should include: all recipes (title, description, ingredients, instructions, tags, source URL, source name, cook logs, images), exported as a structured JSON file. A human-readable format (PDF or printable HTML, one recipe per page) is a nice-to-have for the same release.

The specific export format(s) are an open question — see §17.

### 5.6 Fork Recipe from Feed

An "Add to my collection" button on any public recipe in the following feed. Creates a full editable copy in the viewer's account, linked back to the original. Original attribution is preserved and displayed. If the user later edits the recipe, `isAdapted` is set on their copy.

Copyright implications: see §10.

### 5.7 Richer Recipe Search

The current recipe search covers title and tags only. Before launch, expand full-text search to also cover:

- **Ingredients** — e.g. "find all my recipes that use tahini"
- **Description** — the intro text on a recipe
- **Instructions** — useful for technique-based searches like "broil" or "overnight"

Implementation: Postgres `tsvector` full-text search across the relevant columns, with a GIN index. This keeps the stack simple (no Elasticsearch) and is sufficient for personal-collection-scale data. The existing title + tag search is upgraded in place; the UI search box behaviour is unchanged from the user's perspective.

---

## 6. V2 — AI Features

V2 integrates photo-import capabilities being contributed from a collaborator's existing work, alongside new AI-powered import paths. All AI features use Gemini (see §14 for model details).

All AI features require an active paid tier or available free-tier trial credits (see §12). All AI flows follow the same principle as URL import: **never auto-save** — always show a review/edit step before persisting.

### 6.1 Photo → Recipe (OCR from Cookbook or Handwritten Card)

- User uploads a photo of a cookbook page or handwritten recipe card
- Sent to Gemini with a structured prompt requesting JSON output matching the recipe schema
- Handles: single-page recipes, two-column layouts, handwritten cards (partial support for difficult handwriting)
- Graceful degradation: uncertain fields are highlighted for user review and correction
- User reviews all parsed fields in the standard import review form before saving

### 6.2 Batch Photo Import

- User uploads multiple photos in a single session (e.g. a full cookbook session)
- Each photo is processed in sequence
- A progress indicator shows which photos have been processed, which are pending, and which failed
- User reviews and approves/edits each recipe individually before it is saved
- Useful for bulk digitization of a cookbook shelf or a collection of recipe cards

### 6.3 Photo of Food → Generated Recipe

- User uploads a photo of a finished dish
- Gemini generates a plausible recipe for the dish
- Prominently and persistently labeled **"AI-generated — not a tested recipe"** everywhere it appears (recipe card, detail page, feed)
- User reviews and edits before saving

### 6.4 Copy/Paste Recipe Text

- User pastes raw recipe text (from a blog post, email, notes app, or anywhere)
- Gemini parses the text into structured recipe fields (title, ingredients with amounts/units, instructions, etc.)
- User reviews/edits in the standard import review form before saving

---

## 7. V2 — Native Mobile Apps

iOS and Android apps built with **React Native** (Expo as the likely scaffolding layer). Ships alongside the V2 AI features.

- Shared API with the existing Next.js backend — no separate backend required
- Feature parity with web for all core flows
- **Camera access** enables the photo import features (§6.1–6.2) natively without needing to transfer photos to a computer first
- **Share sheet support** (both directions):
  - *Receive*: register as a share target so users can share a recipe URL from Safari, Chrome, or any app directly into Aleppo's import flow
  - *Send*: share a recipe out from Aleppo to Messages, Notes, or any other app
- Offline reading of saved recipes (cook detail view; no editing offline)

---

## 8. Social — Pre-Launch and V2 Additions

### 8.1 Fork Recipe from Feed (Pre-launch)

"Add to my collection" on any public recipe creates a linked copy in your account. The copy stores:
- A reference to the original recipe ID and the original owner
- The original `sourceUrl` and `sourceName`
- The original `isAdapted` state at time of fork

When you edit your copy, `isAdapted` is set on your version. The original is unaffected.

**Photo handling**: only copy the recipe's photo if it is user-uploaded (hosted on Aleppo's R2). If the photo originated from a web import, the fork is created without a photo and the user is prompted to add their own. See §10.2 for rationale.

### 8.2 "Follow Me on Aleppo" Invite Link (Pre-launch)

Any user can generate a shareable invite link from their settings or profile page. The link is a signed token (short expiry or single-use). After the new user completes signup, they are automatically presented with a "follow [inviter]?" prompt. The inviter receives a notification (or a banner next time they open the app) suggesting they follow back.

---

## 9. Monetization

The core product — recipes, URL import, cook log, queue, social, data export — is free with no limits. Monetization is through AI feature access only.

Tier limits and prices are **not hardcoded in the application**. They are read at runtime from `config/ai-tiers.json`, so they can be adjusted without a code deploy.

### Tiers

| Tier | Price | AI Access |
|------|-------|-----------|
| **Free** | $0 | 10 AI imports per month — covers casual use for most users. |
| **Lifetime** | ~$15 one-time | 500 AI imports per month — covers even heavy cookbook-digitization use; cap exists to deter abuse rather than to generate additional revenue. |

### Config File Shape (illustrative — actual values TBD)

```json
{
  "free": {
    "limit": 10,
    "period": "month"
  },
  "lifetime": {
    "price_usd": 15,
    "billing": "one_time",
    "limit": 500,
    "period": "month"
  }
}
```

### Notes

- Admin can override any user's tier directly (for beta access, gifts, testing)
- All AI usage is logged per user for rate-limit enforcement and cost accounting
- Payment processor: Stripe (TBD; not needed until V2 ships) — one-time product only, no subscriptions
- **Economics**: Gemini Flash costs roughly $0.001 per AI recipe import. At 10,000 MAU all hitting the free limit, that's ~$100/month in AI costs — absorbable at early scale. A lifetime user maxing out at 500/month costs $0.50/month in API fees; the $15 one-time fee covers roughly 2.5 years of that worst-case usage.

---

## 10. Copyright & Legal

Aleppo's approach to copyright is guided by two principles:
1. Aleppo is a **personal recipe manager**, not a recipe republication platform
2. We should actively send traffic back to original sources, not substitute for them

### 10.1 Policies

**DMCA takedown process**  
The admin interface supports receiving, reviewing, and acting on DMCA takedown requests. A designated contact email is published in the app's legal/footer. When a request comes in: the admin can flag and remove the relevant recipe, log the resolution, and notify the reporting party. Standard DMCA safe harbor notice language is included in the ToS and footer.

**Photo display policy**  
Photos scraped or downloaded from import sources (URL import, future Paprika import, etc.) are **never displayed in public feeds or on public profiles**. They are shown only to the recipe's owner in their private recipe view. For a recipe to show a photo publicly, the user must upload their own.

**Fork photo policy**  
When forking a recipe, Aleppo copies the recipe's photo only if it is hosted on Aleppo's own R2 storage (meaning a user uploaded it). If the photo's origin is a web import, the fork is created without a photo. The forking user is prompted to add their own photo. This prevents third-party-owned images (e.g. NYT Cooking photography) from propagating through the social graph.

**Source encouragement in the feed**  
When a recipe has not been edited by the user (`isAdapted = false`), cook log cards in the feed prominently display a "View original recipe →" link to the source URL. The goal is to drive traffic to the original publisher, not to make Aleppo a substitute. When `isAdapted = true`, attribution is shown ("adapted from [source]") with the same link.

**Fork copyright caveat**  
When a user forks a recipe that has a URL import origin, a confirmation dialog is shown. See §10.2 for the UI detail.

**Terms of Service language**  
The ToS (to be drafted before launch) must include:
- The user is responsible for all content they save to Aleppo
- Aleppo is a personal recipe manager; users may not use it to republish or redistribute third-party content
- Aleppo cooperates with DMCA takedown requests in good faith

### 10.2 Copyright Info-Boxes (Contextual UI)

Info-boxes are non-blocking, dismissible callouts that surface copyright context at the moment it is relevant. They are friendly and informative, not alarming — the goal is to keep users oriented, not to make them feel like they are doing something wrong.

**URL import review step**  
Shown once per user (dismissed state persisted in user preferences):

> "Aleppo saves recipes for your personal use. Imported recipes stay private by default — if you make one public, your followers see your cook logs and a link to the original, not the full recipe text."

**Making an imported recipe public** (private → public toggle, when `isAdapted = false`)  
Shown inline when the toggle is flipped:

> "This recipe was imported from [source name]. When you make it public, your followers will see your cook logs and a link to the original — not the full recipe. That's by design."

**Batch photo import (cookbook OCR)**  
Shown once per user at the start of their first batch import session:

> "Digitizing your cookbooks is for personal use. Recipes you photograph stay private by default. If you share them publicly, please credit the source."

**Fork recipe from feed**  
Shown in the fork confirmation dialog when the source recipe has a URL import origin. The user must tap "Got it" to proceed. This acknowledgement is stored once per user (not once per fork — we trust users after the first acknowledgement):

> "This recipe was originally imported from [source name]. Your copy is for personal use — if you make it public, please credit the original."

**Copy/paste text import (AI)**  
Shown once per user:

> "Pasting a recipe from another site? That's fine for personal use. If you make it public on Aleppo, add the source so others can find the original."

---

## 11. Content Moderation & Abuse Prevention

### 11.1 Image Scanning

All user-uploaded images — avatars, recipe photos, and photos uploaded for AI import — pass through an NSFW classifier before being stored to R2. Rejected images surface a clear user-facing error. The classifier choice is TBD (Google Cloud Vision SafeSearch is the leading candidate).

Images submitted for AI processing (cookbook OCR, dish-to-recipe) are scanned before being sent to Gemini.

### 11.2 Storage Abuse Prevention

- Per-user image storage cap, configurable in a server-side config (not hardcoded)
- Rate limit on image uploads per user per hour
- Admin dashboard shows per-user storage consumption; admin can intervene for outliers

### 11.3 Spam Prevention

- Rate limit on recipe creation and imports per day per account
- Rate limit on follow actions per hour (to prevent follow-spam)
- Admin can suspend accounts; suspended users cannot log in or create content

### 11.4 AI Feature Abuse

- All AI calls are subject to per-tier rate limits enforced at the API layer (see §9)
- All AI usage is logged to `ai_usage_log` per user with feature type and timestamp
- Admin can view per-user AI usage history

---

## 12. Admin Interface

The admin interface is an internal-only dashboard, accessible only to admin users. It does not need to be beautiful — it needs to be functional and reliable.

**Current implementation**: a single email address is hardcoded as the admin. This needs to be replaced with a proper `is_admin` flag on the `users` table (or an `admin` role) so that multiple people can have admin access. This change is required before adding a collaborator to the project.

Required capabilities at launch:

- **User management**: view all registered users (email, join date, recipe count, AI usage totals); search by email or name
- **Tier management**: view a user's current AI tier; set a tier override (for testing, gifting, beta access); override persists until manually cleared
- **Account actions**: suspend / unsuspend accounts; view suspension history
- **Storage**: view per-user image storage consumption; manually clear storage for a user if needed
- **DMCA queue**: incoming takedown requests (via contact form or email); mark as under review / resolved; record which content was removed and when

---

## 13. Technical Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | Railway deploys automatically |
| Language | TypeScript (strict) | |
| ORM | Drizzle ORM + Drizzle Kit migrations | Type-safe, SQL-close, excellent Postgres support |
| Auth | Auth.js v5 (`next-auth@beta`) | Credentials + Google OAuth (OAuth UI pending credentials) |
| Database | PostgreSQL 16 | Railway managed add-on |
| Styling | Tailwind CSS v4 + shadcn/ui | |
| URL scraping | `@extractus/recipe-extractor` | Schema.org JSON-LD first; Playwright fallback for JS-heavy sites |
| Image storage | Cloudflare R2 | No egress fees; S3-compatible API |
| Image processing | `sharp` | Server-side resize before R2 upload |
| Forms | React Hook Form + Zod | Shared validation between client and API |
| Recipe scaling | `scale-chef` | Replacing current custom scaling logic |
| AI | `@google/generative-ai` | Gemini SDK; model is a config constant — currently `gemini-2.5-flash-preview`, upgrade path to `gemini-3-flash-preview` is a one-line change |
| Image moderation | TBD | Google Cloud Vision SafeSearch or similar |
| Payments | Stripe | V2; not needed until AI tiers ship |
| Hosting | Railway (Hobby plan) | ~$10–15/month at current scale |
| Mobile (V2) | React Native (Expo) | Shared API with Next.js backend |

**Explicitly excluded until there is a reason to add them**: Redis, tRPC, job queues, Elasticsearch, any microservices.

---

## 14. Data Model

### Existing tables (unchanged)

- **`users`** — id, email, name, avatar_url, bio, is_public (default true), password_hash (nullable for OAuth users)
- **`accounts`** — OAuth provider records (Auth.js pattern)
- **`recipes`** — id, user_id, title, description, source_url, source_name, image_url, image_origin (`user_upload | web_import`), ingredients (jsonb), instructions (jsonb), tags (text[]), is_public (default false), is_adapted (bool), comments_url (text)
- **`cook_logs`** — id, recipe_id, user_id, cooked_on (date), notes (text)
- **`follows`** — follower_id, following_id (composite PK)
- **`recipe_imports`** — audit trail: import_type, source_url, raw_payload (jsonb), status, error_message
- **`want_to_cook`** — user_id, recipe_id

### New fields and tables for V2

- **`users`** additions:
  - `is_admin` boolean, default `false` — replaces the current single hardcoded admin email; allows multiple admins
  - `ai_tier` enum (`free | starter | pro`), default `free`
  - `ai_tier_override` (set by admin; nullable; takes precedence over `ai_tier`)
  - `storage_bytes_used` bigint
  - `copyright_ack` jsonb — tracks which one-time copyright info-box acknowledgements have been dismissed (keyed by info-box ID)

- **`recipes`** additions:
  - `image_origin` enum (`user_upload | web_import`) — used to enforce fork photo policy and public feed photo policy

- **`ai_usage_log`** (new) — user_id, feature_type (`ocr | dish_to_recipe | text_paste`), created_at; used for tier rate-limit enforcement and cost accounting

- **`recipe_forks`** (new) — original_recipe_id, forked_recipe_id, forked_by_user_id, forked_at; tracks fork lineage for attribution display and future fork-tree features

- **`dmca_requests`** (new) — id, reporter_email, reporter_name, recipe_id (nullable), description, status (`pending | reviewing | resolved | dismissed`), created_at, resolved_at, resolution_notes

### Key design decisions (unchanged)

- **Ingredients**: store both `raw` (original string) and parsed `{amount, unit, name, notes}` — never discard the original
- **Privacy**: `is_public` on both `users` and `recipes`; a cook log appears in feeds only if both are public
- **No soft deletes** at this stage — simplifies queries

---

## 15. Success Metrics

### Pre-Launch (Month 0–3)
- 100 registered users
- Average 8+ recipes saved per active user
- 30% of registered users have at least one cook log entry
- Import success rate > 80%
- < 5 user-reported critical bugs per week

### Growth (Month 3–9)
- 500 monthly active users
- 20%+ of users follow at least one other user
- 3+ recipes added per user per week in their first month (migration success signal)

### V2 AI Launch
- AI free-to-paid conversion rate > 15%
- Photo import (OCR) success rate > 85% (correctly structured recipe output)
- Batch import used by > 20% of AI users within 30 days of V2 launch
- < 5% of AI-generated recipes reported as unusable by users

### V2 Mobile
- App Store / Play Store installs
- DAU split: mobile vs. web
- Share sheet usage (inbound URLs via share sheet as % of total imports on mobile)

---

## 16. Future / V3+

Items that are validated opportunities but not yet scheduled:

| Feature | Description |
|---------|-------------|
| **AI Nutritional Info** | For any saved recipe, generate estimated nutrition per serving from the ingredients list using Gemini. Labeled "Estimated — not verified by a dietitian". Stored per recipe; regeneratable on edit. Requires AI add-on. Deferred from V2 to reduce scope. |
| **Recipe fork / inheritance tree** | Visualize the "family tree" of recipe adaptations across users. `recipe_forks` table (added in V2 data model) is the foundation. |
| **"Cooking Wrapped"** | Annual summary: total cooks, most-cooked recipe, new cuisines, most active month — shareable card |
| **Meal planning** | Weekly planner: assign recipes to days; auto-generate grocery list |
| **Grocery list generation** | From any recipe or weekly plan; quantities aggregated |
| **Browser extension** | Chrome and Safari extensions for one-tap recipe saving from any page; invokes URL import without leaving the tab |
| **Paprika import** | Parse Paprika's YAML/HTML export format; "migrate from Paprika in 60 seconds" |
| **Private sharing link** | Token-based share link for a private recipe (no account required to view) |
| **Cooking challenges** | "Cook 5 new recipes this month" — opt-in, streak-based |
| **B2B: recipe creators** | Tools for cookbook authors, food brands, and educators to publish and distribute recipes |

---

## 17. Open Questions

1. **App name / domain** — "Aleppo" is primarily known as a city; does that create sensitivity or confusion? Is a clean `.app` or `.com` domain available?
2. **Email provider** — UI and API are implemented; choose between Resend and Postmark before launch
3. **Google OAuth credentials** — requires Google Cloud Console project setup
4. **Image moderation API** — Google Cloud Vision SafeSearch vs. alternatives (AWS Rekognition, etc.); cost and latency trade-offs to evaluate
5. **Payment processor** — Stripe is the obvious choice; confirm before V2 launch
6. **React Native: Expo vs. bare workflow** — Expo simplifies setup and OTA updates; bare gives more control; decide before V2 mobile work starts
7. **NYT Cooking and paywalled sites** — confirm error messaging is clear when the scraper cannot access a page
8. **AI model version** — currently planning `gemini-2.5-flash-preview`; evaluate `gemini-3-flash-preview` when available; keep as a single config constant
9. **Export format(s)** — JSON is the clear primary format (machine-readable, lossless, importable into other tools). A human-readable option (printable PDF or HTML) is desirable but scope TBD. Should cook log history be included? Should images be bundled (zip) or linked?
10. **Additional import formats** — What other recipe sources are worth supporting? Candidates: Paprika export (YAML/HTML — already mentioned in §16), Mealie/Tandoor JSON (open-source app users), AnyList, Copy Me That, Plan to Eat, Whisk, raw JSON/CSV. Which are high enough priority to warrant a dedicated parser vs. a generic "paste your JSON" fallback? Should we accept Aleppo's own export format for re-import (account migration)?
11. **Photo deduplication / canonicalization** — if many users import the same URL (e.g. today's NYT Cooking recipe), we should not store N identical copies of the same photo in R2. Options include: hashing image content on upload and pointing duplicates to a shared object, or detecting same-source-URL imports and reusing the existing stored image. Needs a design that handles the case where one user later deletes their recipe (the shared object must not be deleted).
12. **Trending / social discovery** — Aleppo accumulates aggregate cooking data that could surface interesting signals: recipes cooked by many users this week, ingredients that are suddenly popular, seasonal patterns. Consider a "trending this week" surface (feed section, dedicated page, or push notification). Could use AI (Gemini) to generate contextual copy — e.g. "12 Aleppo cooks made this butternut squash soup this week — it's that time of year." Details (placement, frequency, AI vs. rule-based) to be worked out; note here as a future opportunity that should be kept in mind when designing the data model and cook log API.
13. **Large collection UX** — as users migrate from Paprika or digitize cookbook shelves, collections of 500–1000+ recipes become realistic. Consider: a compact/list view without images, additional sort options (import date, last cooked, cook count, alphabetical), pagination vs. virtual scroll, and whether the current tag-filter model scales or needs something more powerful (e.g. multi-tag AND/OR filtering). Resolve before V2 ships, since batch photo import will accelerate collection growth.

---

## 18. Out of Scope

| Feature | Decision | Reason |
|---------|----------|--------|
| In-app notifications (push or email) | Deferred to V1.5+ | Adds significant infrastructure before users exist |
| Recipe ratings / stars | Not planned | Cook count is a better signal; ratings without context are noise |
| Advertising | Never | Undermines clean positioning; target users will pay to avoid ads |
| Open-source / self-hosting | Not planned | Different product; serves a different audience (well-served by Mealie/Tandoor) |
| Comments / likes on recipes | Deferred | Network effects needed first; build once there's a reason |
| Meal planning | V3+ | High effort; validate core loops first |
| Recipe collections / playlists | V1.5+ | Nice-to-have; not a growth driver |
