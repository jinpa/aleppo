# Aleppo

Your cooking diary — save recipes, log every cook, and follow friends to see what they've been cooking.

## Prerequisites

Install [pnpm](https://pnpm.io) v10 (the project's package manager):

```bash
npm install -g pnpm
```

## Running locally

```bash
# Install dependencies (all workspaces)
pnpm install

# Build the Expo web SPA first (required before starting the server)
sh scripts/build-spa.sh

# Web backend + Expo web SPA (localhost:3000)
pnpm dev:web

# iOS simulator
pnpm --filter native ios

# Android emulator
pnpm --filter native android
```

## Testing on a physical iOS device (Expo Go)

1. Install [Expo Go](https://expo.dev/go) on your iPhone
2. Make sure `apps/native/.env.local` has:
   ```
   EXPO_PUBLIC_API_URL=https://aleppo-dev.up.railway.app
   ```
3. Start Metro with tunnel mode (works on any network, not just local WiFi):
   ```bash
   pnpm --filter native start --tunnel
   ```
4. Scan the QR code in the terminal with your iPhone camera

> Without `--tunnel`, Metro only works if your phone is on the same WiFi as your Mac.

## Sharing with others (without your Mac running)

Use EAS Build to produce a standalone `.ipa` distributed via TestFlight. Requires an Apple Developer account ($99/year).

## Deployment

Pushes to the `dev` branch auto-deploy to Railway.

- **URL:** https://aleppo-dev.up.railway.app
- **Build:** `pnpm build:railway` — builds Expo web SPA then Next.js
- **Start:** `pnpm start:railway` — runs DB migrations then `next start`
