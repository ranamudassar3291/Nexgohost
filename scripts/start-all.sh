#!/bin/bash
# Start backend (port 8080) in background
PORT=8080 pnpm --filter @workspace/api-server run dev &
BACKEND_PID=$!

# Start frontend (port 5000) — foreground process
PORT=5000 pnpm --filter @workspace/nexgohost run dev

# If frontend exits, also stop backend
kill $BACKEND_PID 2>/dev/null
