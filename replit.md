# Noehost - Hosting & Client Management Platform

## Recent Changes (Session 23)
- **WHMCS Import — Tickets + Original Numbers**: Added Step 9 (Support Tickets) and hardened all number/date/status preservation:
  - **Tickets**: `GetTickets` (paginated) + `GetTicket` per ticket for message replies. Preserves WHMCS `tid` as ticket_number, status (Open/Closed/Answered/Customer-Reply/On Hold), priority, department, dates, and all reply messages with admin/client sender role.
  - **Original invoice numbers**: `buildInvoiceNumber()` uses WHMCS `invoicenum` if set, else `INV{id}` (zero-padded). Duplicate fallback appends `-W{id}`.
  - **All dates preserved**: Registration, due, expiry, creation dates all exact from WHMCS — no new Date() fallbacks unless WHMCS returns null/0000-00-00.
  - **All statuses preserved**: Services (Active/Suspended/Terminated/Pending), domains (Active/Expired/Redemption/Cancelled), invoices (Paid/Unpaid/Cancelled/Refunded/Collections), tickets (Open/Closed/Answered/Customer-Reply/On Hold).
  - **9-step migration**: TLD Extensions → Hosting Plans → Servers → Clients → Hosting Services → Domains → Orders → Invoices → Tickets
  - **Frontend**: Added `importTickets` option, Tickets counter in live progress grid, Tickets card in final results, updated preview to show ticket count.

## Recent Changes (Session 22)
- **WHMCS Import System** — Full WHMCS-to-Nexgohost migration via API credentials:
  - **Backend** (`artifacts/api-server/src/routes/whmcsImport.ts`):
    - `POST /api/admin/whmcs/test` — Test WHMCS API connection (returns client count)
    - `POST /api/admin/whmcs/preview` — Preview counts of all importable data
    - `POST /api/admin/whmcs/import` — Start async migration job (returns jobId)
    - `GET /api/admin/whmcs/import/:jobId/status` — Poll job progress + live logs
    - `GET /api/admin/whmcs/jobs` — List recent import jobs
    - Full field mapping: WHMCS clients → users, products → hosting_plans, services → hosting_services, domains → domains, invoices → invoices, servers → servers, tickets → tickets + ticket_messages
    - Pagination: fetches ALL records across multiple WHMCS API pages (250/page)
    - Conflict handling: skip or update existing clients by email; onConflictDoNothing for tickets/messages
    - Password: bcrypt $2y$ → $2b$ (same algorithm), MD5 stored as `whmcs_md5:hash` prefix
    - Status/billing cycle mapping: Active→active, Monthly→monthly, Paid→paid, etc.
  - **Frontend** (`artifacts/nexgohost/src/pages/admin/WhmcsImport.tsx`):
    - 5-step professional wizard: Connect → Preview → Configure → Import → Done
    - 9 import steps: TLDs, Plans, Servers, Clients, Services, Domains, Orders, Invoices, Tickets
  - **Navigation**: Added "Migration" section to admin nav → "WHMCS Import" at `/admin/whmcs-import`
  - **App.tsx**: Added WhmcsImport import and route at `/admin/whmcs-import`

## Recent Changes (Session 21)
- **VPS Database Expanded**:
  - `vps_locations` table: Added `city`, `datacenter`, `network_speed`, `latency_ms` columns (ALTER TABLE).
  - Added 9 new locations: Netherlands/Amsterdam, Australia/Sydney, India/Mumbai, Japan/Tokyo, Canada/Toronto, France/Paris, Brazil/São Paulo, Poland/Warsaw, Turkey/Istanbul — now 13 total.
  - Updated original 4 locations with city/datacenter details (Equinix NY5, Telehouse North, DE-CIX Frankfurt, Equinix SG1).
  - Added 9 new OS templates: Ubuntu 24.04 LTS, Debian 11, Fedora 39, OpenSUSE Leap 15.5, FreeBSD 14.0, Kali Linux 2024.1, Oracle Linux 9, Windows Server 2016/2019 — 16 total (after dedup).
  - Added 4 new VPS plans: VPS Starter (1 vCPU/2GB/20GB, Rs.750/mo), VPS 4 (6 vCPU/32GB/400GB, Rs.12000/mo), VPS 5 (8 vCPU/64GB/600GB, Rs.22000/mo), VPS 6 (16 vCPU/128GB/1200GB, Rs.45000/mo) — 7 plans total.
