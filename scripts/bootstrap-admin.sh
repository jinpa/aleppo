#!/usr/bin/env bash
# Bootstrap the first admin user via the API.
# Usage: sh scripts/bootstrap-admin.sh <email> <password> [base_url]

set -euo pipefail

EMAIL="${1:?Usage: bootstrap-admin.sh <email> <password> [base_url]}"
PASSWORD="${2:?Usage: bootstrap-admin.sh <email> <password> [base_url]}"
BASE="${3:-http://localhost:3000}"

# 1. Login to get a bearer token
LOGIN_RES=$(curl -s -w "\n%{http_code}" "$BASE/api/auth/mobile/credentials" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

HTTP_CODE=$(echo "$LOGIN_RES" | tail -1)
BODY=$(echo "$LOGIN_RES" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "Login failed ($HTTP_CODE): $BODY"
  exit 1
fi

TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Could not extract token from login response"
  exit 1
fi

# 2. Call the bootstrap endpoint
BOOT_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/admin/bootstrap" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$BOOT_RES" | tail -1)
BODY=$(echo "$BOOT_RES" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "Done — $EMAIL is now an admin."
elif [ "$HTTP_CODE" = "403" ]; then
  echo "An admin already exists. Use the admin screen to promote other users."
  exit 1
else
  echo "Bootstrap failed ($HTTP_CODE): $BODY"
  exit 1
fi
