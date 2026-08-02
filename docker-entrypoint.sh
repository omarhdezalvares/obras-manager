#!/bin/sh
set -e

mkdir -p "$(dirname "${DATABASE_URL#file:}")" "$UPLOAD_DIR"

npx prisma migrate deploy --schema=prisma/schema.prisma

exec node dist/index.js
