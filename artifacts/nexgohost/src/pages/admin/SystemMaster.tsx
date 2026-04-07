import { Settings, Users, Mail, KeyRound, FileCode, Shield, Flame, Webhook, Palette } from "lucide-react";
import { MasterPage } from "@/components/layout/MasterPage";
import AdminSettings from "./Settings";
import AdminUsers from "./AdminUsers";
import EmailTemplates from "./EmailTemplates";
import EmailConfiguration from "./EmailConfiguration";
import GoogleOAuth from "./GoogleOAuth";
import SecuritySettings from "./SecuritySettings";
import Firewall from "./Firewall";
import ApiSettings from "./ApiSettings";
import ApiDocs from "./ApiDocs";
import Branding from "./Branding";

function EmailSettingsWrapper() {
  return (
    <div className="space-y-6">
      <EmailConfiguration />
    </div>
  );
}

export default function SystemMaster() {
  return (
    <MasterPage
      title="System"
      description="Configure platform settings, users, email, security, and API integrations."
      icon={Settings}
      defaultTab="settings"
      tabs={[
        {
          id: "branding",
          label: "Branding",
          icon: Palette,
          desc: "Logo, favicon, and visual identity",
          component: Branding,
        },
        {
          id: "settings",
          label: "Settings",
          icon: Settings,
          desc: "General platform configuration",
          component: AdminSettings,
        },
        {
          id: "admin-users",
          label: "Admin Users",
          icon: Users,
          desc: "Manage administrator accounts",
          component: AdminUsers,
        },
        {
          id: "email-templates",
          label: "Email Templates",
          icon: Mail,
          desc: "Transactional email templates",
          component: EmailTemplates,
        },
        {
          id: "email-config",
          label: "Email Config",
          icon: Webhook,
          desc: "SMTP and email delivery settings",
          component: EmailSettingsWrapper,
        },
        {
          id: "security",
          label: "Security",
          icon: Shield,
          desc: "2FA, login settings, reCAPTCHA",
          component: SecuritySettings,
        },
        {
          id: "firewall",
          label: "Firewall",
          icon: Flame,
          desc: "IP blocking and rate limiting",
          component: Firewall,
        },
        {
          id: "api-settings",
          label: "API Settings",
          icon: KeyRound,
          desc: "API keys and access tokens",
          component: ApiSettings,
        },
        {
          id: "api-docs",
          label: "API Docs",
          icon: FileCode,
          desc: "Developer API documentation",
          component: ApiDocs,
        },
        {
          id: "google-oauth",
          label: "Google OAuth",
          icon: KeyRound,
          desc: "Google Sign-In configuration",
          component: GoogleOAuth,
        },
      ]}
    />
  );
}
