# Aleppo — Claude Code Context

A recipe management app in the spirit of Strava/Letterboxd. Users save recipes, log every cook, and follow friends. Full product spec: `docs/PRD_V2.md`. Backlog/ideas: `docs/todo.md`.

## Monorepo structure

```
apps/
  web/      — Next.js 15 web app (API + SPA host, production)
  native/   — React Native / Expo app (iOS, Android, and web SPA)
packages/
  shared/   — shared TypeScript types (workspace:*)
```

Package manager: **pnpm** (v10). Root `package.json` defines `dev:web` and `build:web` scripts.

```bash
pnpm dev:web                  # start Next.js on localhost:3000
pnpm --filter native web      # start Expo web on localhost:8081
pnpm --filter native ios      # run on iOS simulator
pnpm --filter native android  # run on Android emulator
sh scripts/build-spa.sh       # build Expo web → apps/web/public/spa.html (required before tests)
```

## Architecture: SPA served by Next.js

The web app no longer uses Next.js pages for UI. Instead:
- `scripts/build-spa.sh` exports the Expo app as a static SPA and copies it to `apps/web/public/spa.html`
- `apps/web/middleware.ts` rewrites ALL non-API, non-static requests to `/spa.html`
- The Expo React Native app handles all routing client-side in the browser
- API routes (`/api/*`) are still served by Next.js as before

**In development:** run `sh scripts/build-spa.sh` to build the SPA, then `pnpm dev:web` to serve it. The SPA calls the API at the same origin (blank `EXPO_PUBLIC_API_URL`).

## Web app (`apps/web`)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router, TypeScript strict |
| ORM | Drizzle ORM + Drizzle Kit migrations |
| Auth | Auth.js v5 — credentials (email/pw); Google OAuth present but UI hidden |
| Database | PostgreSQL 16 (Railway) |
| Styling | Tailwind CSS v4 + shadcn/ui (API/legacy only) |
| Images | Cloudflare R2 via `@aws-sdk/client-s3`; `sharp` for resize |
| Scraping | `@extractus/recipe-extractor` (JSON-LD first); Playwright fallback |

**API routes (still active):**
- `/api/recipes` — CRUD
- `/api/recipes/[id]/detail` — detail + cook logs + queue status
- `/api/cook-logs` — log/delete cooks
- `/api/queue` — want-to-cook queue
- `/api/feed` — social feed
- `/api/follows` — follow/unfollow
- `/api/users/me`, `/api/users/[id]`, `/api/users/search` — user profiles
- `/api/auth/mobile/credentials` — JWT login for native/SPA

**Key conventions:**
- Never auto-save imports — always show a review/edit step first
- Recipe privacy defaults to private (`recipes.is_public = false`); profile defaults to public
- Ingredients stored dual: `raw` string + parsed `{amount, unit, name, notes}` — never discard `raw`
- Every import writes a `recipe_imports` row with `raw_payload` (jsonb) for debugging
- Images always re-uploaded to R2 — never keep third-party image URLs long-term
- No Redis, no job queues, no tRPC — keep the stack simple

## Native app (`apps/native`) — fully implemented

React Native (Expo SDK 54) + Expo Router v6 (file-based routing). Runs on iOS, Android, and web (as SPA).

**Screens:**

| File | Status |
|------|--------|
| `app/_layout.tsx` | Root stack (AuthProvider) |
| `app/index.tsx` | Redirect: `/recipes` if authed, else `/login` |
| `app/login.tsx` | Email/password login |
| `app/profile.tsx` | Profile — name/avatar, settings link, sign-out |
| `app/settings.tsx` | Edit profile, bio, privacy, recipe defaults |
| `app/(tabs)/_layout.tsx` | Bottom tab bar: Recipes, Queue, Feed, New, Import |
| `app/(tabs)/recipes.tsx` | Recipe list — search, tag filter, pull-to-refresh |
| `app/(tabs)/queue.tsx` | Want-to-cook list — reorder, remove |
| `app/(tabs)/feed.tsx` | Social feed + people search/follow |
| `app/(tabs)/new.tsx` | Manual recipe creation form |
| `app/(tabs)/import.tsx` | Placeholder (not yet implemented) |
| `app/recipes/[id]/index.tsx` | Recipe detail — ingredients (with scaling), cook log, queue |
| `app/recipes/[id]/edit.tsx` | Recipe edit form |
| `app/u/[id].tsx` | Public user profile — follow, stats, recipe list |

**Auth flow:**
- Login POSTs to `POST /api/auth/mobile/credentials` → returns `{ token, user: { id, name, email, image } }`
- JWT stored in `expo-secure-store` (native) or `localStorage` (web, keys: `auth_token`, `auth_user`)
- Token sent as `Authorization: Bearer <token>` on all API calls
- `apps/web/lib/mobile-auth.ts` decodes Bearer tokens for API routes (tries both cookie salts)

**API auth pattern for new web API routes:**
```ts
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";

const session = await auth();
const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Key native patterns:**
- Use `FlatList` as root element; put title/search/filters in `ListHeaderComponent`
- Safe area top padding: `paddingTop: Platform.OS === "ios" ? 60 : 24`
- On 401 responses, only call `signOut()` if token is currently non-null (prevents auth destruction on initial unauthenticated fetch while localStorage loads)
- After editing a recipe, use `router.replace("/recipes/${id}")` (not `router.back()`) so the detail screen remounts with fresh data

## E2E tests (`apps/web/tests/e2e/`)

Playwright tests run against the SPA at `http://localhost:3000`. **Build the SPA first** with `sh scripts/build-spa.sh`, then start `pnpm dev:web`, then run `pnpm exec playwright test`.

**Key notes for writing tests:**
- `TouchableOpacity` renders as `<div>` without `role="button"` — use `getByText()` for clicks
- `Switch` renders as `<input role="switch">` — `getByRole("switch")` works
- `TextInput` renders as `<input>` — `getByPlaceholder()` works
- Auth is in `localStorage` (`auth_token`, `auth_user`) — `global.setup.ts` injects it
- Avoid `page.goto()` for protected routes mid-test; prefer in-SPA tab navigation to avoid auth race
- When clicking "Follow", wait for `getByText("Following", { exact: true }).toHaveCount(2)` (stats label + button) to confirm the POST has committed before checking the feed

## Git branches

- `main` — production
- `dev` — main development branch
- `jane-dev` — current active working branch (merge into `dev` when done)
- `tt-dev` — (merge into `dev` when done)

## Environment

- `apps/native/.env.local` — `EXPO_PUBLIC_API_URL=https://aleppo-dev.up.railway.app` (production dev server; blank = same origin when built as SPA)
- `apps/web/.env.local` — `AUTH_SECRET`, `DATABASE_URL`, R2 keys, etc.
