# Team Brainstorm: Aleppo Recipe App

**Date**: 2026-02-27  
**Method**: Agent Team (adversarial multi-perspective)  
**Status**: Ready for Planning  
**Team Size**: 5 teammates (Devil's Advocate, Optimist, Creative Explorer, Researcher, Technical Architect)

---

## Executive Summary

Aleppo is a web-first recipe management app that transforms a static recipe box into a living cooking diary. By combining robust recipe organization with a cooking log, cook-count social proof, and a friend-activity feed, it occupies a genuine gap between personal vaults (Paprika, Mela) and noisy social platforms (Yummly, Cookpad). The MVP deliberately excludes AI features to ship fast and validate the core thesis — that people want to track what they've actually cooked, not just what they've saved — before layering on differentiating AI capabilities in V2.

---

## Idea Evolution

### Original Concept
A recipe management web app ("like Paprika but better") with AI OCR from cookbook photos, dish-to-recipe generation, AI nutritional info, cooking history, social sharing/follows, and web access.

### Refined Understanding
After team analysis, the concept sharpened considerably: the **cooking log + cook-count visibility** is the core differentiator — not the AI features (which belong in V2). Web-first is a genuine competitive advantage, not a compromise. Social features should be in MVP but scoped to the minimum viable social graph. AI features are the V2 upgrade moment, not the V1 hook.

### Key Clarifications
- Platform: Web app (Next.js, responsive) only for MVP
- AI deferred: All AI features move to V2; MVP is intentionally non-AI
- Audience: Paprika power users who want web access + social cooking history
- Monetization: Freemium ($6/mo or $48/yr Aleppo Pro) — decided before launch, not deferred
- Stack: Next.js 15 + TypeScript + Drizzle ORM + Auth.js v5 + PostgreSQL + Cloudflare R2 + Railway

---

## Team Debate Summary

### Points of Agreement

- The cooking log + cook-count visibility is the most defensible differentiator with no direct competition
- Web-first is the right platform choice (Paprika's #1 complaint is no web access)
- URL scraping via `@extractus/recipe-extractor` (Schema.org JSON-LD parsing) is the right approach with a Playwright fallback
- Auth.js v5 is the right auth library (not Clerk, not Lucia)
- Drizzle ORM is the right ORM for this stack in 2026
- Cloudflare R2 is the right image storage choice (no egress fees)
- Gemini 2.5 Flash makes the V2 AI features cheap and technically straightforward
- Freemium at $6/month is the right price point and must be decided before launch
- The ingredient data model should store both `raw` (string) and parsed fields from day one

### Points of Contention

| Topic | Devil's Advocate | Optimist | Resolution |
|-------|-----------------|----------|------------|
| Social features in MVP | Cut entirely — cold-start kills value before users exist | Keep — it's the primary differentiator from Paprika | **Keep, but minimal**: public profiles + follow + feed, no notifications/comments/likes |
| "Tried it" flag | Redundant if cooking log exists | Nice signal even without a date | **Eliminate** — the cook log (with date) is strictly better |
| Social cold-start problem | Fatal if social is the primary value prop | Manageable — core product works without social graph | **Design for no-followers state**: the cooking diary is fully valuable with zero followers |
| MVP scope | Current MVP is actually V1.0 — too big | Scope is appropriate given the competition | **Trim**: cut Markdown import, notifications, JSON import initially |
| Undefined audience | Fatal — it's three different products | TBD is fine | **Decide**: Paprika refugees + serious home cooks; not a social cooking platform |
| Monetization timing | Decide before launch — it's existential | Freemium + pro is the right model | **Agreed**: freemium with paid tier gates AI features and unlimited recipes |

### Debate Highlights

**The "tried it" flag elimination**: The Creative Explorer observed that "Made 1×" vs "Made 12×" contains all the information the "tried it" flag provides — and more. The Devil's Advocate agreed this removes redundancy. The Optimist concurred since it simplifies the UI. Resolution: unanimous cut.

**Social in MVP**: The Devil's Advocate made the strongest case for cutting social ("social is a push feature, not a pull feature — people use social after they love the core product, not because of it"). The Creative Explorer countered that the cooking log itself is the social content — without a way to share it, the log feature is half-built. Resolution: keep social but reduce to minimum viable: public profiles + follow + feed. No notifications, no comments, no likes.

**Framing debate**: The Creative Explorer proposed repositioning from "recipe app" to "cooking diary" — closer to Strava or Letterboxd than Paprika. The Optimist endorsed this. The Researcher confirmed Strava's model (personal activity log + social layer) as a validated analogue. Devil's Advocate had no objection. Resolution: "cooking diary" framing adopted for marketing/positioning; "recipe manager" framing for onboarding/import flow.

---

## Analysis Results

### Validated Strengths (survived adversarial scrutiny)

- **Cook count as social proof signal** — No existing recipe app surfaces how many times friends have cooked a recipe. This is a uniquely trustworthy quality signal. Survived the Devil's Advocate's scrutiny because it requires no network effects to provide value to individual users.
- **Web-first eliminates the #1 Paprika pain point** — Confirmed by Researcher via App Store reviews. The "no web access" and "per-platform pricing" complaints are the highest-frequency Paprika criticisms. A web app with free cross-device access is a direct competitive unlock.
- **Yummly's December 2024 shutdown created a migration moment** — 15M users lost their recipes with no warning. This creates urgency and validates the need for export/backup features and a trustworthy data stewardship story.
- **Cooking log as a retention asset** — A user with 3 years of cook history has something genuinely valuable and portable. This creates durable retention without dark-pattern lock-in.
- **V2 AI OCR is technically validated and cheap** — Competitors (CookBook, ReciScan) already offer cookbook OCR. Gemini 2.5 Flash makes it cheap (fraction of a cent per photo). The feature is technically de-risked.

### Real Risks (not fully mitigated)

| Risk | Likelihood | Impact | Best Mitigation | Residual Concern |
|------|------------|--------|-----------------|------------------|
| URL scraper maintenance burden | H | M | Use `@extractus/recipe-extractor` (Schema.org-first), store `raw_payload` in DB, build excellent "fix bad import" UX | Ongoing maintenance at ~15% engineering time indefinitely |
| Social cold-start (empty feed at launch) | H | M | Design for the no-followers state — cooking diary is valuable without social graph; use "invite friend to see my cook log" as acquisition hook | Social features may not activate until >500 users with overlapping social graphs |
| Monetization timing | M | H | Decide freemium model before MVP launch, not after | Conversion rate at 90% non-paying is the SaaS baseline; must reach ~200 paid users to cover Railway + API costs |
| Paywalled recipe sites (NYT Cooking) | H | L | Show graceful "couldn't import — paste manually" fallback; document which sites work | Can't improve without either a browser extension or accepting the limitation |
| V2 Gemini OCR accuracy on complex cookbook layouts | M | M | Prototype early, show review UI before saving, never auto-save AI imports | Multi-column pages, decorative fonts, poor lighting all degrade accuracy |
| Railway pricing / reliability risk | L | M | Keep codebase portable (no Railway-specific APIs), use standard Postgres, export data easily | Not urgent but worth watching at scale |

### Creative Alternatives

| Alternative | Pros | Cons | Addresses Risk |
|-------------|------|------|---------------|
| "Cooking diary" framing (Strava model) | Stronger positioning, more defensible, explains social features naturally | Requires explaining why it's also a recipe manager | Cold-start — log is valuable solo |
| Recipe fork/inheritance tree | Unique moat, creates network effects, deeply human food provenance narrative | Complex to build, V2+ complexity | Social cold-start — forks create social links |
| "Want to cook" queue as primary home screen | Creates habit loop, drives return visits, generates natural weekly engagement | Displaces the recipe library as primary metaphor | Retention |
| Cook count as public leaderboard | "23 people in your network cooked this" is more powerful than any star rating | Requires a network to generate signal | Social cold-start |

### Gaps Identified

- [ ] **Paprika import specifically** — Paprika exports to YAML/HTML; a one-time import script could be a marketing hook ("migrate in 60 seconds"). Not in MVP scope but should be V1.5.
- [ ] **Browser extension for one-tap save** — The "share sheet" pattern on mobile is the holy grail for recipe saving friction. A browser extension (Chrome/Safari) could enable Pocket-style one-click save. High value, medium effort; plan for V2.
- [ ] **Export / data portability** — Post-Yummly, users are scared of data loss. An "export all my recipes as JSON/PDF" feature is both a trust signal and a competitive differentiator. Easy to implement; add to V1.5.
- [ ] **Annual "Cooking Wrapped"** — A Spotify-Wrapped-style annual summary (total dishes, most-cooked recipe, new cuisines tried) is shareable content that drives organic growth. V2 or V3.

### Premortem Findings

- **Failure mode: Founder burnout from scraper maintenance** → **Prevention**: Use Schema.org-first parsing (80% of sites), accept that 20% need manual cleanup, build excellent correction UX rather than trying to make scraping perfect
- **Failure mode: Social vacuum kills early retention** → **Prevention**: Design every screen to be valuable with zero followers; social is additive, not foundational
- **Failure mode: "Monetization is TBD" becomes perpetual** → **Prevention**: Launch with freemium model implemented; free tier limits (50 recipes) are part of MVP, not V2
- **Failure mode: V2 AI scope creep bleeds into MVP development** → **Prevention**: Hard feature freeze for MVP; V2 is not started until MVP has 300 MAU
- **Failure mode: Vague audience = unfocused product** → **Prevention**: Target audience is "Paprika users who want web access + cooking history + social"; all MVP feature decisions are tested against this persona

---

## Research Findings

### External Evidence

- **Paprika App Store rating is 4.9/5** — vocal complaints exist but the base is satisfied; target the frustrated minority (web access, no social) not the happy majority
- **Yummly shut down December 2024** — 15M users lost recipes overnight; creates both a migration opportunity and urgency around data portability/export
- **Pepper (1M+ users)** and **Spillt ("Made it" feature)** prove that social cooking apps with cook-logs get engagement
- **Cookpad (50M users)** proves social cooking can scale; also proves monetization outside a core geographic market is very hard
- **`recipe-scrapers` (Python, 458 sites, MIT)** / **`@extractus/recipe-extractor` (npm)** provide a solid open-source foundation for URL import
- **Cloudflare R2** has no egress fees vs S3's $0.09/GB — critical for a media-heavy app
- **CookBook and ReciScan** already offer AI cookbook OCR; validates demand, de-risks the V2 feature technically
- **Recipe app market**: $1.8B (2024) → projected $4.2B (2034); 8.9% CAGR
- **Freemium conversion baseline**: ~90% of freemium users never convert (RevenueCat 2024); plan for this

### Anti-Patterns to Avoid

- **Storing third-party image URLs** — they rot; always re-upload to R2 on import
- **Auto-saving AI-generated content** — always show a review/edit step before saving
- **Undefined privacy model** — default private; public requires explicit opt-in from both user profile AND individual recipe
- **Deferred monetization** — leads to projects going dark and users losing data (Yummly, Pepperplate)
- **Ratings/stars on recipes** — meaningless without context; replace with cook-count
- **Building social notifications before you have users** — premature infrastructure

---

## Technical Assessment

- **Feasibility**: Moderate — well within solo developer scope
- **Key Dependencies**: Auth.js v5 (Google OAuth + credentials), `@extractus/recipe-extractor` (URL scraping), Cloudflare R2 (image storage), Railway managed Postgres
- **Proposed Stack**: Next.js 15, TypeScript, Drizzle ORM, Auth.js v5, PostgreSQL 16, Tailwind CSS v4, shadcn/ui, Cloudflare R2, Railway
- **Hardest Problems**: (1) URL scraper ongoing maintenance — mitigated by Schema.org-first parsing and excellent correction UX; (2) Ingredient data model — store both `raw` string and parsed fields; (3) Social feed privacy model — default private, explicit opt-in, hard privacy boundaries
- **Railway cost at MVP**: ~$10–15/month (Hobby plan + Postgres add-on)
- **V2 AI cost**: Fraction of a cent per Gemini 2.5 Flash call; negligible at early scale

---

## Recommended Next Steps

1. Write a clean PRD (see `docs/PRD.md`) based on this analysis — defines MVP scope formally
2. Set up the Next.js + Railway + Postgres project skeleton with Auth.js v5
3. Build recipe CRUD + URL import first (the foundation everything else rests on)
4. Add cooking log + cook count before adding social features
5. Launch private beta with friends/family to stress-test social features before public launch
6. Decide freemium pricing tier before launch (implement it, not just plan it)

---

## Ready for Create-Plan

**Yes** — well-defined and adversarially tested. Audience, stack, MVP scope, monetization model, and the key product thesis are all resolved. Ready for implementation planning.

### Suggested Plan Scope
Implementation plan should focus on: (1) project setup and data model, (2) auth + recipe CRUD, (3) URL import, (4) cooking log + cook count, (5) public profiles + basic social feed. In that order.
