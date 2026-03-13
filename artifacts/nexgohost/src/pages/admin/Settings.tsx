import { Settings as SettingsIcon, Bell, Shield, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function AdminSettings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-1">Platform configuration and preferences</p>
      </div>

      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg"><Globe className="w-5 h-5 text-primary" /></div>
            <h3 className="font-semibold text-foreground">Company Settings</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Company Name</label>
              <Input defaultValue="Nexgohost" className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Support Email</label>
              <Input defaultValue="support@nexgohost.com" className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Company URL</label>
              <Input defaultValue="https://nexgohost.com" className="bg-background border-border" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Phone Number</label>
              <Input defaultValue="+1-555-0100" className="bg-background border-border" />
            </div>
          </div>
          <Button className="mt-4">Save Changes</Button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Mail className="w-5 h-5 text-blue-400" /></div>
            <h3 className="font-semibold text-foreground">Email Notifications</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: "New Order Notifications", desc: "Get notified when a new order is placed" },
              { label: "New Ticket Notifications", desc: "Get notified when a support ticket is opened" },
              { label: "Payment Received", desc: "Get notified when a payment is received" },
              { label: "Migration Requests", desc: "Get notified for new migration requests" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg"><Shield className="w-5 h-5 text-green-400" /></div>
            <h3 className="font-semibold text-foreground">Security</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: "Two-Factor Authentication", desc: "Require 2FA for admin logins" },
              { label: "Session Timeout", desc: "Auto-logout after 60 minutes of inactivity" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
