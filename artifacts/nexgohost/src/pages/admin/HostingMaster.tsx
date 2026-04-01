import { Globe2, Package, Zap, Server, Cpu } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminHosting from "./Hosting";
import AdminPackages from "./Packages";
import PendingActivations from "./PendingActivations";
import VpsServices from "./VpsServices";
import VpsPlans from "./VpsPlans";

export default function HostingMaster() {
  return (
    <MasterPage
      title="Hosting"
      description="Manage shared hosting services, packages, VPS servers, and pending activations."
      icon={Globe2}
      defaultTab="services"
      tabs={[
        {
          id: "services",
          label: "Hosting Services",
          icon: Globe2,
          desc: "All active hosting accounts",
          component: AdminHosting,
        },
        {
          id: "packages",
          label: "Packages",
          icon: Package,
          desc: "Hosting plans and pricing",
          component: AdminPackages,
        },
        {
          id: "vps-services",
          label: "VPS Services",
          icon: Cpu,
          desc: "Active VPS server instances",
          component: VpsServices,
        },
        {
          id: "vps-plans",
          label: "VPS Plans",
          icon: Server,
          desc: "VPS plan configuration",
          component: VpsPlans,
        },
        {
          id: "pending",
          label: "Pending Activations",
          icon: Zap,
          desc: "Services awaiting manual activation",
          component: PendingActivations,
        },
      ]}
    />
  );
}
