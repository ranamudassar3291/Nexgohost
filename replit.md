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

## Domain Ordering System

The client portal has a full domain ordering workflow:
- **Real availability checking** via RDAP (Registration Data Access Protocol) — no API key required. RDAP servers queried per TLD: Verisign (.com/.net), PublicInterestRegistry (.org), etc.
- **Cart** — clients add multiple TLDs to cart, select 1–3 year registration periods
- **Checkout** — creates domain record (status: active), order (status: approved), and invoice (status: unpaid) atomically
- **Dashboard sync** — domain count updates immediately after registration
- **API hooks**: `useSearchDomainAvailability`, `useRegisterDomain` in `lib/api-client-react/src/domain-order.ts`

## API Routes (all prefixed with /api)

### Auth
- `POST /api/auth/register` — Register new client
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Get current user

### Admin (admin role required)
- `GET /api/admin/dashboard` — Stats overview
- `GET /api/admin/clients` — All clients (filterable)
- `POST /api/admin/clients` — Create new client account
- `PUT /api/admin/clients/:id` — Update client details
- `DELETE /api/admin/clients/:id` — Delete client
- `GET /api/admin/clients/:id` — Client detail
- `GET /api/admin/hosting` — All hosting services
- `GET /api/admin/domains` — All domains
- `GET /api/admin/packages` — All hosting packages (incl. inactive)
- `GET /api/admin/packages/:id` — Single package detail
- `POST /api/admin/packages` — Create hosting package
- `PUT /api/admin/packages/:id` — Update package
- `POST /api/admin/packages/:id/toggle` — Toggle active/inactive
- `DELETE /api/admin/packages/:id` — Delete package
- `GET /api/admin/orders` — All orders
- `POST /api/admin/orders` — Create order (admin)
- `POST /api/admin/orders/:id/approve` — Approve order
- `POST /api/admin/orders/:id/cancel` — Cancel order
- `POST /api/admin/orders/:id/suspend` — Suspend order
- `POST /api/admin/orders/:id/terminate` — Terminate order
- `POST /api/admin/orders/:id/fraud` — Mark order as fraud
- `PUT /api/admin/orders/:id` — Update order status
- `GET /api/admin/invoices` — All invoices
- `POST /api/admin/invoices` — Create invoice (admin)
- `POST /api/admin/invoices/:id/mark-paid` — Mark invoice paid
- `POST /api/admin/invoices/:id/cancel` — Cancel invoice
- `GET /api/admin/promo-codes` — All promo codes
- `POST /api/admin/promo-codes` — Create promo code
- `POST /api/admin/promo-codes/:id/toggle` — Toggle active
- `DELETE /api/admin/promo-codes/:id` — Delete promo code
- `GET /api/admin/payment-methods` — All payment methods (with settings)
- `POST /api/admin/payment-methods` — Add payment method
- `PUT /api/admin/payment-methods/:id` — Update payment method
- `POST /api/admin/payment-methods/:id/toggle` — Toggle active
- `DELETE /api/admin/payment-methods/:id` — Delete payment method
- `GET /api/admin/currencies` — All currencies
- `POST /api/admin/currencies` — Create currency
- `PUT /api/admin/currencies/:id` — Update currency
- `DELETE /api/admin/currencies/:id` — Delete currency
- `GET /api/currencies` — Public: active currencies
- `GET /api/admin/domain-extensions` — All TLD extensions with pricing
- `POST /api/admin/domain-extensions` — Create extension
- `PUT /api/admin/domain-extensions/:id` — Update extension
- `DELETE /api/admin/domain-extensions/:id` — Delete extension
- `GET /api/admin/servers` — All servers
- `GET /api/admin/servers/:id` — Single server detail
- `POST /api/admin/servers` — Add server
- `PUT /api/admin/servers/:id` — Update server
- `DELETE /api/admin/servers/:id` — Delete server
- `POST /api/admin/servers/:id/test` — Test server connection

### Client
- `GET /api/packages` — Public list of active hosting packages
- `GET /api/payment-methods` — Active payment methods (no secrets)
- `GET /api/promo-codes/validate?code=X&amount=Y` — Validate promo + compute discount
- `POST /api/client/checkout` — Place order + generate invoice (with promo support)
- `GET /api/my/hosting` — Client's hosting services
- `GET /api/my/domains` — Client's domains
- `GET /api/my/invoices` — Client's invoices
- `POST /api/invoices/:id/pay` — Pay invoice
- `GET /api/client/dashboard` — Dashboard stats
- `GET /api/account` — Get account info
- `PUT /api/account` — Update account

### Support / Shared
- `GET /api/tickets` — Tickets (admin: all, client: own)
- `GET /api/tickets/:id` — Ticket detail with messages
- `POST /api/tickets` — Create ticket (client)
- `POST /api/tickets/:id/reply` — Reply to ticket
- `PUT /api/tickets/:id/close` — Close ticket
- `GET /api/migrations` — Migrations (admin: all, client: own)
- `POST /api/migrations` — Request migration (client)
- `PUT /api/admin/migrations/:id/status` — Update migration status
- `GET /api/domains/pricing` — Public TLD pricing list
- `GET /api/domains/availability?domain=X` — RDAP availability check
- `POST /api/domains/register` — Register domain (order + invoice)