- **VPS Schema** (`lib/db/src/schema/vps.ts`): Added `city`, `datacenter`, `networkSpeed`, `latencyMs` fields to `vpsLocationsTable`.
- **VPS Backend** (`artifacts/api-server/src/routes/vps.ts`): Complete rewrite with new client endpoints:
  - `GET /my/vps-services` — client's VPS services (filtered by plan name)
  - `GET /my/vps-services/:id` — VPS service details with plan specs, location, OS info, simulated stats
  - `GET /my/vps-services/:id/stats` — live stats with slight random variation for real-time feel
  - `POST /my/vps-services/:id/reboot` — reboot action
  - `POST /my/vps-services/:id/power` — power on/off/reset
  - `POST /my/vps-services/:id/reinstall` — OS reinstall with OS template selection
  - `GET/POST/PUT/DELETE /admin/vps-locations` — now includes city/datacenter/networkSpeed/latencyMs fields
- **VpsManage.tsx** (`artifacts/nexgohost/src/pages/client/VpsManage.tsx`): New full Hostinger-style VPS management page at `/client/vps/:id`:
  - Sticky header with server identity, IP, OS, location (flag), status badge (Online/Offline/Provisioning)
  - Power controls: Reboot / Power Off / Power On buttons with confirmation modal
  - 5 tabs: Overview, Console, Backups, Firewall, Settings
  - Overview: 4 resource bars (CPU/RAM/Disk/Bandwidth) with animated progress + live stats polling every 8s
  - Server Details grid (IP, CPU, RAM, Storage, Bandwidth, Network Speed, Uptime)
  - Data Center card (flag, city, datacenter name, network speed, avg latency)
  - OS card with reinstall button → OS reinstall modal (grouped by OS family, shows icons)
  - Network traffic cards (Inbound/Outbound speed and totals)
  - Included Features checklist
  - Console tab: SSH instructions with server IP
  - Backups tab: plan backup details
  - Firewall tab: default rules table with DDoS protection badge
  - Settings tab: Reinstall OS, Hard Reset, Cancel Service actions
- **Client Hosting.tsx**: Updated to split VPS and Web Hosting services into separate sections; VPS services show "Manage VPS" button linking to `/client/vps/:id` with CPU icon badge
- **App.tsx**: Added VpsManage import and `/client/vps/:id` route
- **Public VpsHosting.tsx**: Updated OS and Location strip sections to pull dynamic data from API endpoints `/api/vps-os-templates` and `/api/vps-locations`; shows OS icons, datacenter info, network speeds; trust pills updated to "13 Global Locations, 16 OS Templates"

## Recent Changes (Session 20)
- **VPS Plan Cards — Hostinger-Style Redesign** (`NewOrder.tsx` → `renderStep1Vps()`):
  - Dark purple gradient on the "Most Popular" (middle) card: `linear-gradient(145deg, #7B2FFF, #5010D0, #3D0BA8)`.
  - Prominent **billing toggle** with `-50%` badge floating on the Yearly button.
  - Green "Save up to X%" confirmation message when yearly is active.
  - Each card: strikethrough original monthly price → large `Rs. X,XXX /mo` → billed yearly total → save amount in gold text.
  - Spec chips (vCPUs / RAM / NVMe / Bandwidth) in a 2×2 grid inside each card.
  - Feature list with circular checkmark badges, KVM virtualization tag.
  - CTA button: white on popular card, purple on others. Trust bar below all cards.
- **`?vps_id` / `/order/vps/:planId` Direct Links**:
  - New `initialVpsPlanId` prop on `NewOrder` → auto-selects VPS plan + switches to yearly cycle + jumps to step 2 (OS + location).
  - VPS plans query `enabled` condition updated to also fire when `isVpsDirectLink` is true.
  - `OrderByVpsPlan` component reads `:planId` route param.
  - `OrderByVpsId` component reads `?vps_id` query param (WHMCS-style).
  - Routes registered: `/order/vps/:planId` and `/order/vps?vps_id=UUID`.
- **Public VPS Hosting Page** (`/vps` → `artifacts/nexgohost/src/pages/public/VpsHosting.tsx`):
  - Sticky navbar with Home / VPS Hosting / Order links + Login / Get Started buttons.
  - Full-width dark gradient hero with gradient headline, trust pills, 2 CTAs.
  - Live plan cards fetched from `/api/vps-plans` with billing toggle, save badges, spec chips, features, and "Get Started →" linking to `/order/vps/:planId`.
  - 6-feature grid section, OS templates (6) + global locations (4) two-column panel.
  - Animated FAQ accordion.
  - Dark purple CTA banner + minimal footer.
  - Registered as public route in `App.tsx`.

