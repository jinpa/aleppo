# Aleppo — Claude Code Context

A recipe management app in the spirit of Strava/Letterboxd. Users save recipes, log every cook, and follow friends. Full product spec: `docs/PRD_V2.md`. Backlog/ideas: `docs/todo.md`.

## Monorepo structure

```
apps/
  web/      — Next.js 15 web app (primary, production)
  native/   — React Native / Expo app (active port, in progress)
packages/
  shared/   — shared TypeScript types (workspace:*)
```

Package manager: **pnpm** (v10). Root `package.json` defines `dev:web` and `build:web` scripts.

```bash
pnpm dev:web                  # start Next.js on localhost:3000
pnpm --filter native web      # start Expo web on localhost:8081
pnpm --filter native ios      # run on iOS simulator
pnpm --filter native android  # run on Android emulator
```

## Web app (`apps/web`)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router, TypeScript strict |
| ORM | Drizzle ORM + Drizzle Kit migrations |
| Auth | Auth.js v5 — credentials (email/pw); Google OAuth present but UI hidden |
| Database | PostgreSQL 16 (Railway) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Images | Cloudflare R2 via `@aws-sdk/client-s3`; `sharp` for resize |
| Scraping | `@extractus/recipe-extractor` (JSON-LD first); Playwright fallback |

**Routes:**
- `(app)/` — recipes list (home, post-login)
- `(app)/recipes/[id]` — recipe detail
- `(app)/recipes/new` — manual create
- `(app)/recipes/import` — URL import flow
- `(app)/queue` — want-to-cook list
- `(app)/feed` — social feed
- `(app)/settings`, `(app)/u/[id]` — settings / public profile

**Key conventions:**
- Never auto-save imports — always show a review/edit step first
- Recipe privacy defaults to private (`recipes.is_public = false`); profile defaults to public
- Ingredients stored dual: `raw` string + parsed `{amount, unit, name, notes}` — never discard `raw`
- Every import writes a `recipe_imports` row with `raw_payload` (jsonb) for debugging
- Images always re-uploaded to R2 — never keep third-party image URLs long-term
- No Redis, no job queues, no tRPC — keep the stack simple

## Native app (`apps/native`) — active port

React Native (Expo SDK 54) + Expo Router v6 (file-based, same conventions as Next.js App Router).

**Current state:** Early port in progress. The following screens exist:

| File | Status |
|------|--------|
| `app/_layout.tsx` | Root stack (AuthProvider, explicit screen list) |
| `app/index.tsx` | Redirect: `/(tabs)/recipes` if authed, else `/login` |
| `app/login.tsx` | Email/password login — posts to `/api/auth/mobile/credentials` |
| `app/profile.tsx` | Profile screen — shows name/avatar, sign-out |
| `app/(tabs)/_layout.tsx` | Bottom tab bar: Recipes, Queue, Feed, New, Import |
| `app/(tabs)/recipes.tsx` | **Fully implemented** — recipe list with search, tag filter, pull-to-refresh |
| `app/(tabs)/queue.tsx` | Placeholder |
| `app/(tabs)/feed.tsx` | Placeholder |
| `app/(tabs)/new.tsx` | Placeholder |
| `app/(tabs)/import.tsx` | Placeholder |

**Auth flow:**
- Login POSTs to `POST /api/auth/mobile/credentials` on the web backend
- Response returns `{ token, user: { id, name, email, image } }`
- JWT stored in `expo-secure-store` (native) or `localStorage` (web)
- Token is a next-auth JWT — sent as `Authorization: Bearer <token>` on all API calls
- `apps/web/lib/mobile-auth.ts` decodes Bearer tokens for API routes (tries both cookie salts for dev/prod compatibility)

**API auth pattern for new web API routes:**
```ts
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";

const session = await auth();
const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Native app key packages:** `expo-router`, `expo-secure-store`, `expo-image`, `@expo/vector-icons` (Ionicons), `@react-navigation/bottom-tabs`, `react-native-reanimated`.

**Layout pattern for screens:**
- Use `FlatList` as the root element (not a wrapping `View`) so header + content scroll as one unit
- Put title/search/filters in `ListHeaderComponent` to avoid split-scroll issues on iOS
- Safe area top padding: `paddingTop: Platform.OS === "ios" ? 60 : 24` in the header style

## Git branches

- `main` — production
- `dev` — main development branch
- `jane-dev` — current active working branch (merge into `dev` when done)
- `tt-dev` - (merge into `dev` when done)

## Environment

- `apps/native/.env.local` — `EXPO_PUBLIC_API_URL=http://localhost:3001` (note: Next.js may use 3001 if 3000 is taken)
- `apps/web/.env.local` — `AUTH_SECRET`, `DATABASE_URL`, R2 keys, etc.
