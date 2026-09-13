#!/bin/sh
set -e

echo "==> Running database migrations..."
pnpm exec prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database (RUN_SEED=true)..."
  # A seed failure must not keep the API down.
  pnpm db:seed || echo "WARNING: database seed failed, starting server anyway"
else
  echo "==> Skipping database seed (set RUN_SEED=true to run it)"
fi

echo "==> Starting server..."
exec node dist/app.js