## Recent Changes (Session 19)
- **Affiliate Program — Full Rebuild (Hostinger-quality)**:
  - **Schema** (`lib/db/src/schema/affiliates.ts`): Added `affiliateGroupCommissionsTable` (per-product-group commission rates), `payoutMethodEnum` (wallet/bank), extended `affiliateWithdrawalsTable` with `payoutMethod`, `accountTitle`, `accountNumber`, `bankName`. DB migrated.
  - **Backend** (`artifacts/api-server/src/routes/affiliates.ts`): Complete rewrite. New endpoints: `GET/PUT /admin/affiliates/settings` (payout threshold + cookie days via `settingsTable`), `GET /admin/affiliates/group-commissions`, `PUT /admin/affiliates/group-commissions/:groupId` (upsert per-group rates), `GET /admin/affiliates/commissions/all`, `GET /admin/affiliates/withdrawals/all`, `PUT /admin/affiliates/commissions/:id/reject` (new), bank withdrawal endpoint, reject/approve/pay withdrawal with admin notes. `GET /affiliate` now returns `settings` + `groupCommissions` alongside existing data.
  - **Checkout commission** (`artifacts/api-server/src/routes/checkout.ts`): Now checks per-group commission from `affiliateGroupCommissionsTable` before falling back to affiliate personal rate.
  - **Client Affiliate.tsx** — Complete redesign: Referral link card with cookie duration shown, 3 stat cards (Available Balance, Pending, Paid Out), 3 traffic cards (Clicks/Signups/Conversions), progress bar to payout threshold, commission rates per group, payout section (Instant Wallet vs Bank/JazzCash form), tabbed history (Commissions/Referrals/Withdrawals).
  - **Admin Affiliates.tsx** — Full rebuild: Stats row, 4-tab layout (Affiliates/Commissions/Withdrawals/Settings). Commissions tab has Approve + Reject buttons. Withdrawals tab shows full bank details + Approve/Reject/Pay dialog with admin notes. Settings tab: global payout threshold, cookie days, per-group commission editor (inline select + value edit).
  - **Register.tsx cookie tracking**: Real browser cookie (30-day default, dynamically set from server `cookieDays` setting) written in addition to localStorage. Cleared on successful registration.

## Recent Changes (Session 18)
- **`/client/orders/new` — Complete Rebuild** (`artifacts/nexgohost/src/pages/client/NewOrder.tsx`): 4-step wizard inside the authenticated client layout.
  - **4-step progress bar** (Choose Service → Choose Plan → Domain & Config → Checkout): Scrollable on mobile, purple active step with ring, grey inactive, check icon for completed steps.
  - **Step 0 — Choose Service**: 3 vertical cards (Web Hosting / Domain Registration / Domain Transfer). White #FFFFFF background, 15px border-radius, purple glow on hover via JS mouse events (since Tailwind can't do arbitrary box-shadow on hover for custom colors). Pre-selected "Most Popular" badge on Web Hosting card with purple border.
  - **Step 1 — Hosting Plans (Hostinger-style 3-column grid)**: Tab selector (Shared/Reseller/VPS), plan cards with "Recommended" badge on middle card, giant `Rs. X,XXX /mo` price in black, billing cycle pills, feature list with purple checkmarks at 10px gap, full-width purple "Get Started" button. Mobile: stacks to 1 per row.
  - **Step 1 — Domain Registration**: Full-width search bar + purple "Check Availability" button. TLD pricing pills shown while idle. Results as **horizontal bars** (Hostinger-style): `domain.com | Available (green badge) | Rs. price | Add to Cart button`.
  - **Step 1 — Transfer**: EPP code form with step-by-step guide panel.
  - **Step 2 — Domain & Config** (after hosting plan selected): Plan confirmation banner, Register/Existing/Skip mode selector, horizontal-bar domain search results, existing domain input.
  - **Sticky Order Summary sidebar** (desktop right, `#FAFAFA` bg + 1px border) + **mobile fixed bottom bar**: Shows Selected Service / Plan / Domain with X remove buttons, PKR total, "Proceed to Checkout" CTA (disabled when empty).
  - **localStorage persistence**: `order_wizard_domain` key stores cart domain across refreshes. CartContext handles hosting plan via `noehost_cart`.
  - **Typography**: `font-family: 'Inter', sans-serif` explicitly applied. All currency via `formatPrice()` from `useCurrency()`.

## Recent Changes (Session 17)
- **Order Wizard — Mobile Responsiveness + Live Order Summary Sidebar**: Full rewrite of `OrderFlow.tsx`.
  - **Progress bar**: Wrapped in `overflow-x-auto` with `min-w-[280px]` so it scrolls horizontally on very small screens rather than wrapping.
  - **Step 0 cards**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — stack vertically on mobile, 2-col on tablet, 3-col on desktop.
  - **All buttons/inputs**: `w-full` on mobile, `sm:w-auto` or `flex-row` on wider screens. Tabs are `overflow-x-auto` scrollable with `whitespace-nowrap`.
  - **Two-column layout**: Steps 1 & 2 (hosting/domain) use `lg:grid-cols-[1fr_300px]` — main content + sidebar. Transfer flow stays single-column.
  - **Desktop sidebar** (`hidden lg:block`): Sticky (`top-20`) right panel with `#F8F9FA` background, border, rounded corners. Shows plan row and/or domain row each with X remove button, running total in PKR (`formatPrice()`), and purple "Continue to Checkout" CTA (disabled when cart empty).
  - **Mobile bottom bar** (`lg:hidden fixed bottom-0`): Compact white bar with truncated item name + total + purple "Checkout" button. Main content has `pb-24` padding to avoid occlusion.
  - **Cart state**: `selectedPlan` (in-memory + CartContext) + `cartDomain: { fullName, price }` (stored in `localStorage` under `order_wizard_domain` key). Both removed via X buttons. Removing plan calls `removeItem()` from CartContext and returns to step 1.
  - **Domain add**: Clicking "Select" in domain search sets `cartDomain` before routing to checkout.

