#!/bin/sh
set -e

echo "==> Running database migrations..."
pnpm exec prisma migrate deploy

echo "==> Seeding database..."
pnpm db:seed

echo "==> Starting server..."
exec node dist/app.js
