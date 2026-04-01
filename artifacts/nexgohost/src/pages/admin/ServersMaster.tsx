import { Server, Boxes, Layers, LayoutGrid, MapPin } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import Servers from "./Servers";
import TwentyIAdmin from "./TwentyIAdmin";
import ServerNodes from "./ServerNodes";
import Modules from "./Modules";
import VpsLocations from "./VpsLocations";

export default function ServersMaster() {
  return (
    <MasterPage
      title="Infrastructure"
      description="Manage hosting servers, 20i integration, server nodes, modules, and VPS locations."
      icon={Server}
      defaultTab="servers"
      tabs={[
        {
          id: "servers",
          label: "Servers",
          icon: Server,
          desc: "Hosting server accounts and credentials",
          component: Servers,
        },
        {
          id: "twenty-i",
          label: "20i Management",
          icon: Boxes,
          desc: "Full 20i reseller control — StackUsers, sites, tickets",
          component: TwentyIAdmin,
        },
        {
          id: "server-nodes",
          label: "Server Nodes",
          icon: Layers,
          desc: "Physical server nodes and clusters",
          component: ServerNodes,
        },
        {
          id: "modules",
          label: "Modules",
          icon: LayoutGrid,
          desc: "Control panel module configuration",
          component: Modules,
        },
        {
          id: "vps-locations",
          label: "VPS Locations",
          icon: MapPin,
          desc: "Available VPS datacenter locations",
          component: VpsLocations,
        },
      ]}
    />
  );
}