## Recent Changes (Session 16)
- **Multi-step Order Flow `/order`**: New standalone public page (no auth required, no sidebar) at `artifacts/nexgohost/src/pages/public/OrderFlow.tsx`. Registered as a flat route in `App.tsx`.
  - **Step 1 — Choose Service**: 3 big cards (Hosting Services, Register a Domain, Transfer a Domain) with icons, highlights, and CTA buttons.
  - **Step 2a — Hosting Type**: Shared / Reseller / VPS selector cards.
  - **Step 2b — Hosting Plans**: Full plan picker (fetches `/api/packages`, filters by type heuristic), billing cycle toggle, per-plan pricing in PKR, "Most Popular" badge, adds to `CartContext` (localStorage).
  - **Step 2c — Domain Choice** (after plan selected): 3 options — Register New Domain, Use Existing Domain, Skip for Now — all lead to checkout/cart.
  - **Step 2 — Domain Search**: Search bar → shows all TLD pricing from `/api/domains/pricing` (public), period selector (1/2/3 years), "Add to Cart" per TLD. Saves domain name to `sessionStorage` and redirects to `/client/domains`.
  - **Step 2 — Transfer**: Domain name + EPP code form, validation, step-by-step guide, redirects to domain transfers page.
  - **Auth-aware checkout**: If JWT token in `localStorage` → redirect to `/client/cart` or `/client/domains`; if not logged in → redirect to `/register?next=...`.
  - **Progress bar**: 3-step visual (Choose Service → Customize → Checkout) with purple active step, check icons for completed steps.
  - **Design**: Standalone white page, Noehost logo header, `#701AFE` purple brand, gray-50 background, card hover effects with purple border/shadow.

## Recent Changes (Session 15)
- **WordPress Provisioning Flow**: Full Docker-based WordPress auto-installer implemented. `POST /client/hosting/:id/install-wordpress` returns immediately (fire-and-forget) and sets `wpProvisionStatus="queued"`. Background `provisionWordPress()` in `wordpress-provisioner.ts` runs the 5-step sequence: Create database → Create container → Download WordPress → Configure → Run installer. `GET /client/hosting/:id/wordpress-status` polls real-time status and returns credentials on completion.
- **WordPress provisioner steps**: 1) MySQL `CREATE DATABASE`+user grant, 2) `docker run -d wordpress:latest` with env vars, 3) Wait for container health (`/wp-admin/install.php`), 4) `curl POST` WP installer, 5) Save credentials to DB. On failure, error is stored in `wpProvisionError` field.
- **WP schema fields added**: `wpEmail`, `wpSiteTitle`, `wpDbName`, `wpContainerId`, `wpPort`, `wpProvisionStatus`, `wpProvisionStep`, `wpProvisionError`, `wpProvisionedAt` added to `hostingServicesTable` and pushed to DB.
- **Simulation mode**: `WP_SIMULATE=true` env var (set for dev/Replit) runs simulated 5-step provisioning with 2s delays per step. On a real server with Docker+MySQL, remove this flag for real provisioning.
- **ServiceDetail.tsx WordPress UI**: Replaced instant install with step-by-step animated progress UI. Shows numbered steps with active spinner, done checkmarks, and in-progress pulse. Polls every 3s. Shows credential card on success with "Reveal password" button. Shows error + retry on failure. Site title input field before install. Status persists across page refreshes.
- **Env var**: `WP_SIMULATE=true` set for development environment; `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_ROOT_USER`, `MYSQL_ROOT_PASSWORD` for production Docker deployments.

