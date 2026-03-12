# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   cd ../.. && pnpm install
   ```

2. Start the app

You need the backend server to be running before launching the native app.

Run the commands from the repo root:

   ```bash
   # To get the server started
   pnpm dev:web
   ```

   ```bash
   # To start the web app
   pnpm --filter native web
   ```

   ```bash
   # To get the start menu with the QR code
   pnpm --filter native start
   ```

   ```bash
   # To start in the iPhone emulator
   pnpm --filter native ios
   ```

## E2E Tests (Playwright)

Tests run against the SPA served by the Next.js dev server. You need the SPA built and the server running before running tests.

### Setup (first time)

```bash
# Install Playwright browsers
cd apps/web && pnpm exec playwright install
```

### Running tests

```bash
# 1. Build the SPA (from repo root)
sh scripts/build-spa.sh

# 2. Start the dev server in a separate terminal (from repo root)
pnpm dev:web

# 3. Run all tests
cd apps/web && pnpm exec playwright test
```

### Useful options

```bash
# Watch the browser while tests run
pnpm exec playwright test --headed

# Interactive UI mode (best for debugging)
pnpm exec playwright test --ui

# Run a single test file
pnpm exec playwright test tests/e2e/recipes.spec.ts

# Run a single test by name
pnpm exec playwright test --grep "log a cook"
```
