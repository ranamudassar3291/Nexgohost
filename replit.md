# Nexgohost (Noehost) — Hosting Management Platform

## CMS Architecture

- **Firebase REMOVED** — all website content stored in PostgreSQL `settings` table (key: `site_content_v1`)
- **`GET /api/content`** — public endpoint, returns merged content from DB + defaults
- **`POST /api/admin/content`** — admin-only, updates any content key in DB
- **`ContentContext`** (`src/noehost/ContentContext.tsx`) — pure backend API, no Firebase dependency, localStorage cache
- **`/admin/website`** — Website Admin section with tabs: Hero, Navbar, Top Bar, Services, FAQ, Footer, Pricing, Domain Prices, Global Config

## Auth & Token System

- **Dual token sync**: `AuthProvider.login()` sets both `token` (client panel) and `noehost_token` (noehost CMS) in localStorage
- **ContentContext auth fix**: Both `src/context/ContentContext.tsx` (admin) and `src/noehost/ContentContext.tsx` (public) read token as `localStorage.getItem("noehost_token") || localStorage.getItem("token")` — fixes 401 on admin content save
- **Token expiry**: All JWT tokens (admin and client) now expire in 7 days (was 2h for admin)
- **Real-time updates**: Both ContentContexts poll every 30s, refresh on window focus, and listen for `noehost_content_updated` localStorage storage event broadcast from admin saves
- **Order flow auth**: `OrderModal` checks `localStorage.getItem('token') || localStorage.getItem('noehost_token')` before opening — unauthenticated users are redirected to `/client/login?redirect=...`
- **ClientLogin** honors `?redirect=` param after login (all 3 steps: password, 2FA, verify)
- **All `/register` links** redirected to `/client/register` across all marketing pages, hosting pages, Login, ClientLogin, OrderFlow

## Cart System

- **`cart_items` table**: Has columns `item_type`, `domain_name`, `tld`, `quarterly_price`, `semiannual_price`, `yearly_price`, `renewal_price`, `renewal_enabled`
- **Startup migration**: `artifacts/api-server/src/index.ts` runs `runStartupMigrations()` on startup which safely adds any missing columns to `cart_items` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- **Cart route** (`artifacts/api-server/src/routes/cart.ts`): Handles `itemType`, `domainName`, `tld` fields from CartContext payload

## Register Redirect Chains

- `/register` → `<Navigate to="/client/register" />` (App.tsx)
- `OrderFlow.tsx` → `/client/register?next=<encoded-checkout-url>`
- `ClientLogin.tsx` → already-logged-in check respects `?redirect=` param



A production-ready SaaS hosting and domain management platform (similar to WHMCS). Provides full-stack client and admin panels for managing hosting services, domains, billing, support tickets, and more.

## Running the App

- **Frontend (Noehost)**: `artifacts/nexgohost` — React + Vite, runs on **port 5000** via workflow `artifacts/nexgohost: web`
- **Backend (API Server)**: `artifacts/api-server` — Express.js, runs on **port 8080** via workflow `Start application`
- **Database**: PostgreSQL (Replit built-in), schema managed with Drizzle Kit

## Login Credentials (Development)

| Portal | URL | Email | Password |
|---|---|---|---|
| **Admin Panel** | `/admin/noe` | `admin@noehost.com` | `Admin@123456` |
| **Client Portal** | `/client/login` | _(register a new account)_ | — |

## Database Setup

First-time setup (or after environment reset):
```bash
# 1. Push schema to DB
pnpm --filter @workspace/db push

# 2. Seed default data (admin user, currencies, settings)
node scripts/seed-db.mjs
```

Or run the post-merge script which does everything:
```bash
bash scripts/post-merge.sh
```

## Hosting Management Panel (Hostinger-Style)

The client service detail page (`/client/hosting/:id`) is a full Hostinger-style panel with a left sidebar and these sections:

