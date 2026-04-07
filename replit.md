# Nexgohost (Noehost) — Hosting Management Platform

A production-ready SaaS hosting and domain management platform (similar to WHMCS). Provides full-stack client and admin panels for managing hosting services, domains, billing, support tickets, and more.

## Architecture

This is a **pnpm monorepo** with the following structure:

```
artifacts/
  api-server/       — Express.js backend (port 8080)
  nexgohost/        — React + Vite frontend (port 5173, served at /)
  mockup-sandbox/   — UI prototyping sandbox (port 8081)
lib/
  db/               — Drizzle ORM schema + PostgreSQL config
  api-spec/         — OpenAPI spec + Orval codegen config
  api-zod/          — Zod schemas (generated)
  api-client-react/ — React Query hooks (generated)
```

## Key Technologies

- **Backend**: Express.js 5, Drizzle ORM, PostgreSQL, JWT auth, Nodemailer, OpenAI
- **Frontend**: React 19, Vite 7, TanStack Query, Wouter, Tailwind CSS v4, Radix UI, Framer Motion
- **Database**: PostgreSQL (Replit built-in), managed via Drizzle Kit

## Environment Variables (set in .replit [userenv])

- `JWT_SECRET` — JWT signing secret
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_NAME`, `SMTP_ENCRYPTION` — email config
- `SERVER_HOSTNAME` — main domain (noehost.com)
- `ENCRYPTION_KEY` — field encryption key
- `ADMIN_LOGIN_SLUG` — admin login URL slug
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit DB)

## Workflows

- **Start application** — Backend API server on port 8080
- **artifacts/nexgohost: web** — Frontend Vite dev server on port 5173

## Database

Run schema migrations with:
```bash
pnpm --filter @workspace/db push
```

## Integrations

- **cPanel / WHM** — hosting provisioning
- **20i** — hosting provider API
- **Safepay** — payment gateway
- **WhatsApp (Baileys)** — messaging notifications
- **Google OAuth** — client sign-in
- **OpenAI** — support ticket AI assistance

## Features

- Client portal (login, dashboard, hosting, domains, support, billing)
- Admin panel (client management, servers, invoices, email templates, KB)
- Cron tasks: renewal reminders, invoice generation, suspension, health checks
- Multi-currency support with auto-refreshing exchange rates
- WhatsApp notifications for billing events
