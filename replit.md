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
- **`guest_cart_items` table**: Same schema but keyed by `guest_session_token` (UUID). Used for guest (unauthenticated) cart persistence in DB.
- **Startup migration**: `artifacts/api-server/src/index.ts` runs `runStartupMigrations()` on startup which safely creates both tables.
- **Cart routes** (`artifacts/api-server/src/routes/cart.ts`):
  - `GET/POST /api/guest/cart` — no auth, uses `guestSessionToken` from body/query
  - `DELETE /api/guest/cart/:planId?token=TOKEN` — remove guest item
  - `POST /api/cart/merge-guest` — auth required, merges guest items into user cart, deletes guest rows
- **CartContext** (`src/context/CartContext.tsx`):
  - Generates `guestSessionToken` UUID on first load, stored in `localStorage["noehost_guest_token"]`
  - `addItem` pushes to `/api/guest/cart` when not logged in
  - `mergeGuestCart()` exported — call it after inline login (NewOrder step 3) to merge without page reload
  - Mount effect auto-merges guest cart when logged in and `noehost_guest_token` exists

## Guest-First Order Flow (Backend-Driven)

- **`/order/add/:packageId`** — public guest order link (NewOrder, `allowGuest=true`). Pre-selects plan by DB ID.
- **`/order/group/:groupId`** — public group-filtered plan listing.
- **`/client/orders/new`** — also public now (`allowGuest=true`) — auth gate is embedded at step 3.
- **`/checkout`** — redirects to `/order` (static NoeCheckout bypassed).
- **Noehost marketing pages** (`SharedHosting`, `WordPressHosting`, `ResellerHosting`): "Order Now" buttons navigate via `window.location.href = /order/add/:planId` — no more local modal.
- **Auth gate in NewOrder step 3**: Inline login/register form. After `authLogin()`, call `mergeGuestCart()` if needed.
- **Login `?next=` param**: CheckoutLayout's "Sign in" link passes `?next=<currentPath>` so post-login redirect returns to checkout.

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

## Central Command Center (`/admin/command-center`)

Full admin control plane for features, config, and live monitoring. Three tabs:

| Tab | What it does |
|---|---|
| **Feature Management** | Master toggle list — enable/disable 8 features (AI Insights, SEO Toolkit, Team Access, IP Unblocker, etc.) globally or per individual client. Per-client overrides take precedence over global defaults. |
| **Dynamic Config** | Edit Health Meter thresholds (CPU/RAM/disk/speed warning+critical levels) and Upselling banner text — all saved to PostgreSQL, no code changes needed. |
| **Live Activity Feed** | Real-time stream (polls every 3s) showing which client used which advanced tool. Filterable by category. |

### New DB tables
- **`feature_flags`** — `(id, feature_key, user_id nullable, enabled, updated_by, updated_at)` with partial unique indexes for global vs per-user
- **`admin_config`** — `(key TEXT PK, value, updated_by, updated_at)` — seeds 12 default values on first load
- **`activity_stream`** — `(id SERIAL, user_id, user_email, user_name, action, meta JSONB, created_at)` — written to by emitActivity()

### New API routes (`artifacts/api-server/src/routes/command-center.ts`)
- `GET /api/admin/command-center/features` — feature catalogue + all flag states
- `PUT /api/admin/command-center/features` — toggle global or per-client
- `GET /api/admin/command-center/config` — all config (seeds defaults on first call)
- `PUT /api/admin/command-center/config/:key` — save single config value
- `PUT /api/admin/command-center/config-bulk` — save many config values at once
- `GET /api/admin/command-center/activity` — activity stream (last 80 events)
- `GET /api/my/features` — client checks which features are enabled for their account

### Activity emitters
`artifacts/api-server/src/lib/activity.ts` exports `emitActivity()` — called from:
- `security.ts` → IP unblock
- `kb.ts` → AI KB suggest
- `tickets.ts` → ticket submit

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

## Power-User Management Suite (Client Panel — ServiceDetail)

### New Sidebar Sections
- **Software** (`NavSection = "software"`) — in Hosting group
- **Environment** (`NavSection = "environment"`) — in Tools group

### SectionSoftware (Software Installers Hub)
- Three installer cards: **WordPress** (manage/install, links to WordPress section), **Ghost** (external setup guide link), **Custom Node.js App** (links to Node.js section)
- Each card shows: icon, name, description, status dot, status badge ("Active", "Guide Available", "Ready"), CTA button
- Softaculous note card at bottom
- WordPress CTA is primary-colored if not installed; outline if already installed

