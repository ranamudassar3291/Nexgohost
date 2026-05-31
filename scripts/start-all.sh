#!/bin/bash
# Start backend API server on port 8080
# (Frontend runs via its own artifact workflow on port 5000)
export PORT=8080
export NODE_ENV=development
exec pnpm --filter @workspace/api-server run dev
