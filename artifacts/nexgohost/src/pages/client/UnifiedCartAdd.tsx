import { useEffect, useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useUnifiedCart, type UnifiedCartItem, type BillingCycle } from "@/context/UnifiedCartContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, AlertCircle } from "lucide-react";

export default function UnifiedCartAdd() {
  const { packageId } = useParams<{ packageId: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { addItem } = useUnifiedCart();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!packageId) { setLocation("/cart"); return; }

    const sp = new URLSearchParams(search);
    const typeHint = sp.get("type") ?? undefined;
    const cycleHint = (sp.get("cycle") as BillingCycle | null) ?? undefined;
    const domainHint = sp.get("domain") ?? undefined;

    // Handle /cart/add/domain?type=domain_register&domain=example.com
    // In this case the packageId is the literal word "domain" or a TLD like ".com"
    // Use the domain query param as the actual lookup ID (TLD extension)
    const resolvedId = (packageId === "domain" && domainHint)
      ? `.${domainHint.split(".").pop()}` // extract TLD like ".com" from "example.com"
      : packageId;

    async function lookup() {
      try {
        const params = new URLSearchParams();
        if (typeHint) params.set("type", typeHint);
        const url = `/api/cart/lookup/${encodeURIComponent(resolvedId!)}${params.toString() ? `?${params}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) { setErrorMsg(data.error || "Product not found"); setStatus("error"); return; }

        const item: UnifiedCartItem = {
          productType: data.productType,
          packageId: data.packageId,
          packageName: data.packageName,
          billingCycle: cycleHint || (data.yearlyPrice ? "yearly" : "monthly"),
          monthlyPrice: data.monthlyPrice,
          quarterlyPrice: data.quarterlyPrice ?? null,
          semiannualPrice: data.semiannualPrice ?? null,
          yearlyPrice: data.yearlyPrice ?? null,
          renewalPrice: data.renewalPrice ?? null,
          renewalEnabled: data.renewalEnabled ?? true,
          freeDomainEnabled: data.freeDomainEnabled ?? false,
          freeDomainTlds: data.freeDomainTlds ?? [],
          description: data.description ?? null,
          features: data.features ?? [],
          diskSpace: data.diskSpace ?? null,
          bandwidth: data.bandwidth ?? null,
          emailAccounts: data.emailAccounts ?? null,
          ...(domainHint ? { domainName: domainHint, domainAction: "register" as const, domainPrice: 0 } : {}),
        };

        addItem(item);
        toast({ title: `${data.packageName} added to cart!`, description: "Review your order before checkout." });
        setLocation("/cart");
      } catch (err: any) {
        setErrorMsg(err.message || "Could not load product");
        setStatus("error");
      }
    }

    lookup();
  }, [packageId]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Product not found</h2>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
        <a href="/" className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          Browse Plans
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <ShoppingCart size={24} className="text-primary" />
      </div>
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm font-medium">Adding to cart...</span>
      </div>
    </div>
  );
}
