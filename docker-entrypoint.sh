#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

# Seed only if a seed-done marker doesn't exist yet
SEED_MARKER="/data/.seeded"
if [ ! -f "$SEED_MARKER" ]; then
  echo "Seeding database..."
  npx tsx /app/prisma/seed.ts && touch "$SEED_MARKER"
fi

echo "Starting Next.js..."
exec node server.js
