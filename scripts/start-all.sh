#!/bin/bash
# Start backend (port 8080) and frontend (port 5000) in parallel
PORT=8080 pnpm --filter @workspace/api-server run dev &
BACKEND_PID=$!

PORT=5000 pnpm --filter @workspace/nexgohost run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
