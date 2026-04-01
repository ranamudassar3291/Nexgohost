import { LifeBuoy, BookOpen, Megaphone, ArrowRight, XCircle } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminTickets from "./Tickets";
import KnowledgeBase from "./KnowledgeBase";
import Announcements from "./Announcements";
import AdminMigrations from "./Migrations";
import CancellationRequests from "./CancellationRequests";

export default function SupportMaster() {
  return (
    <MasterPage
      title="Support"
      description="Handle customer tickets, announcements, migrations, and cancellation requests."
      icon={LifeBuoy}
      defaultTab="tickets"
      tabs={[
        {
          id: "tickets",
          label: "Tickets",
          icon: LifeBuoy,
          desc: "Customer support tickets",
          component: AdminTickets,
        },
        {
          id: "knowledge-base",
          label: "Knowledge Base",
          icon: BookOpen,
          desc: "Help articles and documentation",
          component: KnowledgeBase,
        },
        {
          id: "announcements",
          label: "Announcements",
          icon: Megaphone,
          desc: "System-wide announcements",
          component: Announcements,
        },
        {
          id: "migrations",
          label: "Migrations",
          icon: ArrowRight,
          desc: "Account migration requests",
          component: AdminMigrations,
        },
        {
          id: "cancellations",
          label: "Cancellations",
          icon: XCircle,
          desc: "Pending cancellation requests",
          component: CancellationRequests,
        },
      ]}
    />
  );
}
