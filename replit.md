# Nexgohost (Noehost) — Hosting Management Platform

A production-ready SaaS hosting and domain management platform (similar to WHMCS). Provides full-stack client and admin panels for managing hosting services, domains, billing, support tickets, and more.

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

Backend routes: `artifacts/api-server/src/routes/hosting.ts` (Email, DB, SSH, Node.js, Python, File Manager, Backup Restore, WP Deep-link sections)
Backend helpers: `artifacts/api-server/src/lib/cpanel.ts` (cpanelEmailList/Create/Delete/ChangePassword, cpanelMysqlListDatabases, cpanelSshGetStatus/Enable/Disable, cpanelNodejsList/Create/Action/Delete, cpanelPythonList/Create/Action/Delete, cpanelFilelist/FileGetContent/SaveFile/FileMkdir/FileDelete/FileUpload, cpanelRestoreFullBackup/RestoreDatabase)

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
- **Homepage** (`src/pages/public/Homepage.tsx`) — restored original self-contained page with own navbar, hero, domain checker, pricing, features, testimonials, FAQ, and footer. No external layout wrappers.
- All site components (`SiteNavbar`, `SiteFooter`, `PublicLayout`, `SiteHero`, etc.) were removed from the zip import. Homepage is now fully self-contained.
- CSS variables defined in `:root` in `src/index.css`.

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
- **Unified Billing hub** at `/client/billing` — 5 tabs: Invoices, Transactions, Refunds, Wallet (Credits), Affiliate. Summary cards at top. Old routes `/client/invoices`, `/client/credits`, `/client/affiliate` redirect here.
- **AI Chat Widget** — floating widget for clients (`role === "client"`) in AppLayout. Backend: `POST /api/ai/chat` with `authenticate` middleware. Frontend: `AiChatWidget.tsx` with quick questions, minimize/reset/close, unread badge.

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