### SectionEnvironment (PHP / Runtime Selector)
- PHP version grid: **7.4, 8.0, 8.1, 8.2, 8.3** — click to apply, current version highlighted + checkmark badge + "Optimized" pill
- Calls `GET /api/client/hosting/:id/php-version` on mount to detect current version
- Calls `POST /api/client/hosting/:id/php-version` with `{ version }` to apply
- Runtime Status table shows PHP/Node.js/Python runtime state with active/inactive dot

### SectionSSL (Redesigned — Toggle Switch)
- Large toggle switch button (green when active) replaces old button
- "Protected" pulse-animated badge when SSL is active
- Force HTTPS toggle (local state, UI only)
- Reinstall/Renew buttons in secondary row when active
- Features grid (6 items): certificate, auto-renewal, 256-bit encryption, padlock, SEO, PCI

### DiskUsageCard (Shared Component)
- Horizontal progress bar card showing Disk + Bandwidth usage
- Color-coded bars: green (<65%), amber (65-85%), red (>85%)
- Shows striped pattern for unlimited plans
- Warning text when storage >85%
- Used at top of **SectionFiles** as a preview card

### PHP Version API (Backend)
- `GET /api/client/hosting/:id/php-version` — detects current PHP version (20i via `twentyiGetPhpVersion`, cPanel via UAPI `LangPHP.php_get_vhost_versions`)
- `POST /api/client/hosting/:id/php-version` — sets PHP version (20i via `twentyiSetPhpVersion`, cPanel via UAPI `LangPHP.php_set_vhost_versions` with `ea-phpXX` mapping)
- `twentyiGetPhpVersion(apiKey, siteId)` added to `artifacts/api-server/src/lib/twenty-i.ts`

### Overview Quick Actions Grid
- Replaced "Backup" + "SSH" shortcuts with **Software** + **Environment** quick-launch tiles

## Elite Client Profile & Notification Center

### DB Table: `user_preferences` (startup migration)
- `user_id TEXT PRIMARY KEY`, `theme TEXT DEFAULT 'light'`, `created_at`, `updated_at`
- Upserted via `ON CONFLICT (user_id) DO UPDATE`

### Backend Routes (`artifacts/api-server/src/routes/user-preferences.ts`)
- `GET /api/my/preferences` — returns `{ theme, memberSince, serviceCount, domainCount, totalServices, vipLevel, vipNext, vipNextAt, vipProgress }`
- `PUT /api/my/preferences` — saves theme to DB

### VIP Loyalty System (based on total active services + domains)
- Starter (0): Gray | Growth (1-2): Blue | Pro (3-5): Purple | Elite (6+): Gold/Amber
- VIP level computed server-side from live hosting + domain counts

### Theme System (`artifacts/nexgohost/src/context/ThemeProvider.tsx`)
- On mount: loads theme from DB (with localStorage fallback)
- On toggle: saves to localStorage + fire-and-forget PUT to DB
- Adds/removes `dark` CSS class on `document.documentElement`
- Exports `{ theme, toggleTheme, setTheme }`

### Redesigned NotificationBell (`artifacts/nexgohost/src/components/NotificationBell.tsx`)
- Full visual overhaul with indigo gradient header, color-coded type icons (invoice=amber, domain=blue, ticket=pink, order=purple, payment=emerald, security=red, system=indigo)
- Per-type pill labels (uppercase), unread left-stripe indicator, animated badge counter
- "All caught up" empty state with illustration
- Mark read/dismiss/mark-all-read — all existing API calls preserved

### Redesigned Account Page (`artifacts/nexgohost/src/pages/client/Account.tsx`)
- **Profile Hero**: gradient banner using VIP tier color, large avatar with initials, name + tier badge, member since stats row (4 columns)
- **VIP Loyalty card**: current tier banner, animated progress bar to next tier, 4-tile tier ladder
- **Appearance section**: Two-card theme picker (Light Mode / Executive Dark), saves to DB
- Existing Personal Info, Username, Change Password sections preserved

### AppLayout Dark Mode (`artifacts/nexgohost/src/components/layout/AppLayout.tsx`)
- Imports `useTheme` to get current theme
- `C` color object: `pageBg`, `headerBg`, `headerBorder`, `headerShadow`, `footerBg`, `footerBorder`, `titleColor`
- Applied to outer wrapper, desktop header, page content area, and footer