## Frontend Pages

### Admin Panel (`/admin/*`)
- `/admin/dashboard` — Stats overview with chart
- `/admin/clients` — Client list with search, edit (pencil) and delete (trash) buttons per row
- `/admin/clients/add` — Add new client form
- `/admin/clients/:id/edit` — Edit client details form
- `/admin/clients/:id` — Client detail (services, domains, invoices, tickets tabs)
- `/admin/hosting` — All hosting services
- `/admin/domains` — Domain management + pricing table
- `/admin/domains/extensions` — TLD extensions management (register/renewal/transfer pricing)
- `/admin/packages` — Hosting packages management (cards with toggle/edit/delete)
- `/admin/packages/add` — Create new hosting package
- `/admin/packages/:id/edit` — Edit existing package form
- `/admin/orders` — Order management (approve/cancel/suspend/terminate), "Create Order" button, status filters: pending/approved/suspended/cancelled/fraud/terminated
- `/admin/orders/add` — Admin create order form (select client + package)
- `/admin/invoices` — Invoice management (mark-paid/cancel), "Create Invoice" button, status filters: unpaid/paid/overdue/refunded/collections/cancelled
- `/admin/invoices/add` — Admin create invoice form (select client, line items)
- `/admin/tickets` — Support tickets list
- `/admin/tickets/:id` — Ticket detail with reply
- `/admin/migrations` — Migration management
- `/admin/promo-codes` — Promo code management (create/toggle/delete)
- `/admin/payment-methods` — Payment method management (stripe/paypal/bank/crypto/manual)
- `/admin/currencies` — Multi-currency management (PKR default + USD/GBP/EUR seeded)
- `/admin/servers` — Server management (cPanel/DirectAdmin/Plesk, connection test)
- `/admin/modules` — Modules listing with configure actions
- `/admin/settings` — Settings page

### Client Portal (`/client/*`)
- `/client/dashboard` — Welcome + stats overview
- `/client/hosting` — Active hosting services
- `/client/domains` — Registered domains + Order New Domain (with RDAP search, cart, checkout)
- `/client/invoices` — Invoice list with pay action
- `/client/tickets` — Support tickets
- `/client/tickets/:id` — Ticket detail with reply
- `/client/migrations` — Migration requests
- `/client/orders/new` — Browse hosting packages and place an order
- `/client/checkout` — Checkout with promo code, payment method, and order confirmation
- `/client/account` — Account settings + password change

### Auth Pages
- `/admin/login` — Admin Portal login (branded for administrators, role-validated)
- `/client/login` — Client Portal login (branded for clients, role-validated)
- `/login` — Legacy redirect → `/client/login`
- `/register` — Registration form

## Database Schema

Tables: `users`, `hosting_plans`, `hosting_services`, `domains`, `domain_pricing`, `orders`, `invoices`, `transactions`, `tickets`, `ticket_messages`, `migrations_requests`, `promo_codes`, `payment_methods`, `domain_extensions`, `currencies`, `servers`

**Order statuses**: pending, approved, completed, cancelled, suspended, fraud, terminated
**Invoice statuses**: unpaid, paid, cancelled, overdue, refunded, collections

## Key Technical Notes

- **Auth token injection**: `lib/api-client-react/src/custom-fetch.ts` automatically reads JWT from localStorage and adds `Authorization: Bearer <token>` header to all requests
- **Auth context split**: `AuthProvider` lives in `artifacts/nexgohost/src/context/AuthProvider.tsx`; `useAuth` hook in `artifacts/nexgohost/src/hooks/use-auth.tsx` — split to prevent Vite HMR incompatibility
- **Vite proxy**: `/api` requests from the frontend are proxied to `http://localhost:8080` during development
- **Route protection**: `AdminPage`/`ClientPage` inline guards in `App.tsx` — each route independently guards without wildcard Switch nesting (Wouter v3 strips prefix in nested Switches with wildcards)
- **Flat route tree**: All admin and client routes live in a single flat `<Switch>` to avoid Wouter v3 nested routing context bugs. No `<Route path="/admin/:rest*">` wildcards
- **Invoice numbers**: Auto-generated as `INV-YYYYMMDD-XXXXXX` in `checkout.ts`
- **Promo code validation**: `GET /api/promo-codes/validate?code=X&amount=Y` — checks active/limit/expiry, returns discount breakdown. Checkout atomically increments `usedCount`
- **JWT secret**: Stored in `JWT_SECRET` environment variable (defaults to a hardcoded dev value if not set)

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/nexgohost run dev` — Start frontend
- `pnpm --filter @workspace/db run push` — Push schema to DB
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from OpenAPI spec
