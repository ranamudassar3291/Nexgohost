import { db } from "@workspace/db";
import { vpsPlansTable, vpsOsTemplatesTable, vpsLocationsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";

const DEFAULT_PLANS = [
  {
    name: "VPS 1",
    description: "Entry-level KVM server for small projects and testing.",
    price: "1500.00",
    yearlyPrice: "15000.00",
    cpuCores: 2,
    ramGb: 4,
    storageGb: 50,
    bandwidthTb: "4.00",
    virtualization: "KVM",
    features: ["Full Root Access", "DDoS Protection", "Dedicated IP", "99.9% Uptime SLA", "Instant Provisioning"],
    saveAmount: "3000.00",
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "VPS 2",
    description: "Balanced cloud server for growing web applications.",
    price: "2500.00",
    yearlyPrice: "25000.00",
    cpuCores: 4,
    ramGb: 8,
    storageGb: 100,
    bandwidthTb: "8.00",
    virtualization: "KVM",
    features: ["Full Root Access", "DDoS Protection", "Dedicated IP", "99.9% Uptime SLA", "Instant Provisioning"],
    saveAmount: "5000.00",
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "VPS 3",
    description: "High-performance server for demanding workloads and databases.",
    price: "4500.00",
    yearlyPrice: "45000.00",
    cpuCores: 6,
    ramGb: 12,
    storageGb: 200,
    bandwidthTb: "12.00",
    virtualization: "KVM",
    features: ["Full Root Access", "DDoS Protection", "Dedicated IP", "99.9% Uptime SLA", "Instant Provisioning", "Priority Support"],
    saveAmount: "9000.00",
    isActive: true,
    sortOrder: 3,
  },
];

const DEFAULT_OS_TEMPLATES = [
  { name: "Ubuntu", version: "22.04 LTS",      iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420",   isActive: true },
  { name: "Ubuntu", version: "20.04 LTS",      iconUrl: "https://cdn.simpleicons.org/ubuntu/E95420",   isActive: true },
  { name: "Debian", version: "12 Bookworm",    iconUrl: "https://cdn.simpleicons.org/debian/A81D33",   isActive: true },
  { name: "CentOS", version: "7",              iconUrl: "https://cdn.simpleicons.org/centos/262577",   isActive: true },
  { name: "AlmaLinux", version: "9",           iconUrl: "https://cdn.simpleicons.org/almalinux/ACE3B0", isActive: true },
  { name: "Windows Server", version: "2022",   iconUrl: "https://cdn.simpleicons.org/windows/0078D4", isActive: true },
];

const DEFAULT_LOCATIONS = [
  { countryName: "United States", countryCode: "US", flagIcon: "🇺🇸", isActive: true },
  { countryName: "United Kingdom", countryCode: "GB", flagIcon: "🇬🇧", isActive: true },
  { countryName: "Germany",        countryCode: "DE", flagIcon: "🇩🇪", isActive: true },
  { countryName: "Singapore",      countryCode: "SG", flagIcon: "🇸🇬", isActive: true },
];

export async function seedVpsData() {
  try {
    const [planCount] = await db.select({ c: count() }).from(vpsPlansTable);
    if ((planCount?.c ?? 0) === 0) {
      await db.insert(vpsPlansTable).values(DEFAULT_PLANS as any[]);
      console.log(`[VPS] Seeded ${DEFAULT_PLANS.length} default VPS plans`);
    }

    const [osCount] = await db.select({ c: count() }).from(vpsOsTemplatesTable);
    if ((osCount?.c ?? 0) === 0) {
      await db.insert(vpsOsTemplatesTable).values(DEFAULT_OS_TEMPLATES);
      console.log(`[VPS] Seeded ${DEFAULT_OS_TEMPLATES.length} OS templates`);
    }

    const [locCount] = await db.select({ c: count() }).from(vpsLocationsTable);
    if ((locCount?.c ?? 0) === 0) {
      await db.insert(vpsLocationsTable).values(DEFAULT_LOCATIONS);
      console.log(`[VPS] Seeded ${DEFAULT_LOCATIONS.length} locations`);
    }
  } catch (err: any) {
    console.warn("[VPS] Seed failed (non-fatal):", err.message);
  }
}
