import { BarChart2, AlertOctagon, Clock, Terminal, Database, Mail, MessageSquare, Shield } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminReports from "./Reports";
import FraudLogs from "./FraudLogs";
import AutomationSettings from "./AutomationSettings";
import ServerLogs from "./ServerLogs";
import AdminBackups from "./Backups";
import EmailMarketing from "./EmailMarketing";
import WhatsAppSettings from "./WhatsAppSettings";
import WhmcsImport from "./WhmcsImport";

export default function AnalyticsMaster() {
  return (
    <MasterPage
      title="Analytics & Operations"
      description="Monitor reports, logs, automation tasks, backups, and communications."
      icon={BarChart2}
      defaultTab="reports"
      tabs={[
        {
          id: "reports",
          label: "Reports",
          icon: BarChart2,
          desc: "Business analytics and reports",
          component: AdminReports,
        },
        {
          id: "fraud-logs",
          label: "Fraud Logs",
          icon: AlertOctagon,
          desc: "Suspicious activity detection",
          component: FraudLogs,
        },
        {
          id: "automation",
          label: "Automation",
          icon: Clock,
          desc: "Cron jobs and scheduled tasks",
          component: AutomationSettings,
        },
        {
          id: "server-logs",
          label: "Server Logs",
          icon: Terminal,
          desc: "Real-time server activity logs",
          component: ServerLogs,
        },
        {
          id: "backups",
          label: "Backups",
          icon: Database,
          desc: "Backup schedules and Google Drive sync",
          component: AdminBackups,
        },
        {
          id: "email-marketing",
          label: "Email Marketing",
          icon: Mail,
          desc: "Bulk email campaigns",
          component: EmailMarketing,
        },
        {
          id: "whatsapp",
          label: "WhatsApp Alerts",
          icon: MessageSquare,
          desc: "WhatsApp notification settings",
          component: WhatsAppSettings,
        },
        {
          id: "whmcs-import",
          label: "WHMCS Import",
          icon: Shield,
          desc: "Import data from WHMCS",
          component: WhmcsImport,
        },
      ]}
    />
  );
}
