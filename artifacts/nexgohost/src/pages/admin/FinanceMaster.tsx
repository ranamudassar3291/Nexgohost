import { DollarSign, Tag, CreditCard, RefreshCw, Grid, Users2, ArrowLeftRight, Coins } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminPromoCodes from "./PromoCodes";
import AdminPaymentMethods from "./PaymentMethods";
import Currencies from "./Currencies";
import ProductGroups from "./ProductGroups";
import AdminAffiliates from "./Affiliates";
import AdminDomainTransfers from "./DomainTransfers";
import AdminCredits from "./Credits";

export default function FinanceMaster() {
  return (
    <MasterPage
      title="Finance & Commerce"
      description="Manage pricing, payment methods, currencies, affiliates, and customer credits."
      icon={DollarSign}
      defaultTab="promo-codes"
      tabs={[
        {
          id: "promo-codes",
          label: "Promo Codes",
          icon: Tag,
          desc: "Discount and promotional codes",
          component: AdminPromoCodes,
        },
        {
          id: "payment-methods",
          label: "Payment Methods",
          icon: CreditCard,
          desc: "Available payment gateways",
          component: AdminPaymentMethods,
        },
        {
          id: "currencies",
          label: "Currencies",
          icon: RefreshCw,
          desc: "Currency settings and exchange rates",
          component: Currencies,
        },
        {
          id: "product-groups",
          label: "Product Groups",
          icon: Grid,
          desc: "Organize products into groups",
          component: ProductGroups,
        },
        {
          id: "affiliates",
          label: "Affiliates",
          icon: Users2,
          desc: "Affiliate program management",
          component: AdminAffiliates,
        },
        {
          id: "credits",
          label: "Credits",
          icon: Coins,
          desc: "Customer account credits",
          component: AdminCredits,
        },
      ]}
    />
  );
}
