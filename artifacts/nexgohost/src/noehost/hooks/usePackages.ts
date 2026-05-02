import { useState, useEffect } from 'react';

export interface HostingPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  yearlyPrice: number | null;
  quarterlyPrice: number | null;
  semiannualPrice: number | null;
  billingCycle: string;
  groupId: string | null;
  module: string;
  diskSpace: string | null;
  bandwidth: string | null;
  emailAccounts: number | null;
  databases: number | null;
  subdomains: number | null;
  ftpAccounts: number | null;
  isActive: boolean;
  features: string[];
  renewalPrice: number | null;
  freeDomainEnabled: boolean;
}

export interface VpsPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quarterlyPrice: number | null;
  semiannualPrice: number | null;
  yearlyPrice: number | null;
  biennialPrice: number | null;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  bandwidthTb: number | null;
  virtualization: string | null;
  isActive: boolean;
  features: string[];
  sortOrder: number;
}

export interface DomainExtension {
  id: string;
  extension: string;
  registerPrice: number;
  renewalPrice: number;
  transferPrice: number;
  isFreeWithHosting: boolean;
}

async function cachedFetch<T>(key: string, url: string): Promise<T[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function usePackagesByGroup(slug: string) {
  const [plans, setPlans] = useState<HostingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    cachedFetch<HostingPlan>(`pkg-${slug}`, `/api/packages/group/${slug}`)
      .then(setPlans)
      .finally(() => setLoading(false));
  }, [slug]);

  return { plans, loading };
}

export function useVpsPlans() {
  const [plans, setPlans] = useState<VpsPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    cachedFetch<VpsPlan>('vps-plans', '/api/vps-plans')
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading };
}

export function useDomainPricing() {
  const [extensions, setExtensions] = useState<DomainExtension[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    cachedFetch<DomainExtension>('domain-pricing', '/api/domain-extensions')
      .then(setExtensions)
      .finally(() => setLoading(false));
  }, []);

  return { extensions, loading };
}