| Section | Features |
|---|---|
| **Overview** | Resource rings (disk/bandwidth), service info, quick-launch cPanel/File Manager/Email/DB |
| **WordPress** | One-click install, WP Admin auto-login, re-install, status tracking |
| **Domains & DNS** | Full DNS zone management, add/delete records (A, CNAME, MX, TXT, etc.) |
| **Email** | Create/delete email accounts, change password, webmail SSO login |
| **Databases** | List MySQL databases, create (DB + user + privileges), delete, phpMyAdmin SSO |
| **File Manager** | One-click SSO launch to cPanel File Manager |
| **SSL** | Install/reinstall Let's Encrypt SSL, status display |
| **SSH Access** | Enable/disable SSH, show login command and connection details |
| **Backups** | Create backups, list history, delete |
| **Node.js** | Create apps, start/stop/restart, delete (WHM NodeJs Selector UAPI) |
| **Python** | Create apps, restart/stop, delete (WHM Python Selector UAPI) |

Backend routes: `artifacts/api-server/src/routes/hosting.ts`
Backend helpers: `artifacts/api-server/src/lib/cpanel.ts`

### File Manager details
- Full in-browser custom file manager — no dependency on cPanel UI
- Navigate directories with breadcrumbs, file type icons
- Click text files to open a full-screen code editor (dark theme textarea)
- Save file edits back to server via Fileman::save_file_content
- Create folders via Fileman::mkdir
- Delete files/folders (hover → trash icon)
- Upload files up to 100 MB via WHM session → Fileman upload endpoint
- 20i services show "Not Available" notice (WHM-only feature)

### WordPress Plugin/Theme Manager
- When WP is installed: Plugin Manager card shows popular plugins (WooCommerce, Yoast, Elementor, etc.)
- "Manage Plugins in WP Admin" button opens WP Admin /plugins.php via SSO auto-login
- Theme Manager card shows popular themes with "Manage Themes" SSO button
- Both use `/client/hosting/:id/wp/sso-deep?target=plugins|themes` API route

### Backup Restore
- "Restore" button appears on each completed backup
- Full backups: triggers WHM `restoreaccount` API
- DB backups: triggers cPanel Restore UAPI
- Confirmation dialog before restore starts

### SSL Renew
- When SSL is active: both "Reinstall SSL" and "Renew SSL" buttons available
- Both call the same Let's Encrypt re-issue endpoint

## Theme & Design

