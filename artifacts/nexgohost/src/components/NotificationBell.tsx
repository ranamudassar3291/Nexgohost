import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, CheckCheck, Loader2, Globe, Package, FileText, Ticket, Info, RefreshCw } from "lucide-react";
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

const typeIcon: Record<string, React.ReactNode> = {
  domain:  <Globe size={14} className="text-blue-400" />,
  order:   <Package size={14} className="text-green-400" />,
  invoice: <FileText size={14} className="text-yellow-400" />,
  ticket:  <Ticket size={14} className="text-purple-400" />,
  hosting: <RefreshCw size={14} className="text-primary" />,
};

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
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    pollRef.current = setInterval(fetchUnread, 30000);
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-primary" />
                <span className="font-semibold text-sm text-foreground">Notifications</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold border border-red-500/20">
                    {unread} new
                  </span>
                )}
              </div>
              {notifications.some(n => !n.isRead) && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex justify-center p-6">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center">
                    <Bell size={18} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0 cursor-pointer transition-colors hover:bg-secondary/40 ${!n.isRead ? "bg-primary/3" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${!n.isRead ? "bg-primary/10" : "bg-secondary/60"}`}>
                      {typeIcon[n.type] ?? <Info size={14} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!n.isRead && (
                            <button
                              onClick={e => { e.stopPropagation(); markRead(n.id); }}
                              className="text-muted-foreground hover:text-primary"
                              title="Mark read"
                            >
                              <Check size={11} />
                            </button>
                          )}
                          <button
                            onClick={e => deleteNotification(n.id, e)}
                            className="text-muted-foreground hover:text-red-400"
                            title="Delete"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