## Recent Changes (Session 14)
- **Notification Bell UI**: `NotificationBell.tsx` component added to client header in `AppLayout.tsx`. Shows unread badge count (polls every 30s), dropdown with per-notification read/delete, "Mark all read" button, type-based icons (domain/order/invoice/ticket/hosting), and relative timestamps. Routes to linked page on click.
- **Notifications wired to events**: `checkout.ts` sends order+invoice notifications on new orders; `tickets.ts` sends notification to client when admin replies; `cron.ts` sends domain renewal/expiry notifications. `createNotification()` helper is fire-and-forget in all routes.
- **Activity Log in Security page**: `Security.tsx` now fetches `/api/my/activity` and displays last 20 actions with success/failure icon, IP address, device type (mobile/desktop), timestamp, and action label. Loading and empty states handled.
- **Notifications route fix**: Moved `/my/notifications/unread-count` and `/my/notifications/read-all` above parameterized `/:id` routes in `notifications.ts` to prevent incorrect route matching. Response field normalized to `unreadCount`.
- **ServiceDetail.tsx — Tab System**: Overview and DNS Manager tabs added. Tab switching preserves component state; DNS tab lazy-loads on first activation.
- **ServiceDetail.tsx — DNS Manager**: Full cPanel DNS zone editor — lists all DNS records in a table (type, name, address, TTL), add/edit/delete records via cPanel UAPI proxy. Edit form pre-fills record values. Gracefully shows error if no cPanel server is configured.
- **ServiceDetail.tsx — Auto-Renew Toggle**: Auto-Renew card added with current status badge and Enable/Disable button. Calls `PUT /api/client/hosting/:id/auto-renew` and optimistically updates UI.

## Recent Changes (Session 13)
- **otplib v13 migration**: `authenticator` singleton removed in otplib v13. Migrated all 2FA code in `auth.ts` to use `TOTP` class with `NobleCryptoPlugin` + `ScureBase32Plugin`, `generateSecret()` standalone, and `verify()` standalone function. All 2FA operations (setup, enable, disable, verify) fully working and tested.
- **Checkout credits fix**: `referenceId` → `invoiceId` corrected in `checkout.ts` credit transaction insert (matches `creditTransactionsTable` schema).
- **Checkout success screen**: Shows "✓ Paid with Credits" badge (green) instead of "Pending Payment" (yellow) when `paidWithCredits` flag is returned from checkout API.
- **2FA verified end-to-end**: Setup (QR + secret), Enable (TOTP verification), Disable (TOTP verification), and login flow all confirmed working.

## Recent Changes (Session 12)
- **Invoice number collision fix**: `generateInvoiceNumber()` in `domains.ts` was generating sequential `INV-YYYY-NNN` but colliding with random-suffix invoices from checkout.ts. Replaced with `INV-YYYY-XXXXXX` (random 6-char alphanumeric suffix) — guaranteed unique, no DB query needed.
- **Domain registration commission**: `POST /api/domains/register` now triggers affiliate commission non-blocking after successful domain creation (same pattern as hosting checkout and domain transfers).
- **Payment gateway management**: Admin can create/edit/delete JazzCash, EasyPaisa, Bank Transfer, and Manual gateways via `PaymentMethods.tsx`. Type-specific settings fields rendered per gateway type. `publicSettings()` filters sensitive fields (API keys, passwords, merchant IDs) before exposing to clients.
- **Invoice payment submission flow**: `POST /api/my/invoices/:id/submit-payment` moves invoice to `payment_pending` status with paymentRef, gatewayId, and notes stored. Duplicate submissions blocked. Admin marks paid via `POST /api/admin/invoices/:id/mark-paid`.
- **Client Domains "Transfers" tab**: Full tab added to `Domains.tsx` showing all transfer requests with status badges (pending/validating/approved/rejected/completed/cancelled), transfer fee, submission date, and Cancel button for pending/validating transfers.

## Recent Changes (Session 11)
- **Affiliate Withdrawal System**: New `affiliateWithdrawalsTable` added to DB schema and pushed. Client can request withdrawals from approved commission balance via `POST /api/affiliate/withdraw`. Validation: requires PayPal email saved, sufficient approved balance. Client can view withdrawal history via `GET /api/affiliate/withdrawals`.
- **Admin Withdrawal Management**: New admin routes — `GET /api/admin/affiliates/withdrawals/all`, `PUT /admin/affiliates/withdrawals/:id/approve`, `/pay`, `/reject`. Admin Affiliates page now has 3 tabs: Affiliates | Commissions | Withdrawals (with pending count badge). Approve → Mark Paid → Reject actions per row.
- **Auto-commission on checkout**: When a referred user (tracked via `affiliateReferralsTable`) completes a hosting order, a commission is automatically created in `affiliateCommissionsTable` (percentage or fixed per affiliate settings). Affiliate's `totalEarnings` and `pendingEarnings` incremented. Referral status updated to `converted`. All non-blocking (fire-and-forget).
- **Domain transfer confirmation email**: `POST /api/domains/transfer` now sends a branded HTML email to the client with domain name, price, status, and step-by-step next-steps instructions. Non-blocking.
- **Client Affiliate page updated**: Shows "Withdrawable Balance" stat, new withdrawal request form, and full withdrawal history table with status, PayPal, admin notes columns.