## Growth Suite (Client Dashboard → /client/growth)

### DB Table: `seo_scans` (startup migration in `index.ts`)
- Columns: `id`, `user_id`, `domain`, `title`, `meta_description`, `og_title`, `og_description`, `og_image`, `twitter_card`, `twitter_image`, `sitemap_ok`, `robots_ok`, `canonical`, `h1_count`, `https_ok`, `viewport_ok`, `score`, `fetch_ok`, `scanned_at`
- UNIQUE constraint on `(user_id, domain)` — re-scanning updates via `ON CONFLICT DO UPDATE`

### Backend Routes (`artifacts/api-server/src/routes/growth-suite.ts`)
- `POST /api/my/growth/seo-scan` — fetches domain HTML, probes /sitemap.xml + /robots.txt, parses OG/meta tags, scores 0-100, upserts to DB
- `GET /api/my/growth/seo-results` — returns all saved scans for user, ordered by scanned_at
- `GET /api/my/growth/domains` — returns user's active hosting services for domain picker
- `GET /api/my/growth/ad-credits` — sums paid invoice totals (PKR), returns tier eligibility + progress %

### SEO Score Weights (100pts total)
- title: 15 | meta description: 15 | og:title: 10 | og:image: 10 | sitemap: 20 | robots.txt: 10 | canonical: 10 | https: 5 | viewport: 5

### Ad Credit Tiers (PKR)
- Rs. 15,000+ → Silver ($75 credit) | Rs. 45,000+ → Gold ($150) | Rs. 150,000+ → Platinum ($500)

### Frontend (`artifacts/nexgohost/src/pages/client/GrowthSuite.tsx`)
- 3-tab layout: SEO Toolkit / Social Preview / Ad Credits
- **SEO Toolkit**: domain selector (auto-populated from active hosting), ScoreRing SVG gauge, 10-item checklist with pass/fail icons, click-to-expand fix tips, previously scanned domains list
- **Social Preview**: Facebook + Twitter/X card mockup with real OG data from scan, network switcher, OG tag checklist
- **Ad Credits**: eligible badge with tier color, progress bar to next tier, reward tier ladder, informational note
- `ScoreRing`: circular SVG arc colored green/amber/red by score range
- `CheckRow`: expandable row with tip shown on click for failed items

## Secure Team Access (Client Dashboard → /client/team)

### DB Tables (startup migrations in `index.ts`)
- `team_members` — id, owner_user_id, email, name, role, status, created_at, updated_at
  - Roles: `support_only`, `billing_only`, `developer`, `full_access`
  - Unique index on (owner_user_id, email)
- `team_magic_links` — id, owner_user_id, token (unique UUID), label, expires_at, used_at, used_ip, created_at
- `team_access_logs` — id, owner_user_id, actor_email, actor_role, ip_address, action, user_agent, created_at

### Backend Routes (`artifacts/api-server/src/routes/team-access.ts`)
- `GET /api/my/team` — list team members for the account
- `POST /api/my/team` — add member (validates email uniqueness per account)
- `PATCH /api/my/team/:id` — update role
- `DELETE /api/my/team/:id` — remove member
- `GET /api/my/team/magic-links` — list generated access links
- `POST /api/my/team/magic-link` — generate 24h token link
- `DELETE /api/my/team/magic-link/:id` — revoke link
- `GET /api/my/team/access-logs` — security event log (last 50)
- `GET /api/team/verify/:token` — PUBLIC: validates token, logs IP+UA, marks first use

### Frontend (`artifacts/nexgohost/src/pages/client/TeamAccess.tsx`)
- 3-tab layout: Team Members / Magic Links / Access Logs
- **Team Members**: table with avatar initials, role badge (click to change inline), add modal, remove button
- **Magic Links**: generate modal with label + security notice, new link highlighted with copy button, expiry countdown, "Used / Expired" status, IP shown on first open
- **Access Logs**: color-coded event feed (indigo = owner, green = developer), IP + timestamp per row
- `AddMemberModal`: 4-role grid selector with descriptions, email/name fields, duplicate check
- All writes auto-log to `team_access_logs` with actor email, role, IP, action text

## Site Health & Performance Dashboard (Client Dashboard)

### DB: `site_health_snapshots` table (startup migration in `index.ts`)
- Columns: `id`, `service_id`, `user_id`, `uptime_pct`, `ssl_status`, `speed_score`, `cpu_pct`, `ram_pct`, `disk_pct`, `bw_pct`, `recorded_at`
- Indexed on `(service_id, recorded_at DESC)` and `(user_id, recorded_at DESC)`
- Snapshots saved once per 12h per service (idempotent window check)

