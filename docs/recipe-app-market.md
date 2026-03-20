# Recipe App Market Research

*Compiled March 2026*

## Market Overview

The recipe management app market splits into three tiers:

1. **Established clip-and-organize tools** (Paprika, Mela, AnyList) — personal recipe libraries with import, meal planning, grocery lists. Loyal user bases, minimal social features.
2. **Social/community platforms** (Cookpad, Allrecipes, Samsung Food) — discovery and sharing oriented, large user bases, ad-supported free tiers.
3. **Newer AI-focused entrants** (Pestle, Pluck, Honeydew, Recipe One) — competing on AI-powered import from social media videos (TikTok, Instagram Reels, YouTube). This is clearly the hot feature right now.

**The social-activity angle** (cook logging, following friends, activity feed — what Aleppo is building) **is notably underserved.** Most apps are either purely organizational or purely discovery-oriented, not social-activity-oriented. Cookpad comes closest with its "Cooksnaps" feature but lacks the Strava/Letterboxd feel.

---

## Detailed App Profiles

### Paprika Recipe Manager


|                     |                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | iOS, Android, macOS, Windows (broadest platform support)                                                                                                                            |
| **Social features** | None. Sharing limited to exporting `.paprikarecipes` files via email/AirDrop. Household sharing = same account on multiple devices.                                                 |
| **AI features**     | None. Traditional rule-based web scraping only.                                                                                                                                     |
| **Ads**             | None                                                                                                                                                                                |
| **Pricing**         | One-time purchase per platform: $4.99 (iOS/Android), $29.99 (Mac/Windows). Free tier limited to 50 recipes, no sync.                                                                |
| **Popularity**      | ~760K total downloads, ~11K/month. iOS: 4.86/5 from ~17K ratings. Around since 2010 — the most established personal recipe manager.                                                 |
| **Notable**         | Meal planning calendar, smart grocery lists (deduplication, aisle sorting), cook mode with timers, full offline support, built-in web browser for import. Occasional 50% off sales. |


### Mela


|                     |                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Apple only — iPhone, iPad, Mac. No Android, no Windows, no web.                                                                                                                                                            |
| **Social features** | Minimal. iCloud library sharing with other users on iOS 15+/macOS 12+. No community or discovery.                                                                                                                          |
| **AI features**     | On-device ML for importing from pages without structured data. OCR text scanner for photos of cookbooks. Video description extraction from YouTube, TikTok, Instagram (added v2.5). RSS feed subscriptions for food blogs. |
| **Ads**             | None                                                                                                                                                                                                                       |
| **Pricing**         | One-time: $4.99 (iOS), $9.99 (macOS). No subscription.                                                                                                                                                                     |
| **Popularity**      | iOS: 4.66/5 from ~521 ratings. Smaller user base but highly praised in Apple press (MacStories, Tools & Toys). Made by Silvio Rizzi (also known for the Reeder RSS app).                                                   |
| **Notable**         | iCloud sync (no account needed), grocery lists sync to Reminders.app, meal planning uses Calendar.app. Widely considered the best-designed recipe app on Apple platforms.                                                  |


### CopyMeThat


|                     |                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Platforms**       | Web, iOS, Android, Chrome extension                                                                                                                                                                                                              |
| **Social features** | The strongest social features among traditional recipe managers. Built-in Community for public sharing. Follow/be followed. Controllable visibility (private, circle, everyone). Browsable community recipe boxes. No commenting or feed though. |
| **AI features**     | None                                                                                                                                                                                                                                             |
| **Ads**             | Historically "no ads ever," but recent user reports of ads appearing. Unclear current state.                                                                                                                                                     |
| **Pricing**         | Free (up to 40 recipes, all features). Beyond 40: $1/month, yearly, or $65 lifetime. All features available at all tiers — paywall is purely recipe count.                                                                                       |
| **Popularity**      | Google Play: 4.38/5 from ~1.3K ratings. ~1.6K downloads/month. Smaller and less well-known.                                                                                                                                                      |
| **Notable**         | Chrome extension for one-click saving. Web-first approach. Most affordable option for unlimited use.                                                                                                                                             |


### Pestle


|                     |                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Apple only — iPhone, iPad, Mac, Apple Watch, Vision Pro, plus Chrome extension. No Android.                                                                                                                                |
| **Social features** | No feed or follow system. "Households" feature shares entire cookbook with family via invite link. Cook together via FaceTime integration.                                                                                 |
| **AI features**     | On-device AI extracts recipes from TikTok and Instagram Reels (~0.1 second processing). Deliberately avoids third-party AI for privacy. Also imports from websites, PDFs, scanned cards. No AI generation or modification. |
| **Ads**             | None                                                                                                                                                                                                                       |
| **Pricing**         | Free tier with core features. Pro: $2.99/month, $24.99/year, or $39.99 lifetime.                                                                                                                                           |
| **Popularity**      | Strong indie-app credibility (TechCrunch, 9to5Mac, MacStories coverage). Apple Design Award finalist. Built by solo developer Will Bishop.                                                                                 |
| **Notable**         | Hands-free cook mode with voice commands, multiple concurrent timers, 14-day meal planner, Apple Reminders integration, Smart Folders.                                                                                     |