## Recent Changes (Session 10)
- **DB schema**: Added `orderId` (nullable text) column to `hostingServicesTable` — pushed to DB. Creates a 1-to-1 link between each hosting service and the order that created it.
- **checkout.ts**: Service creation now stores `orderId: order.id` so each service is uniquely linked to its originating order.
- **orders.ts — findServiceForOrder()**: Replaced ambiguous `planId`/`domain` matching with `orderId`-first lookup. Fallback for legacy records (no `orderId`) uses exact domain match scoped to that client only.
- **orders.ts — activate endpoint**: Replaced planId/domain-based service reuse with `orderId` lookup. Always creates a brand-new service (with `orderId`) if none found — guarantees each order gets its own unique cPanel account.
- **hosting.ts — getRenewalAmount()**: New helper. Priority: `renewalPrice` (if set on plan) → cycle-specific price (yearly/quarterly/semiannual) → base monthly price. Fixes bug where `yearlyPrice` was overriding `renewalPrice` when billing cycle was yearly.
- **hosting.ts — getOrderAmount()**: New helper for plan changes/upgrades — uses cycle-specific prices only (no `renewalPrice`), correct for new purchase invoices.
- **hosting.ts — renew endpoint**: Uses `getRenewalAmount` — now always shows the correct renewal price in PKR.
- **hosting.ts — upgrade endpoint**: Uses `getOrderAmount` — correct price for plan change invoices.

## Recent Changes (Session 9)
- **Ticket sender name fix**: Client `TicketDetail.tsx` — updated `Message` interface from `sender: string` to `senderName + senderRole`. Removed hardcoded "You" label; messages now display the actual sender's name (client's real name or admin name). `isStaff` check updated to use `senderRole`.
- **Cart system (Hostinger-style)**: Added `CartContext.tsx` (localStorage-persisted cart). Created `/client/cart` page (Cart.tsx) showing items, billing cycle selector, order summary, and "Proceed to Checkout" button. Updated `NewOrder.tsx` — "Order Now" button replaced with "Add to Cart" (adds to cart → redirects to cart). Cart icon with badge count added to both desktop header and mobile header (client only). Route `/client/cart` added to App.tsx. `CartProvider` wraps the entire app.
- **Email templates upgraded to HTML**: All plain-text default email templates (invoice-created, invoice-paid, order-created, hosting-created, password-reset, ticket-reply, service-suspended, service-cancelled) replaced with professional branded HTML templates. Seeder updated to auto-upgrade existing plain-text templates to HTML on server restart.

## Recent Changes (Session 8)
- **EditPackage.tsx**: Added `renewalPrice` UI field (visible when "Enable Renewal" is toggled on). Admin can now set a custom renewal price per plan.
- **API: cPanel Password Change**: `POST /admin/hosting/:id/change-password` and `POST /client/hosting/:id/change-password` — updates DB and attempts live WHM password change via new `cpanelChangePassword()` in `cpanel.ts`.
- **API: WordPress Installer**: `POST /admin/hosting/:id/install-wordpress` and `POST /client/hosting/:id/install-wordpress` — generates secure WordPress admin credentials, returns login URL. Server-side install requires Softaculous/Installatron.
- **Client ServiceDetail page** (`/client/hosting/:id`): New page showing service overview, resource usage bars, quick access buttons (cPanel SSO, Webmail SSO, Change Password, Install WordPress), inline password change panel, WordPress installer form with credential output, and service action buttons.
- **Client Hosting.tsx**: Added "Manage Service" button to each service card linking to `/client/hosting/:id`.
- **Admin Hosting.tsx**: Added "Password" button per service row; clicking opens a modal to set a new cPanel password (with show/hide toggle).
- **NewOrder.tsx**: Passes `renewalPrice` URL param to checkout when plan has renewal configured.
- **Checkout.tsx**: Reads `renewalPrice` from URL params and displays it in the order summary section.

## Recent Changes (Session 7)
- **PKR currency on AddOrder/AddInvoice/ClientDetail/Hosting**: `formatPrice` applied to all price displays.
- **Checkout: Free domain TLD modal**: Shows TLD selection popup when registering a domain with free domain enabled. Domain inserted to `domainsTable` with "pending" status on checkout.
- **InvoiceDetail.tsx**: Dynamically fetches active payment methods from DB (instead of 3 hardcoded). Falls back to billing email.
- **`renewalPrice` field**: Added to `hostingPlansTable` schema + DB pushed. `packages.ts` API handles it in formatPlan/POST/PUT. `AddPackage.tsx` has form field + submit. `EditPackage.tsx` has form state + submit payload + UI field.
- **TLD Management in admin nav**: `AppLayout.tsx` shows "TLD Management" in Management nav group linking to `/admin/domains/extensions`.