### Backend Routes (`artifacts/api-server/src/routes/site-health.ts`)
- `GET /api/my/site-health` — returns per-service health metrics + AI recommendation, saves snapshot to DB
- `GET /api/my/site-health/history` — returns 7-day daily series of avg CPU, RAM, speed score
- **Seeded deterministic RNG**: metrics are reproducible per service+day using `sin`-based hash of service ID chars + day-of-year, giving realistic daily variation without actual cPanel polling
- **AI recommendation engine**: rule-based logic checks disk>75%, CPU>65%, RAM>70%, speed<75 → returns tailored upgrade advice; defaults to "Your site is growing!" message

### Frontend (`SiteHealthPanel` in `Dashboard.tsx`)
- Inserted at `{!q && <SiteHealthPanel />}` between stat cards and hosting tiles — hidden during search
- `UptimeGauge`: circular SVG arc gauge, color-coded green/amber/red at 99.5%/98% thresholds
- `Sparkline`: minimal DreamHost-style SVG line+area chart, no external libs, gradient fill, endpoint dot
- SSL badge: green "Active" / amber "None" pill + ShieldCheck icon
- Speed Score: horizontal progress bar + numeric value, color-coded
- CPU sparkline (indigo) + RAM sparkline (green) — 7-day history via `/api/my/site-health/history`
- Multi-service row: if user has 2+ active services, horizontal scroll showing uptime + score per domain
- AI Recommendation box: indigo gradient card, Sparkles icon, dynamic text from API

## Billing & Finance Redesign (Professional SaaS)

### Active Subscriptions Section (Invoices.tsx)
- **Horizontal scrollable cards** shown above billing tabs when user has hosting services
- Each card: plan name, domain (monospace), status pill, billing cycle badge
- **Next Billing Date** row: color-coded countdown (green → amber at ≤7d → red overdue)
- **Usage mini-bars**: Disk (MB/GB) and Bandwidth usage progress bars with smart unit conversion
- **Auto-Renew Toggle**: `ToggleLeft`/`ToggleRight` icons call `PUT /api/client/hosting/:id/auto-renew` with optimistic cache invalidation via `useMutation`
- Manage Service link navigates to `/client/hosting/:id`
- Query key: `["client-hosting-billing"]` fetches `/api/client/hosting`

### Invoice Detail Payment Redesign (InvoiceDetail.tsx)
- Clean section header with brand color icon + amount summary
- **Instant Pay**: Wallet balance shown as large CTA button (green, prominent "Covers full amount" badge)
- **Local / Mobile Wallet group**: JazzCash (orange accent `#f0612e`) + EasyPaisa (green `#3bb54a`) — receiver number displayed in large bold colored text
- **Card & International group**: Safepay (⚡ Instant badge), Stripe, etc.
- Manual proof form: amber warning banner → payment details → phone → TX ID → Submit
- Safepay: dedicated CTA block with amount + redirect button

### Checkout Payment Grouping (Checkout.tsx)
- Payment method section split into labeled groups: **Instant Pay** (wallet), **Local / Mobile Wallet**, **Card & International**, **Other** (Pay Later)
- JazzCash/EasyPaisa show mobile number in brand colors within checkout
- SSL encryption note in header
- Wallet selected state uses emerald border instead of primary

### PDF Generator Branding (invoicePdf.ts)
- `InvoiceBrandConfig` interface extended with `ceoName?: string`
- Footer "Thank you" text uses `siteName` (dynamic, not hardcoded)
- Footer support email uses `supportEmail` (dynamic)
- CEO signature uses `brandCfg?.ceoName || "Muhammad Arslan"` fallback
- CEO title uses dynamic `siteName`: "Founder & CEO, {siteName}"

## Advanced Resource Monitoring & Security Guard

### New client nav section: "Resource Guard" (ServiceDetail.tsx)
- NavSection type extended with `"monitor"` 
- Nav item added to "Security" group with Gauge icon + tooltip
- `SectionMonitor` component with 3 sub-panels: Resource Stats, Security Guard, Performance Cache

### Resource Stats Panel
- 4 animated stat cards: Entry Processes, Inodes, Disk I/O Read, CPU Usage
- Each card: animated CSS bar (color shifts red/amber/green by threshold), 24h sparkline SVG chart
- `AnimatedBar` — CSS transition width animation with glow shadow, color-coded danger thresholds
- `SparkLine` — pure SVG area+line chart with gradient fill, no external library

