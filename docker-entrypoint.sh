#!/bin/sh
set -e

echo "Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy

# Seed only if a seed-done marker doesn't exist yet
SEED_MARKER="/data/.seeded"
if [ ! -f "$SEED_MARKER" ]; then
  echo "Seeding database..."
  if node_modules/.bin/tsx /app/prisma/seed.ts; then
    touch "$SEED_MARKER"
    echo "Seed completed successfully."
  else
    echo "WARNING: Seed failed, continuing startup anyway..."
  fi
fi

echo "Starting Next.js..."
exec node server.js
