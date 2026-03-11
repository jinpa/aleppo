#!/bin/sh
set -e

echo "▶ Building Expo web SPA..."
EXPO_PUBLIC_API_URL='' pnpm --filter native exec expo export --platform web

echo "▶ Copying SPA assets into Next.js public/..."
rm -rf apps/web/public/_expo apps/web/public/spa.html

cp -r apps/native/dist/_expo apps/web/public/_expo
cp apps/native/dist/index.html apps/web/public/spa.html

# Copy any additional static assets (fonts, images bundled by Expo)
if [ -d "apps/native/dist/assets" ]; then
  cp -r apps/native/dist/assets apps/web/public/assets
fi

echo "✓ SPA assets ready."