### Security Guard Panel
- "Scan & Fix Permissions" button — resets folders to 755, files to 644 via cPanel UAPI or 20i API
- Scan history table showing last 5 scans with timestamp, dirs/files fixed, pass/fail dot
- Results saved in `security_scan_logs` PostgreSQL table

### Performance Cache Panel
- `CacheSwitch` toggle component (DreamHost-style pill switch with icon)
- Edge Caching (CDN) and Object Cache (Redis) toggles
- Toggles call 20i `/cdnEdge` and `/objectCache` endpoints, then upsert `hosting_cache_settings` table
- Settings persisted in DB, loaded on every page open

### New Backend: resource-monitor.ts
- `GET /client/hosting/:id/resource-monitor` — fetches live stats from 20i or cPanel, saves snapshot to DB, returns cache settings and 24h history
- `POST /client/hosting/:id/fix-permissions` — calls Fileman::autofix_permissions UAPI (WHM) or 20i fix-permissions, writes to security_scan_logs
- `GET /client/hosting/:id/scan-history` — returns last 10 scans from security_scan_logs
- `GET/POST /client/hosting/:id/cache-settings` — reads/upserts hosting_cache_settings
- Registered in `routes/index.ts`, `requestWithRetry` exported from `lib/twenty-i.ts`

### New PostgreSQL Tables (auto-migrated on startup)
- `resource_usage_logs` — (id, service_id, disk_io_read, disk_io_write, entry_processes, inodes_used, inodes_limit, cpu_pct, recorded_at)
- `security_scan_logs` — (id, service_id, scan_type, result, dirs_fixed, files_fixed, source, scanned_at)
- `hosting_cache_settings` — (service_id PK, edge_cache, object_cache, updated_at)

## One-Click Staging & Cloning

### New client nav section: "Staging & Clone" (ServiceDetail.tsx)
- NavSection type extended with `"staging"`
- Nav item added to "Tools" group with Rocket icon + tooltip
- `SectionStaging` component with 4 panels: progress tracker, active staging card, how-it-works, quick launch builders, sync log history

### StepTracker component
- Animated vertical step list with connector lines between steps
- Each step cycles through: pending (numbered circle) → active (spinning loader + pulse glow + primary color) → done (emerald checkmark with glow shadow)
- Steps are animated sequentially via 550ms/700ms delay loop for visual flair
- Error state shows red X icon

### SuccessBanner component
- Slide-in-from-top emerald banner with glowing green checkmark icon
- Auto-dismisses after 5 seconds or user can close manually

### Staging Lifecycle UI
- Empty state: centered card with Rocket icon, description, "Create Staging Site" CTA, 3-column how-it-works grid (Clone → Test → Deploy)
- Active staging: shows status badge (Ready/Pushed/Creating), clickable staging URL, Open button, two-step "Push to Live" confirm flow, Delete button
- Confirmation guard: clicking Push to Live reveals inline "Are you sure? / Yes, Push / Cancel" to prevent accidents
- Sync log history: last 8 operations with action label, status badge, note, and timestamp

### Website Builder Quick Launch
- 4 builder cards: Elementor (red), Divi (purple), Framer (black), Webflow (indigo)
- Each card links to the builder's site with arrow icon and brand color background tint
- Note about Software section for WordPress installation

### New Backend: staging.ts
- `GET /client/hosting/:id/staging` — fetches staging record + last 20 sync logs from DB
- `POST /client/hosting/:id/staging/create` — clones site via 20i stagingCreate API or cPanel SubDomain + Fileman copy, saves to staging_sites, writes to staging_sync_logs
- `POST /client/hosting/:id/staging/push-to-live` — pushes via 20i stagingPushToLive or cPanel Fileman overwrite, marks status=pushed, logs result
- `DELETE /client/hosting/:id/staging` — removes via 20i or cPanel SubDomain delete, marks status=deleted, logs result
- Graceful simulated fallback for accounts with no configured server
- Registered in `routes/index.ts`

### New PostgreSQL Tables (auto-migrated on startup)
- `staging_sites` — (id, service_id UNIQUE, staging_subdomain, staging_url, status, provider, remote_id, created_at, updated_at)
- `staging_sync_logs` — (id, service_id, action, status, steps_json JSONB, note, logged_at)
