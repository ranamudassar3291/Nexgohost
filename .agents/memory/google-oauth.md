---
name: Google OAuth setup
description: How Google OAuth credentials are stored and read; common failure points and fixes
---

## Rule
`google_client_secret` is saved **encrypted** (`encryptField()`) in the `settings` table.  
`getGoogleSettings()` in `auth.ts` MUST call `decryptField(rawSecret)` before passing to Google.

**Why:** `encryptField` stores `enc:v1:<iv>:<tag>:<cipher>` blobs. Sending that blob as a Bearer secret to Google's token exchange endpoint causes an `invalid_client` or `Token exchange failed` error.

## Env-var fallback
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars are used as fallback when DB rows are empty.
- Admin settings GET (`/api/admin/settings`) must include env-var fallback for `google_client_id` and `google_configured` so the admin UI shows the effective state.

## Callback URL
- Use `brand_website` DB setting (key: `brand_website`, value: `https://noehost.com`) as the base for the redirect_uri.
- Both `/auth/google/start` and `/auth/google/callback` must use the same `buildCallbackUrl(req, siteUrl)` helper so the redirect_uri always matches.

## Debugging
- Token exchange errors are logged as `[AUTH] Google token exchange failed: <full JSON>`.
- The real Google error is passed back to the frontend as `?error=google_failed&google_error=<encoded message>`.
- `auth_logs` table stores the error detail in the `details` column for every failed callback.
