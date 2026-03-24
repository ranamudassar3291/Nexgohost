import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Server, ExternalLink, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const modules = [
  {
    id: "20i",
    name: "20i",
    description: "UK-based web hosting reseller platform with full API integration. Manage hosting accounts, SSL, and packages directly via the 20i reseller API.",
    logo: "20i",
    color: "from-purple-500/20 to-purple-600/10",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    features: [
      "Automated hosting account creation",
      "Account suspend / unsuspend via API",
      "Account termination via API",
      "Let's Encrypt free SSL activation",
      "Fetch packages from reseller portal",
      "StackCP control panel login link",
      "Webmail access link",
      "Full provisioning on order activation",
    ],
    docsUrl: "https://my.20i.com/reseller/apidoc",
    status: "active",
  },
  {
    id: "cpanel",
    name: "cPanel",
    description: "Industry-standard web hosting control panel. Create, suspend, unsuspend, and terminate hosting accounts automatically via WHM API.",
    logo: "cP",
    color: "from-orange-500/20 to-orange-600/10",
    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    features: ["Automated account provisioning", "SSO (Single Sign-On) login", "Account suspension / unsuspension", "SSL certificate automation", "Disk usage monitoring", "MySQL database management"],
    docsUrl: "https://docs.cpanel.net/",
    status: "active",
  },
  {
    id: "directadmin",
    name: "DirectAdmin",
    description: "Lightweight and fast web hosting control panel. Full lifecycle management of hosting accounts via API.",
    logo: "DA",
    color: "from-blue-500/20 to-blue-600/10",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    features: ["Account create / delete", "Bandwidth monitoring", "Domain management", "FTP account control", "Database management"],
    docsUrl: "https://directadmin.com/api.php",
    status: "available",
  },
  {
    id: "plesk",
    name: "Plesk",
    description: "Cross-platform hosting control panel for Linux and Windows servers. Supports automation via Plesk XML API.",
    logo: "PL",
    color: "from-cyan-500/20 to-cyan-600/10",
    badge: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    features: ["Automated account provisioning", "Subscription management", "SSL certificate automation", "WordPress toolkit", "Multi-server support"],
    docsUrl: "https://docs.plesk.com/en-US/obsidian/api-rpc/",
    status: "available",
  },
];

export default function Modules() {
  const [, setLocation] = useLocation();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Modules</h1>
          <p className="text-muted-foreground text-sm">Configure hosting control panel integrations</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/admin/servers")} className="rounded-xl">
          <Server size={16} className="mr-2" />
          Manage Servers
        </Button>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm text-foreground/70">
        Modules connect Noehost to your hosting control panels. Configure your server credentials under <button onClick={() => setLocation("/admin/servers")} className="text-primary hover:underline font-medium">Servers</button>, then the selected module handles account provisioning automatically when orders are approved.
      </div>

      <div className="grid gap-5">
        {modules.map(mod => (
          <div key={mod.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className={`bg-gradient-to-r ${mod.color} p-6 flex items-start gap-5`}>
              <div className="w-14 h-14 rounded-xl bg-background/80 flex items-center justify-center text-lg font-black text-foreground shadow-sm flex-shrink-0">
                {mod.logo}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-foreground">{mod.name}</h2>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${mod.badge}`}>
                    {mod.status === "active" ? "Integrated" : "Available"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{mod.description}</p>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Supported Functions</h3>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {mod.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                    <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setLocation("/admin/servers")} className="bg-primary hover:bg-primary/90">
                  <Server size={15} className="mr-2" />
                  Configure {mod.name} Server
                </Button>
                <a href={mod.docsUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="rounded-xl">
                    <ExternalLink size={14} className="mr-2" />
                    API Docs
                  </Button>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