## Recent Changes (Session 6)
- **White/Light Theme**: Complete CSS overhaul in `index.css` — switched from dark navy to clean white/light SaaS theme. Background is off-white (`0 0% 98%`), cards are pure white, primary remains purple (`263 70% 50%`), sidebar is white. `glass-card` utility updated for light mode with box shadows. Grid pattern updated to subtle purple tint.
- **Billing Cycles (Quarterly + Semiannual)**: Added `quarterly_price` and `semiannual_price` columns to `hosting_plans` DB table via SQL migration. Updated Drizzle schema (`lib/db/src/schema/hosting.ts`). Updated `packages.ts` API to include both new fields in `formatPlan()`, and in create/update endpoints using raw SQL for the new columns.
- **Admin AddPackage + EditPackage**: Added quarterly and semiannual price input fields to both admin package forms. Updated billing cycle dropdown to include "Quarterly" and "Semiannual" options. Submit handlers now send all 4 price tiers.
- **Client NewOrder (billing cycle selector)**: `NewOrder.tsx` now shows per-plan billing cycle selector buttons (Monthly/Quarterly/Semiannual/Yearly). Price displayed dynamically based on selected cycle. Checkout receives the correct price + cycle. Only available cycles are shown (based on which prices are configured).
- **Client Hosting Renewal**: Added "Renew Service" button to each hosting service card. Clicking opens a renewal confirmation modal. On confirm, calls `POST /api/client/hosting/:id/renew` which creates an invoice for the appropriate billing cycle. Success state shows invoice number with a "View & Pay Invoice" button.
- **Renewal API**: New `POST /api/client/hosting/:id/renew` endpoint in `hosting.ts` — looks up service + plan, determines amount based on billing cycle, creates invoice with 7-day due date.

## Recent Changes (Session 5)
- **PKR currency formatting**: `CurrencyProvider.tsx` now formats all amounts as `Rs. 1,000.00` (with commas, period after Rs) using `toLocaleString("en-US")`. Other currencies use their symbol with same locale formatting.
- **Homepage pricing**: Public homepage now imports `useCurrency` and renders all plan prices via `formatPrice(plan.price)` — respects the selected currency and exchange rate.
- **Real revenue chart**: `GET /api/admin/dashboard` now computes `revenueByDay` — a 30-day series of actual paid invoice revenue (grouped by date, gaps filled with 0). Admin dashboard replaced `mockChartData` with this real data.
- **Admin dashboard upgraded**: New `newClientsMonth` stat; real AreaChart with currency-formatted tooltip/axis; "Recent Signups" sidebar panel; improved stat cards with trend subtitles; bottom quick-stats row.
- **Admin sidebar grouped navigation**: AppLayout sidebar now organizes 25+ admin nav items into 7 collapsible groups (Overview, Management, Support, Commerce, Infrastructure, Analytics & Logs, System) with animated expand/collapse.
- **Currency across all pages**: Replaced all hardcoded `$X.XX` with `formatPrice()` from `useCurrency` hook in: Admin Invoices, Admin Reports, Client Invoices, Client Dashboard.
- **Admin Invoices enhanced**: Better stat cards with icons; invoice count badges on filter tabs; overdue count display; improved empty state.
- **Admin Reports rebuilt**: Now uses real data from `/api/admin/dashboard` (not a mock structure); shows `totalRevenue`, `monthlyRevenue`, and `recentOrders` with proper currency formatting.

## Recent Changes (Session 4)
- **Logout fix**: `queryClient.clear()` is now called on logout to immediately purge all cached auth data
- **Admin Orders: Activate button**: `POST /admin/orders/:id/activate` provisions the hosting service, creates a service record if missing, marks invoice paid, updates order to approved+paid — shows modal with cPanel/Webmail credentials
- **Admin Orders: Quick Access column**: cPanel (orange) and Webmail (blue) quick-login links appear inline for approved hosting orders with active services
- **Client Dashboard: Active Services section**: Shows active hosting services with cPanel and Webmail quick-access buttons (fetched from `/api/client/hosting`)
- **Checkout Step 2: RDAP domain availability**: Typing a domain auto-triggers availability check (800ms debounce) via `/api/domains/availability`; shows green "available" or red "already registered" status; also has manual search button
- **queryClient extracted**: Moved to `artifacts/nexgohost/src/lib/query-client.ts` so AuthProvider can call `queryClient.clear()` on logout

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

