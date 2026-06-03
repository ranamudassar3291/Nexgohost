---
name: 20i API Base64 Authentication
description: 20i API requires Base64-encoded general key as Bearer token, not plain hex. GCP IPs need VPS proxy.
---

## Rule
`Authorization: Bearer <Base64(generalKey)>` — always Base64-encode the key before using as Bearer token.

**Why:** 20i official API docs show `Authorization: Bearer ZTRkNGZkMzFhNTJkY2FlMwo=` (Base64). Plain hex key returns 401 "Invalid Authentication" type "User ID" every time regardless of IP whitelist.

## Key format
- Combined key from my.20i.com: `generalKey+oauthKey`
- Extract part before `+` → Base64 encode it → use as Bearer token
- `Buffer.from(generalKey).toString('base64')` in Node.js

## Proxy requirement
- Replit runs on GCP (8.231.x.x range). 20i blocks GCP IPs at account level.
- Solution: DigitalOcean VPS (`168.144.130.190`) running Squid proxy on port 3128
- All 20i servers in DB have `proxy_url = 'http://168.144.130.190:3128'`
- VPS IP `168.144.130.190` is whitelisted at my.20i.com → Reseller API

## Code location
- `encodeKeyForBearer()` in `artifacts/api-server/src/lib/twenty-i.ts`
- Used in `buildAuthHeader()` and `request()` function
- Key detection tries `before_plus_b64` format first

## How to apply
Every 20i API call goes through `request()` which calls `encodeKeyForBearer(selectedKey)`. Never pass raw hex key as Bearer. Always ensure `proxy_url` is set on the server record in DB.
