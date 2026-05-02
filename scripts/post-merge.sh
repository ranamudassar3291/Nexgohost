#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db push
node scripts/seed-db.mjs
