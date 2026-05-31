---
name: API Server Workflow Startup
description: Why the artifact API server workflow shows "failed" and how to run the backend reliably
---

## The Problem
The artifact-managed workflow `artifacts/api-server: API Server` (command: `pnpm --filter @workspace/api-server run dev`) consistently fails Replit's 90-second health check. pnpm + tsx cold compilation takes longer than 90s before binding port 8080, causing Replit to mark the workflow "failed" and kill the process.

## The Fix
Use the `Start application` workflow (NOT an artifact — can be reconfigured) with a direct command that bypasses pnpm workspace overhead:

```
cd artifacts/api-server && PORT=8080 NODE_ENV=development npx tsx src/index.ts
```

- `waitForPort: 8080`, `outputType: "console"`
- This starts fast enough for Replit's health check to detect port 8080

## Why
- `pnpm --filter @workspace/api-server run dev` adds pnpm workspace resolution overhead before tsx even starts
- `npx tsx src/index.ts` from the directory starts directly — port opens in time
- `PORT=8080` must be set explicitly; Replit does not always inject it for artifact workflows

## How to Apply
When the API server is down, reconfigure `Start application` workflow via `configureWorkflow()`:
```js
configureWorkflow({
  name: "Start application",
  command: "cd artifacts/api-server && PORT=8080 NODE_ENV=development npx tsx src/index.ts",
  waitForPort: 8080,
  outputType: "console",
  autoStart: true
})
```

**Do NOT try to restart `artifacts/api-server: API Server`** — it will always timeout.
