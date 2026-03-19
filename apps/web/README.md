# Aleppo

Your cooking diary — save recipes, log every cook, and follow friends to see what they've been cooking.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Drizzle ORM** + PostgreSQL 16
- **Auth.js v5** — credentials (email/pw) + Google OAuth
- **Tailwind CSS v4** + Radix UI components
- **Cloudflare R2** for image storage
- **Railway** for hosting

## Local Development

### 1. Prerequisites

- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)
- PostgreSQL 15+ running locally (e.g. via Homebrew: `brew install postgresql@16 && brew services start postgresql@16`)

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up local environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` — the defaults work for a Homebrew PostgreSQL install. At minimum you need:

| Variable | Local value |
|---|---|
| `DATABASE_URL` | `postgresql://localhost/aleppo` |
| `AUTH_SECRET` | run `openssl rand -base64 32` and paste the result |

Google OAuth and Cloudflare R2 are **optional** in local dev — the app works without them (image uploads fall back to a placeholder URL).

### 4. Create and migrate the local database

```bash
# Create the database (only needed once)
createdb aleppo

# Push the schema (fast, no migration files — good for local dev)
pnpm --filter web db:push
```

### 5. Build the SPA

The UI is an Expo app exported as a static SPA. Build it once before starting the server (and rebuild after frontend changes):

```bash
sh scripts/build-spa.sh
```

### 6. Run the dev server

```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Features (MVP V1.0)

- **Auth** — Email/password signup + Google OAuth
- **Recipe management** — Create, edit, delete, search, and filter by tags
- **URL import** — Paste any recipe URL; we parse Schema.org JSON-LD and let you review/edit before saving
- **Image upload** — Upload photos to Cloudflare R2 (or placeholder in dev)
- **Cook log** — Log every cook with a date and optional note; track your history
- **Cook count** — "Made X times" on every recipe
- **Want-to-cook queue** — Your reading list for recipes
- **Social** — Follow users, see their public cooks in your feed
- **Public profiles** — Share your cooking life; public profiles + recipes are shareable by link
- **Settings** — Edit profile, toggle public/private, change password

## Database Migrations

```bash
pnpm --filter web db:generate    # Generate new migrations from schema changes
pnpm --filter web db:migrate     # Apply pending migrations
pnpm --filter web db:push        # Push schema directly (dev only)
pnpm --filter web db:studio      # Open Drizzle Studio
```

## Railway Deployment

### First deploy

1. Install the Railway CLI: `brew install railway`
2. `railway login`
3. `railway init` (link to your project)
4. Add a **PostgreSQL** add-on in the Railway dashboard — this sets `DATABASE_URL` automatically
5. Set the remaining environment variables in the Railway dashboard **Variables** tab:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | from Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | from Google Cloud Console |
| `R2_ACCOUNT_ID` | from Cloudflare |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API token |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token |
| `R2_BUCKET_NAME` | e.g. `aleppo-images` |
| `R2_PUBLIC_URL` | your R2 public URL |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.railway.app` |

6. Push to deploy — Railway runs `npm run build:railway` which **automatically migrates the database** before building.

### Ongoing workflow

```
# Make changes locally
pnpm dev:web

# When schema changes:
pnpm --filter web db:generate    # generates a new SQL migration file
pnpm --filter web db:push        # applies it to local database

# Commit everything (including drizzle/ migration files)
git add .
git commit -m "..."
git push origin main   # Railway auto-deploys; runs db:migrate then build
```

Railway's build command (`build:railway`) runs `drizzle-kit migrate` before `next build`, so your production schema is always in sync.

## Database Commands

```bash
pnpm --filter web db:generate    # Generate new migrations from schema changes
pnpm --filter web db:migrate     # Apply pending migrations (used in Railway deploy)
pnpm --filter web db:push        # Push schema directly — local dev only, skips migration files
pnpm --filter web db:studio      # Open Drizzle Studio (local GUI)
```
