import { Globe, Grid3X3, ArrowLeftRight, Server } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminDomains from "./Domains";
import DomainExtensions from "./DomainExtensions";
import AdminDomainTransfers from "./DomainTransfers";
import DomainRegistrars from "./DomainRegistrars";

export default function DomainsMaster() {
  return (
    <MasterPage
      title="Domains"
      description="Manage all domains, TLD extensions, transfers, and registrar connections."
      icon={Globe}
      defaultTab="all"
      tabs={[
        {
          id: "all",
          label: "All Domains",
          icon: Globe,
          desc: "View and manage all registered domains",
          component: AdminDomains,
        },
        {
          id: "extensions",
          label: "TLD Extensions",
          icon: Grid3X3,
          desc: "Configure pricing and settings for domain extensions",
          component: DomainExtensions,
        },
        {
          id: "transfers",
          label: "Domain Transfers",
          icon: ArrowLeftRight,
          desc: "Incoming and outgoing domain transfer requests",
          component: AdminDomainTransfers,
        },
        {
          id: "registrars",
          label: "Registrars",
          icon: Server,
          desc: "Connect and manage domain registrar accounts",
          component: DomainRegistrars,
        },
      ]}
    />
  );
}
