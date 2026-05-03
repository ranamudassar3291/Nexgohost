import { useState, useEffect, useRef } from "react";
import {
  Bell, X, Check, CheckCheck, Loader2, Globe, Package,
  FileText, Ticket, Info, RefreshCw, ShieldAlert, CreditCard,
  Sparkles, ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// Per-type visual config
const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  invoice:  { icon: FileText,    color: "#D97706", bg: "#FFFBEB", label: "Billing"   },
  payment:  { icon: CreditCard,  color: "#059669", bg: "#ECFDF5", label: "Payment"   },
  domain:   { icon: Globe,       color: "#2563EB", bg: "#EFF6FF", label: "Domain"    },
  order:    { icon: Package,     color: "#7C3AED", bg: "#F5F3FF", label: "Order"     },
  ticket:   { icon: Ticket,      color: "#DB2777", bg: "#FDF2F8", label: "Support"   },
  hosting:  { icon: RefreshCw,   color: "#0891B2", bg: "#ECFEFF", label: "Hosting"   },
  security: { icon: ShieldAlert, color: "#DC2626", bg: "#FEF2F2", label: "Security"  },
  system:   { icon: Sparkles,    color: "#6366F1", bg: "#EEF2FF", label: "System"    },
};
const DEFAULT_TYPE = { icon: Info, color: "#6B7280", bg: "#F9FAFB", label: "Notice" };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread]           = useState(0);
  const [loading, setLoading]         = useState(false);
  const [, setLocation]               = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchUnread() {
    try {
      const data = await apiFetch("/api/my/notifications/unread-count");
      setUnread(data.unreadCount ?? 0);
    } catch { /* non-fatal */ }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/my/notifications");
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/my/notifications/${id}/read`, { method: "PUT" });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* non-fatal */ }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/my/notifications/read-all", { method: "POST" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* non-fatal */ }
  }

  async function deleteNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await apiFetch(`/api/my/notifications/${id}`, { method: "DELETE" });
      setNotifications(prev => {
        const n = prev.find(x => x.id === id);
        if (n && !n.isRead) setUnread(u => Math.max(0, u - 1));
        return prev.filter(x => x.id !== id);
      });
    } catch { /* non-fatal */ }
  }

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) markRead(n.id);
    if (n.link) { setLocation(n.link); setOpen(false); }
  }

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: "relative",
          width: 36, height: 36,
          borderRadius: 10,
          border: "none",
          background: open ? "#EEF2FF" : "transparent",
          color: open ? "#4F46E5" : "#94A3B8",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { if (!open) { (e.currentTarget as HTMLElement).style.background = "#F8FAFF"; (e.currentTarget as HTMLElement).style.color = "#4F46E5"; } }}
        onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; } }}
      >
        <Bell size={18} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              style={{
                position: "absolute", top: -2, right: -2,
                minWidth: 18, height: 18, padding: "0 4px",
                background: "linear-gradient(135deg, #EF4444, #DC2626)",
                color: "#fff",
                borderRadius: 20,
                fontSize: 10, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
                boxShadow: "0 2px 6px rgba(239,68,68,0.4)",
                lineHeight: 1,
              }}
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{
              position: "absolute", right: 0, top: "calc(100% + 10px)",
              width: 360,
              background: "#fff",
              border: "1px solid #E8EAED",
              borderRadius: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",
              zIndex: 9999,
              overflow: "hidden",
            }}
          >
            {/* ── Header ── */}
            <div style={{
              padding: "14px 18px",
              background: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 10,
                  background: "rgba(255,255,255,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bell size={14} color="#fff" />
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Notifications</span>
                  {unread > 0 && (
                    <span style={{
                      marginLeft: 8, padding: "1px 7px",
                      borderRadius: 20, background: "rgba(255,255,255,0.22)",
                      color: "#fff", fontSize: 10, fontWeight: 800,
                    }}>
                      {unread} unread
                    </span>
                  )}
                </div>
              </div>
              {notifications.some(n => !n.isRead) && (
                <button
                  onClick={markAllRead}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.18)",
                    border: "none", cursor: "pointer",
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.28)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.18)"}
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>

            {/* ── Notification list ── */}
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 0" }}>
                  <Loader2 size={22} style={{ color: "#C7D2FE", animation: "spin 1s linear infinite" }} />
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 18,
                    background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                  }}>
                    <Bell size={22} color="#A5B4FC" />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: "0 0 4px" }}>All caught up!</p>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>No notifications right now.</p>
                </div>
              ) : (
                notifications.map((n, idx) => {
                  const cfg = TYPE_CONFIG[n.type] ?? DEFAULT_TYPE;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "13px 16px",
                        borderBottom: idx < notifications.length - 1 ? "1px solid #F9FAFB" : "none",
                        cursor: n.link ? "pointer" : "default",
                        background: n.isRead ? "transparent" : "#FAFBFF",
                        transition: "background 0.15s",
                        position: "relative",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFF"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.isRead ? "transparent" : "#FAFBFF"}
                    >
                      {/* Unread stripe */}
                      {!n.isRead && (
                        <div style={{
                          position: "absolute", left: 0, top: 0, bottom: 0,
                          width: 3, background: "linear-gradient(180deg,#6366F1,#8B5CF6)", borderRadius: "0 2px 2px 0",
                        }} />
                      )}

                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 11,
                        background: cfg.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Icon size={16} color={cfg.color} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{
                              display: "inline-block", padding: "1px 7px", borderRadius: 20,
                              background: cfg.bg, color: cfg.color,
                              fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                              letterSpacing: "0.06em", marginBottom: 3,
                            }}>
                              {cfg.label}
                            </span>
                            <p style={{
                              fontSize: 13, fontWeight: n.isRead ? 600 : 800,
                              color: n.isRead ? "#4B5563" : "#111827",
                              margin: 0, lineHeight: 1.3,
                            }}>
                              {n.title}
                            </p>
                          </div>
                          {/* Actions */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                            {!n.isRead && (
                              <button
                                onClick={e => { e.stopPropagation(); markRead(n.id); }}
                                title="Mark read"
                                style={{ width: 22, height: 22, border: "none", borderRadius: 6, background: "#EEF2FF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366F1" }}
                              >
                                <Check size={11} />
                              </button>
                            )}
                            <button
                              onClick={e => deleteNotification(n.id, e)}
                              title="Dismiss"
                              style={{ width: 22, height: 22, border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#D1D5DB" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; (e.currentTarget as HTMLElement).style.color = "#EF4444"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#D1D5DB"; }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 4px", lineHeight: 1.4 }}>{n.message}</p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "#9CA3AF" }}>{timeAgo(n.createdAt)}</span>
                          {n.link && !n.isRead && (
                            <span style={{ fontSize: 10, color: "#6366F1", fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                              View <ArrowRight size={9} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Footer ── */}
            {notifications.length > 0 && (
              <div style={{
                padding: "10px 16px",
                borderTop: "1px solid #F3F4F6",
                background: "#FAFBFF",
                textAlign: "center",
              }}>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                  Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
