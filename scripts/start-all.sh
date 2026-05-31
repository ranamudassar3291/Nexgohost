#!/bin/bash
# Start backend only — frontend is served by the nexgohost: web workflow
PORT=8080 pnpm --filter @workspace/api-server run dev