- **Admin**: `admin@noehost.com` / `admin123`
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
- `POST /api/auth/register` — Register new client (sends email verification code)
- `POST /api/auth/login` — Login; returns `requires2FA: true` + `tempToken` if 2FA is enabled
- `GET /api/auth/me` — Get current user (includes `emailVerified`, `twoFactorEnabled`)
- `POST /api/auth/verify-email` — Verify email with 6-digit code
- `POST /api/auth/resend-verification` — Resend email verification code
- `POST /api/auth/2fa/setup` — Generate TOTP secret + QR code data URI
- `POST /api/auth/2fa/enable` — Enable 2FA after verifying first TOTP code
- `POST /api/auth/2fa/disable` — Disable 2FA
- `POST /api/auth/2fa/verify` — Verify TOTP during login (uses tempToken → returns final JWT)

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
- `GET /api/admin/product-groups` — All product groups
- `POST /api/admin/product-groups` — Create product group
- `PUT /api/admin/product-groups/:id` — Update product group
- `DELETE /api/admin/product-groups/:id` — Delete product group
- `GET /api/product-groups` — Public: active product groups
- `POST /api/admin/domains` — Add domain manually (admin)
- `PUT /api/admin/domains/:id` — Edit domain (admin, fields: registrar/status/autoRenew/expiryDate/nextDueDate)
- `DELETE /api/admin/domains/:id` — Delete domain
- `GET /api/admin/email-templates` — All email templates (auto-seeds 8 defaults on first load)
- `GET /api/admin/email-templates/:id` — Single email template
- `POST /api/admin/email-templates` — Create email template
- `PUT /api/admin/email-templates/:id` — Update email template (incl. isActive toggle)
- `DELETE /api/admin/email-templates/:id` — Delete email template
- `POST /api/admin/hosting/:id/suspend` — Suspend hosting service
- `POST /api/admin/hosting/:id/unsuspend` — Unsuspend hosting service
- `POST /api/admin/hosting/:id/terminate` — Terminate hosting service
- `POST /api/admin/hosting/:id/cancel` — Approve client cancellation request
- `PUT /api/admin/hosting/:id` — General update (status/cancelRequested/nextDueDate/billingCycle/sslStatus/etc.)

### Client
- `GET /api/packages` — Public list of active hosting packages
- `GET /api/payment-methods` — Active payment methods (no secrets)
- `GET /api/promo-codes/validate?code=X&amount=Y` — Validate promo + compute discount
- `POST /api/client/checkout` — Place order + generate invoice (with promo support)
- `GET /api/client/hosting` — Client's hosting services (direct fetch — no api-client-react)
- `POST /api/client/hosting/:id/cancel-request` — Submit cancellation request
- `GET /api/my/domains` — Client's domains
- `GET /api/invoices` — Client's invoices
- `GET /api/my/invoices/:id` — Single invoice detail for client
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
- `/admin/product-groups` — Product group management
- `/admin/email-templates` — Email template CRUD with inline editor, variable detection, and preview mode (8 templates seeded by default)
- `/admin/settings` — Settings page

### Client Portal (`/client/*`)
- `/client/dashboard` — Welcome + stats overview
- `/client/hosting` — Hosting service cards with cPanel/Webmail login buttons, SSL status, disk/bandwidth usage bars, billing cycle, next due date, and cancel service request
- `/client/domains` — Registered domains + Order New Domain (with RDAP search, cart, checkout)
- `/client/invoices` — Invoice list (clickable rows) with View + Pay buttons
- `/client/invoices/:id` — Professional invoice detail page: company header, line items table, totals, payment instructions (bank/PayPal/manual), print support
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

Tables: `users`, `hosting_plans`, `hosting_services`, `domains`, `domain_pricing`, `orders`, `invoices`, `transactions`, `tickets`, `ticket_messages`, `migrations_requests`, `promo_codes`, `payment_methods`, `domain_extensions`, `currencies`, `servers`, `product_groups`, `email_templates`

**hosting_plans module fields**: `module` (none/cpanel/20i/directadmin/plesk), `moduleServerId` (specific server), `moduleServerGroupId` (group-based server selection — provision picks any active server in the group), `modulePlanId`, `modulePlanName`

**hosting_services extended fields**: `password`, `serverId`, `billingCycle`, `nextDueDate`, `sslStatus`, `webmailUrl`, `cancelRequested`, `cancelReason`, `cancelRequestedAt`

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

## Google OAuth (Server-Side Flow)

- **Admin config page**: `/admin/settings/google` — Client ID, Client Secret (masked), Allowed Domains, Redirect URI copy button
- **Flow**: Server-side auth code flow (NOT implicit). `GET /api/auth/google/start` → Google → `GET /api/auth/google/callback` → `/google-callback?token=JWT`
- **Callback page**: `/google-callback` — reads token from URL, calls `login()`, redirects to dashboard
- **Settings stored**: `google_client_id`, `google_client_secret`, `google_allowed_domains` in `settings` table
- **Button shown**: Only when BOTH clientId AND clientSecret are configured (`configured: true` from `/api/auth/google/config`)
- **Allowed domains**: Optional comma-separated list; if set, only those email domains may sign in via Google
- **Logging**: All OAuth attempts (start, callback, success, error, blocked) logged to `admin_logs`
- **Error handling**: OAuth errors redirect to `/client/login?error=<code>` with user-friendly messages shown inline

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/nexgohost run dev` — Start frontend
- `pnpm --filter @workspace/db run push` — Push schema to DB
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from OpenAPI spec
