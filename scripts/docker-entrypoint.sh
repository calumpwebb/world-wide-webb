#!/bin/sh
set -e

echo "Running database migrations..."
node --import tsx scripts/migrate.ts

echo "Seeding admin user (if not exists)..."
node --import tsx scripts/seed-admin.ts || true

echo "Starting application..."
exec node server.js