- **Light theme by default** — ThemeProvider (`src/context/ThemeProvider.tsx`) defaults to `"light"`, localStorage key: `noehost-theme-v2`.
- **Color palette** — white/purple light theme:
  - Background: `228 60% 98%` (off-white, `--background`)
  - Primary/Brand: `238 82% 65%` (indigo #5B5FEF)
  - Cards: white with subtle border
  - Font: "Plus Jakarta Sans"
- **Homepage** (`src/pages/public/Homepage.tsx`) — Full dark-themed noehost marketing homepage with TopBar, Navbar, Hero, Pricing, ControlEfficiency, FeatureShowcase, Promo, Services, Features, CTA, FAQ, Testimonials, Footer, WhatsApp, ChatBot.
- **Marketing sub-pages**: `/shared-hosting`, `/wordpress-hosting`, `/reseller-hosting`, `/vps-hosting`, `/domains`, `/about-us`, `/about`, `/contact-us`, `/contact`, `/server-status` — all use noehost dark design with `NoeHostLayout`.
- **Component tree**: `src/noehost/` — 114 files extracted from original noehost website, including Navbar, TopBar, Hero, Pricing, CartSidebar, ChatBot, DomainChecker, Footer, and all hosting/about/contact/legal pages.
- **Noehost Layout** (`src/pages/public/NoeHostLayout.tsx`) — wraps marketing pages with ContentProvider, CurrencyProvider, CartProvider, Navbar, Footer.
- **ContentContext (noehost)** (`src/noehost/ContentContext.tsx`) — loads from Express `/api/content` (PostgreSQL backend), localStorage cache. Firebase fully removed.
- **Vite aliases**: `react-router-dom` → `src/noehost/router-shim.tsx` (wouter compat layer); `motion/react` → `src/noehost/motion-shim.ts` (framer-motion re-export). No source file changes needed.
- **CurrencyContext** — `useCurrency()` returns `{ currency, setCurrency, currencies, loading, formatPrice, convert }`. The `convert(usdAmount)` converts USD to current currency.
- CSS variables defined in `:root` in `src/index.css`.

## Architecture

This is a **pnpm monorepo** with the following structure:

```
artifacts/
  api-server/       — Express.js backend (port 8080)
  nexgohost/        — React + Vite frontend (port 5000, served at /)
  mockup-sandbox/   — UI prototyping sandbox (port 8081)
lib/
  db/               — Drizzle ORM schema + PostgreSQL config
  api-spec/         — OpenAPI spec + Orval codegen config
  api-zod/          — Zod schemas (generated)
  api-client-react/ — React Query hooks (generated)
scripts/
  seed-db.mjs       — Seeds admin user, currencies, and default settings
  post-merge.sh     — Runs after merges: install + db push + seed
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
- `ADMIN_LOGIN_SLUG` — admin login URL slug (`noe` → login at `/admin/noe`)
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit DB)

## Workflows

- **Start application** — Backend API server on port 8080 (console output)
- **artifacts/nexgohost: web** — Frontend Vite dev server on port 5000 (webview)
- **artifacts/mockup-sandbox: Component Preview Server** — UI sandbox on port 8081

## Database

Run schema migrations with:
```bash
pnpm --filter @workspace/db push
```

Seed initial data (admin user, currencies, settings) with:
```bash
node scripts/seed-db.mjs
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
- Multi-currency support with auto-refreshing exchange rates (PKR default)
- WhatsApp notifications for billing events
- **Unified Billing hub** at `/client/billing` — 5 tabs: Invoices, Transactions, Refunds, Wallet (Credits), Affiliate.
- **AI Chat Widget** — floating widget for clients in AppLayout.

## Full Branding System (White-Label)

All branding is dynamic — no hardcoded company names, colors, or emails anywhere critical.

### Branding API
- `GET /api/config` — returns full branding: `siteName`, `logoUrl`, `faviconUrl`, `primaryColor`, `brandWebsite`, `brandWhatsapp`, `brandAddress`, `brandSupportEmail`, `brandSocialTwitter/Facebook/Linkedin`, `invoiceFooterText`
- `GET/PUT /api/admin/branding/settings` — manage all extended branding settings
- `POST /api/admin/branding/upload` — upload logo / favicon
- `DELETE /api/admin/branding/:type` — remove logo or favicon

### Frontend Branding Hook
`use-branding.ts` — `useBranding()` returns full `BrandingConfig` including `primaryColor`, `brandWebsite`, `brandWhatsapp`, `brandAddress`, `brandSupportEmail`, social links, `invoiceFooterText`.

### Admin Branding Page (`/admin/system?tab=branding`)
Extended with:
- Brand color picker (color input + hex field + live swatch)
- Website URL, Support Email, WhatsApp number, Business Address
- Social links (Twitter/X, Facebook, LinkedIn)
- Invoice & Email footer text
- Save via `PUT /api/admin/branding/settings`

### Email Branding
- `getBrandingVars()` in `email.ts` returns all fields from DB
- `layout()` in `email-templates.ts` uses `{{brand_color}}`, `{{company_name}}`, `{{whatsapp_number}}`, `{{support_url}}`, `{{social_*}}`, `{{website_url}}`
- `renderTemplate` supports Mustache-style `{{#var}}...{{/var}}` and `{{^var}}...{{/var}}` conditionals

### Invoice PDF Branding
- `generateInvoicePdf(data, brandCfg?)` accepts `InvoiceBrandConfig` (`siteName`, `brandColor`, `website`, `supportEmail`)
- All 3 PDF generation calls in `invoices.ts` fetch branding via `fetchPdfBrandConfig()` and pass it
- PDF download filename uses dynamic `siteName` instead of hardcoded "Noehost"

### Invoice Detail Page (`/client/invoices/:id`)
- Dynamic brand color (from `useBranding().primaryColor`)
- Logo shown in invoice header band (if uploaded), otherwise uses `siteName`
- Dynamic "Pay To" section: uses `siteName`, `brandSupportEmail`, `brandAddress`, `brandWebsite`
- Dynamic terms/footer: uses `siteName`, `brandSupportEmail`, `invoiceFooterText`

### Webmail Page
- Dedicated branded webmail launcher at `/client/hosting/:id/webmail`
- Auto-launches webmail in new tab on load for active services
- Uses `primaryColor` brand color, shows service domain info
- Calls `POST /api/client/hosting/:id/email/webmail` for SSO login URL
