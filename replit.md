# Nexgohost - Hosting & Client Management Platform

## Overview

A complete WHMCS-style hosting and client management platform built on a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **API framework**: Express 5 (running on port 8080)
- **Frontend**: React + Vite + TailwindCSS v4 (dark purple SaaS theme)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs), token stored in localStorage
- **API codegen**: Orval (from OpenAPI spec → React Query hooks + Zod schemas)

## Demo Credentials

- **Admin**: `admin@nexgohost.com` / `admin123`
- **Client 1**: `john@example.com` / `client123`
- **Client 2**: `jane@example.com` / `client123`

## Architecture

```text
artifacts/
├── api-server/         # Express API (port 8080), all routes at /api/*
└── nexgohost/          # React + Vite frontend (proxies /api → localhost:8080)

lib/
├── api-spec/           # OpenAPI spec + Orval codegen config
├── api-client-react/   # Generated React Query hooks (+ auth token injection)
├── api-zod/            # Generated Zod schemas
└── db/                 # Drizzle ORM schema + DB connection
```

## API Routes (all prefixed with /api)

- `POST /api/auth/register` — Register new client
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Get current user
- `GET /api/admin/dashboard` — Admin stats (admin only)
- `GET /api/admin/clients` — All clients (admin only)
- `GET /api/admin/clients/:id` — Client detail (admin only)
- `GET /api/admin/hosting` — All hosting services (admin only)
- `GET /api/admin/domains` — All domains (admin only)
- `GET /api/admin/orders` — All orders (admin only)
- `PUT /api/admin/orders/:id/approve` — Approve order (admin only)
- `PUT /api/admin/orders/:id/cancel` — Cancel order (admin only)
- `GET /api/admin/invoices` — All invoices (admin only)
- `PUT /api/admin/invoices/:id/paid` — Mark invoice paid (admin only)
- `GET /api/tickets` — Tickets (admin gets all, client gets own)
- `GET /api/tickets/:id` — Ticket detail with messages
- `POST /api/tickets` — Create ticket (client)
- `POST /api/tickets/:id/reply` — Reply to ticket
- `PUT /api/tickets/:id/close` — Close ticket
- `GET /api/migrations` — Migrations (admin gets all, client gets own)
- `POST /api/migrations` — Request migration (client)
- `PUT /api/admin/migrations/:id/status` — Update migration status (admin)
- `GET /api/my/hosting` — Client's hosting services
- `GET /api/my/domains` — Client's domains
- `GET /api/my/invoices` — Client's invoices
- `POST /api/invoices/:id/pay` — Pay invoice (client)
- `GET /api/client/dashboard` — Client dashboard stats
- `GET /api/account` — Get account info
- `PUT /api/account` — Update account

## Frontend Pages

### Admin Panel (`/admin/*`)
- `/admin/dashboard` — Stats overview with chart
- `/admin/clients` — Client list with search
- `/admin/clients/:id` — Client detail (services, domains, invoices, tickets tabs)
- `/admin/hosting` — All hosting services
- `/admin/domains` — Domain management + pricing table
- `/admin/orders` — Order management with approve/cancel
- `/admin/invoices` — Invoice management with mark-paid
- `/admin/tickets` — Support tickets list
- `/admin/tickets/:id` — Ticket detail with reply
- `/admin/migrations` — Migration management
- `/admin/settings` — Settings page

### Client Portal (`/client/*`)
- `/client/dashboard` — Welcome + stats overview
- `/client/hosting` — Active hosting services
- `/client/domains` — Registered domains
- `/client/invoices` — Invoice list with pay action
- `/client/tickets` — Support tickets
- `/client/tickets/:id` — Ticket detail with reply
- `/client/migrations` — Migration requests
- `/client/account` — Account settings + password change

### Auth Pages
- `/login` — Login form
- `/register` — Registration form

## Database Schema

Tables: `users`, `hosting_plans`, `hosting_services`, `domains`, `domain_pricing`, `orders`, `invoices`, `transactions`, `tickets`, `ticket_messages`, `migrations_requests`

## Key Technical Notes

- **Auth token injection**: `lib/api-client-react/src/custom-fetch.ts` automatically reads JWT from localStorage and adds `Authorization: Bearer <token>` header to all requests
- **Vite proxy**: `/api` requests from the frontend are proxied to `http://localhost:8080` during development
- **Route protection**: `ProtectedRoute` component redirects unauthenticated users to `/login`, wrong-role users to their appropriate dashboard
- **JWT secret**: Stored in `JWT_SECRET` environment variable (defaults to a hardcoded dev value if not set)

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/nexgohost run dev` — Start frontend
- `pnpm --filter @workspace/db run push` — Push schema to DB
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from OpenAPI spec