### Pluck


|                     |                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Android only (iOS waitlist). No web.                                                                                                                                                                                                        |
| **Social features** | None                                                                                                                                                                                                                                        |
| **AI features**     | Core differentiator — five AI modes: video frame analysis, audio transcription, OCR on video overlays, caption parsing, handwriting recognition. Built-in AI cooking assistant for real-time Q&A (limited by tier: 100–300 messages/month). |
| **Ads**             | None ("no ads, no data selling, no tracking")                                                                                                                                                                                               |
| **Pricing**         | Free: 3 extractions/month, 10 saved recipes. Light: $2.99/mo (10 extractions). Plus: $6.99/mo (50 extractions, 100 AI messages). Pro: $11.99/mo (200 extractions, 300 AI messages). No lifetime option.                                     |
| **Popularity**      | Early-stage. No public download numbers or ratings found. Android-only limits reach significantly.                                                                                                                                          |
| **Notable**         | Most capable video-to-recipe extraction pipeline. Usage-based pricing (extraction credits) is unusual in this space and could feel limiting.                                                                                                |


### Recipe One


|                     |                                                                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | iOS, Android                                                                                                                                                                            |
| **Social features** | None                                                                                                                                                                                    |
| **AI features**     | AI-powered capture from social media videos, websites, photos, screenshots, handwritten cards, plain text. "Cook with Ingredients" feature suggests recipes from what you have on hand. |
| **Ads**             | None                                                                                                                                                                                    |
| **Pricing**         | One-time payment (no subscription) — marketed as key differentiator. Exact price not publicly listed. Free tier with limited storage.                                                   |
| **Popularity**      | Newer app (recent App Store listing). No download numbers found. Publishes heavy SEO content (comparison blog posts) to drive growth.                                                   |
| **Notable**         | Drag-and-drop meal planning, unit/temperature converters, distraction-free cooking view. One-time pricing is genuinely distinctive.                                                     |


### Samsung Food (formerly Whisk)


|                     |                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | iOS, Android, Web, Chrome extension                                                                                                                                                                                                                                                                  |
| **Social features** | Communities (public/private recipe groups), follow creators, comment on recipes, share via link/email/social. More community-board than follow-feed oriented.                                                                                                                                        |
| **AI features**     | Heavy. Recipe personalization ("make healthier," swap ingredients — paid). Vision AI for photo scanning (paid). AI meal planning. Smart appliance integration (send cook settings to Samsung ovens). Samsung fridges with AI Vision (Google Gemini) recognize fridge contents. Nutritional analysis. |
| **Ads**             | Free tier shows ads. Food+ subscription removes them.                                                                                                                                                                                                                                                |
| **Pricing**         | Free tier: recipe book, meal planner, shopping list, browsing. Food+: $6.99/month or $59.99/year (ad-free, AI features, cook mode, appliance control).                                                                                                                                               |
| **Popularity**      | 6M+ users. ~~29K monthly downloads. iOS: 4.8 stars. Google Play: 4.6 stars (~~21K ratings). Apple "App of the Week." Available in 104 countries, 8 languages, 160K+ recipes.                                                                                                                         |
| **Notable**         | Shoppable grocery lists linked to US retailers. Pantry management. Samsung Health integration. Deep SmartThings ecosystem integration. The most feature-rich commercial offering but heavily tied to Samsung hardware for full value.                                                                |


### Cookpad


