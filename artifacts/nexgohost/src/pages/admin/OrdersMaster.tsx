import { ShoppingCart, FileText, ArrowUpDown } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminOrders from "./Orders";
import AdminInvoices from "./Invoices";
import AdminTransactions from "./Transactions";

export default function OrdersMaster() {
  return (
    <MasterPage
      title="Orders & Billing"
      description="Manage customer orders, invoices, and transaction history."
      icon={ShoppingCart}
      defaultTab="orders"
      tabs={[
        {
          id: "orders",
          label: "Orders",
          icon: ShoppingCart,
          desc: "All customer orders",
          component: AdminOrders,
        },
        {
          id: "invoices",
          label: "Invoices",
          icon: FileText,
          desc: "Generated invoices and payment status",
          component: AdminInvoices,
        },
        {
          id: "transactions",
          label: "Transactions",
          icon: ArrowUpDown,
          desc: "All payment transactions",
          component: AdminTransactions,
        },
      ]}
    />
  );
}
