import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface DomainTldResult {
  tld: string;
  available: boolean;
  rdapStatus?: "available" | "taken" | "unknown";
  registrationPrice: number;
  renewalPrice: number;
}

export interface DomainAvailabilityResponse {
  name: string;
  results: DomainTldResult[];
}

export interface DomainRegisterPayload {
  name: string;
  tld: string;
  period?: number;
}

export interface DomainRegisterResponse {
  domain: {
    id: string;
    clientId: string;
    clientName: string;
    name: string;
    tld: string;
    registrationDate: string;
    expiryDate: string;
    status: string;
    autoRenew: boolean;
    nameservers: string[];
  };
  order: {
    id: string;
    clientId: string;
    clientName: string;
    type: string;
    itemName: string;
    amount: number;
    status: string;
    createdAt: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    clientId: string;
    clientName: string;
    amount: number;
    tax: number;
    total: number;
    status: string;
    dueDate: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    createdAt: string;
  };
}

export const useSearchDomainAvailability = (domain: string | null) => {
  return useQuery<DomainAvailabilityResponse>({
    queryKey: ["/api/domains/availability", domain],
    queryFn: () =>
      customFetch<DomainAvailabilityResponse>(`/api/domains/availability?domain=${encodeURIComponent(domain!)}`),
    enabled: !!domain && domain.trim().length > 0,
    staleTime: 60_000,
    retry: false,
  });
};

export const useGetPublicDomainPricing = () => {
  return useQuery({
    queryKey: ["/api/domains/pricing"],
    queryFn: () => customFetch<Array<{ id: string; tld: string; registrationPrice: number; renewalPrice: number; transferPrice: number }>>("/api/domains/pricing"),
    staleTime: 300_000,
  });
};

export const useRegisterDomain = () => {
  const queryClient = useQueryClient();
  return useMutation<DomainRegisterResponse, Error, DomainRegisterPayload>({
    mutationFn: (payload) =>
      customFetch<DomainRegisterResponse>("/api/domains/register", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/dashboard"] });
    },
  });
};
