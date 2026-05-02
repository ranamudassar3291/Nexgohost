/**
 * Database seeder — idempotent (safe to run multiple times)
 * Seeds: admin user, default currencies, default settings
 * Run: node scripts/seed-db.mjs
 */
import { createRequire } from "module";
import { execSync } from "child_process";

const _require = createRequire(import.meta.url);

// Resolve pg from the pnpm store
const pg = _require(
  new URL(
    "../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js",
    import.meta.url
  ).pathname
);

// Resolve bcryptjs from the pnpm store
const bcrypt = _require(
  new URL(
    "../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs/index.js",
    import.meta.url
  ).pathname
);

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    console.log("🌱 Starting database seed...");

    // ── 1. Admin user ─────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("Admin@123456", 12);

    const { rowCount: adminExists } = await client.query(
      "SELECT 1 FROM users WHERE email = $1",
      ["admin@noehost.com"]
    );

    if (adminExists === 0) {
      await client.query(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, role, status, admin_permission, email_verified, username, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Admin', 'Noehost', 'admin@noehost.com', $1, 'admin', 'active', 'super_admin', true, 'admin', NOW(), NOW())`,
        [passwordHash]
      );
      console.log("✅ Admin user created: admin@noehost.com / Admin@123456");
    } else {
      console.log("⏭  Admin user already exists — skipping");
    }

    // ── 2. Currencies ─────────────────────────────────────────────────────────
    const currencies = [
      { code: "PKR", name: "Pakistani Rupee", symbol: "Rs.", rate: "1.0000", isDefault: true },
      { code: "USD", name: "US Dollar",        symbol: "$",   rate: "0.0036", isDefault: false },
      { code: "GBP", name: "British Pound",    symbol: "£",   rate: "0.0028", isDefault: false },
      { code: "EUR", name: "Euro",             symbol: "€",   rate: "0.0033", isDefault: false },
    ];

    for (const c of currencies) {
      await client.query(
        `INSERT INTO currencies (id, code, name, symbol, exchange_rate, is_default, is_active, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW())
         ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, c.symbol, c.rate, c.isDefault]
      );
    }
    console.log("✅ Default currencies seeded (PKR as default)");

    // ── 3. Settings ───────────────────────────────────────────────────────────
    const settings = [
      ["email_verification_enabled", "false"],
      ["company_name",               "Noehost"],
      ["company_email",              "admin@noehost.com"],
      ["company_phone",              ""],
      ["company_address",            ""],
      ["company_country",            "PK"],
      ["invoice_prefix",             "INV"],
      ["invoice_due_days",           "7"],
      ["tax_enabled",                "false"],
      ["tax_rate",                   "0"],
      ["tax_label",                  "Tax"],
      ["billing_currency",           "PKR"],
      ["wallet_min_deposit",         "270"],
      ["wallet_max_deposit",         "100000"],
      ["whatsapp_enabled",           "false"],
      ["ai_support_enabled",         "false"],
      ["affiliate_enabled",          "false"],
      ["maintenance_mode",           "false"],
      ["new_client_notifications",   "true"],
      ["new_order_notifications",    "true"],
      ["new_ticket_notifications",   "true"],
    ];

    for (const [key, value] of settings) {
      await client.query(
        "INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO NOTHING",
        [key, value]
      );
    }
    console.log("✅ Default settings seeded");

    // ── Summary ───────────────────────────────────────────────────────────────
    const { rows: admins }   = await client.query("SELECT email FROM users WHERE role = 'admin'");
    const { rows: curs }     = await client.query("SELECT code, is_default FROM currencies ORDER BY is_default DESC");
    const { rows: [sCount] } = await client.query("SELECT COUNT(*) AS n FROM settings");

    console.log("\n📊 Database summary:");
    console.log("  Admins:", admins.map(u => u.email).join(", "));
    console.log("  Currencies:", curs.map(c => `${c.code}${c.is_default ? " [DEFAULT]" : ""}`).join(", "));
    console.log("  Settings:", sCount.n, "rows");
    console.log("\n🎉 Seed complete!\n");
    console.log("🔑 Admin credentials:");
    console.log("   URL:      /admin/noe");
    console.log("   Email:    admin@noehost.com");
    console.log("   Password: Admin@123456");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
