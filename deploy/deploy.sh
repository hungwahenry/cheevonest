#!/usr/bin/env bash
set -euo pipefail

# Run as the deploy user from the app dir on each release.

APP_DIR="/var/www/cheevo"
BRANCH="main"

cd "$APP_DIR"

echo "== git pull =="
git pull --ff-only origin "$BRANCH"

echo "== install deps =="
npm ci

echo "== migrate =="
npx prisma migrate deploy

echo "== prisma client (with TypedSQL) =="
npx prisma generate --sql

echo "== build =="
npm run build

echo "== start / reload =="
pm2 startOrReload deploy/ecosystem.config.js --update-env
pm2 save

echo
echo "✓ Deploy complete."