|                     |                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | iOS, Android, Web                                                                                                                                                                                                                                 |
| **Social features** | The most social platform in this space — often called "Instagram for recipes." Follow cooks, recipe feed, Cooksnaps (photo proof of making someone's recipe), comments, direct messaging, discussion forums, public profiles.                     |
| **AI features**     | AI recipe assistant (chat-based recipe creation from conversational descriptions). "Moment" — multimodal AI cooking coach (text, vision, audio), launched in 5 countries. ML-powered search and recommendations.                                  |
| **Ads**             | Free tier shows ads. Premium removes them.                                                                                                                                                                                                        |
| **Pricing**         | Free (all core social features included). Premium: ~$2.99–5/month (varies by region). Adds ad-free, advanced search, priority results, 3K recipe saves, calorie info.                                                                             |
| **Popularity**      | 100M+ monthly users at peak — by far the largest. Founded 1997 in Japan, IPO 2009 (Tokyo Stock Exchange: 2193). 10M+ installs on Google Play India alone. iOS: ~4.4 stars. Massive in Japan, Southeast Asia, Latin America. Less prominent in US. |
| **Notable**         | Almost all recipes from home cooks (not publishers). Ingredient-based search. 70+ countries/languages. No meal planning or grocery features — purely social recipe sharing. Publicly traded but has faced monetization challenges outside Japan.  |


### Allrecipes


|                     |                                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Web only — native app discontinued March 2023                                                                                                                                                                                                                    |
| **Social features** | Ratings and detailed reviews (the core mechanic — many recipes have hundreds/thousands of reviews with modifications and tips). Threaded review discussions. "I Made It" button. Follow cooks. Pinterest-style collections.                                      |
| **AI features**     | None                                                                                                                                                                                                                                                             |
| **Ads**             | Heavily ad-supported — display, native, video, sponsored content. Primary revenue model. No ad-free tier exists. Users consistently complain about ad density.                                                                                                   |
| **Pricing**         | Entirely free (ad-supported). Allrecipes Magazine separately ~$18/year. Owned by Dotdash Meredith (now People Inc.).                                                                                                                                             |
| **Popularity**      | 60M+ community members, 40M+ active users across 100+ countries. 14M+ historical app downloads. One of the most-visited food sites for two decades.                                                                                                              |
| **Notable**         | Massive 25+ year recipe database is the moat. "Dinner Spinner" suggests recipes by type/ingredient/time. The review ecosystem is genuinely valuable. App killed in 2023 to consolidate to mobile web — notable cautionary tale about ad-supported app economics. |


### AnyList


|                     |                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | iOS, Android, Web, Apple Watch                                                                                                                                                                              |
| **Social features** | None beyond household. Real-time shared grocery lists with partner/roommates. Can share recipes with specific people. Not a social network.                                                                 |
| **AI features**     | Smart autocomplete and intelligent category sorting for groceries, but nothing marketed as AI.                                                                                                              |
| **Ads**             | None                                                                                                                                                                                                        |
| **Pricing**         | Free (basic lists, up to 5 saved web recipes). AnyList Complete: $9.99/year (individual) or $14.99/year (household) — unlocks meal planning, web app, photos, unlimited recipes.                            |
| **Popularity**      | iOS: 4.8 stars (200K+ ratings). "Trusted by millions." One of the most established grocery/meal-planning apps (since 2012).                                                                                 |
| **Notable**         | Alexa + Siri voice integration, browser extensions (Chrome/Safari/Firefox/Edge), location-based shopping reminders, price tracking. Extremely polished but grocery-list-centric rather than recipe-centric. |


### RecipeSage


|                     |                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | PWA (works on all platforms via browser). Self-hostable via Docker.                                                                                                                                                                                           |
| **Social features** | Friends system — add friends, view profiles, share individual recipes or entire label collections. Public or friends-only sharing. Collaborative meal plans and shopping lists. No traditional feed.                                                          |
| **AI features**     | AI cooking assistant (chat-based). OCR for handwritten recipe cards. Self-hosted version requires your own OpenAI API key.                                                                                                                                    |
| **Ads**             | None                                                                                                                                                                                                                                                          |
| **Pricing**         | Entirely free with voluntary contributions. Optional monthly or one-time donations unlock bonuses (high-res images, multiple images per recipe, unlimited AI messages). One-time contribution unlocks bonuses for one year. Self-hosting free under AGPL-3.0. |
| **Popularity**      | ~800–850 GitHub stars. ~100K users on hosted instance. Niche but well-regarded in self-hosting and data-ownership communities.                                                                                                                                |
| **Notable**         | The only app with genuine social features AND open-source self-hosting. RecipeClipper for URL import, fuzzy search with synonyms, multiple import/export formats. Developer/privacy-oriented audience.                                                        |


### Tandoor Recipes


|                     |                                                                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | Self-hosted only — PWA with offline caching. Docker, TrueNAS, etc. No hosted/cloud version.                                                                                                                                   |
| **Social features** | Multi-user with granular permissions (viewer/editor/admin) within shared "spaces." Comments and ratings on recipes. Designed for household/family collaboration. Share externally via links. No follow system or public feed. |
| **AI features**     | AI image recognition for identifying ingredients from photos (e.g., fridge contents). Automatic recipe step parsing. Nutrition data lookup from USDA databases. Requires OpenAI API key.                                      |
| **Ads**             | None                                                                                                                                                                                                                          |
| **Pricing**         | Completely free. Open source (GNU AGPL v3 with commons clause).                                                                                                                                                               |
| **Popularity**      | ~8,000 GitHub stars. Very popular in self-hosting community (frequently recommended on r/selfhosted). Active Discord.                                                                                                         |
| **Notable**         | Most feature-rich self-hosted option. Drag-and-drop meal planner, auto-categorized shopping lists, iCal export, multi-language, powerful tagging/search, cookbook collections.                                                |


### Honeydew


|                     |                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platforms**       | iOS, Android                                                                                                                                                                                                                                                                                               |
| **Social features** | None beyond household. Up to 6 family members can share meal plans and grocery lists on one subscription.                                                                                                                                                                                                  |
| **AI features**     | Core product differentiator. AI extraction from Instagram, TikTok, Pinterest, YouTube, any URL. AI meal planner (weekly plans). Smart ingredient substitutions. "Copycat recipe generator" (snap restaurant food, get home recipe). Auto calorie/macro calculation. 10 free AI imports/month on free tier. |
| **Ads**             | None ("no ads ever" is explicit marketing)                                                                                                                                                                                                                                                                 |
| **Pricing**         | Free: 10 AI imports/month, basic organization. Plus: $6.99/month or $39.99/year — unlimited imports, unlimited storage, family sharing (6 users), Instacart integration.                                                                                                                                   |
| **Popularity**      | ~~130K Google Play downloads (~~820/day). Launched Nov 2024. Mixed reviews — praised for social media import, some reports of bugs. Early-stage.                                                                                                                                                           |
| **Notable**         | Instacart integration for one-click grocery ordering. Duolingo-style gamification for cooking habits. Positioned as the "Gen Z recipe app." Strongest social-media-to-recipe pipeline alongside Pluck.                                                                                                     |


---

## Comparison Matrix


| App          | Social             | AI                              | Ads             | Pricing                  | Users        | Platforms              |
| ------------ | ------------------ | ------------------------------- | --------------- | ------------------------ | ------------ | ---------------------- |
| Paprika      | None               | None                            | No              | $5–30 one-time           | ~760K        | iOS, Android, Mac, Win |
| Mela         | Minimal            | ML import, OCR                  | No              | $5–10 one-time           | Small        | Apple only             |
| CopyMeThat   | Community + follow | None                            | Unclear         | $1/mo or $65 lifetime    | Small        | Web, iOS, Android      |
| Pestle       | Households         | On-device video AI              | No              | Free / $3–40             | Indie hit    | Apple only + Chrome    |
| Pluck        | None               | Heavy (5 AI modes)              | No              | $3–12/mo                 | Early stage  | Android only           |
| Recipe One   | None               | AI capture                      | No              | One-time (price unclear) | New          | iOS, Android           |
| Samsung Food | Communities        | Heavy (vision, personalization) | Yes (free tier) | Free / $7/mo             | 6M+          | iOS, Android, Web      |
| Cookpad      | Full social        | AI assistant, Moment coach      | Yes (free tier) | Free / $3–5/mo           | 100M+ peak   | iOS, Android, Web      |
| Allrecipes   | Reviews + follow   | None                            | Heavy           | Free (ad-only)           | 40M+ active  | Web only (app killed)  |
| AnyList      | Household          | Minimal                         | No              | Free / $10–15/yr         | Millions     | iOS, Android, Web      |
| RecipeSage   | Friends + sharing  | AI assistant, OCR               | No              | Free (donations)         | ~100K        | PWA, self-host         |
| Tandoor      | Multi-user spaces  | AI vision, parsing              | No              | Free (self-host)         | ~8K GH stars | Self-hosted PWA        |
| Honeydew     | Household          | Heavy (core product)            | No              | Free / $7/mo             | ~130K        | iOS, Android           |


## Key Takeaways for Aleppo

1. **The social-activity niche is wide open.** No app does "Strava for cooking" well. Cookpad has the most social features but is discovery-oriented, not activity-logging oriented. Cook logging + following + feed is a genuine differentiator.
2. **AI recipe modification is rare.** Samsung Food has "personalize" (paid), but a dedicated modify-with-AI flow (make vegetarian, simplify, etc.) with preview and save is not a common feature. This is a differentiator.
3. **Import from any source is table stakes.** Every new entrant competes on import capabilities (URL, photos, video, text). Aleppo's Gemini-powered import is competitive here.
4. **Most successful apps avoid ads.** The ad-supported model (Allrecipes, Cookpad free tier) is associated with user complaints. The trend is toward subscriptions or one-time purchases.
5. **Pricing clusters around $3–7/month or $30–60/year** for premium tiers. One-time purchases ($5–30) exist but are becoming less common for new apps.
6. **Self-hosted/open-source** (RecipeSage, Tandoor) serves a real niche but stays small. Not a direct competitor but worth watching for feature inspiration.
7. **Cross-platform matters.** Apple-only apps (Mela, Pestle) have loyal but limited audiences. The most successful apps (Samsung Food, Cookpad, AnyList) cover iOS + Android + Web.

