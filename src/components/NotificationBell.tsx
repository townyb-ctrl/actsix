import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type Notification = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({
  collapsed = false,
  tone = "sidebar",
}: {
  collapsed?: boolean;
  tone?: "sidebar" | "topbar";
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0 });

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !notification.read_at).length;
  }, [notifications]);

  const loadNotifications = async () => {
    if (!user) return;

    const { data, error } = await (supabase as any)
      .from("notifications")
      .select("id, title, message, type, entity_type, entity_id, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Notification load error:", error.message);
      return;
    }

    setNotifications(data || []);
  };

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, 5000);

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const panelWidth = 360;
      const panelHeight = Math.min(448, window.innerHeight - 32);
      const opensRight = rect.right + panelWidth + 12 <= window.innerWidth;
      const left = opensRight
        ? rect.right + 10
        : Math.max(12, rect.left - panelWidth - 10);
      const top = Math.min(
        Math.max(12, rect.top - 8),
        Math.max(12, window.innerHeight - panelHeight - 12)
      );

      setPanelPosition({ left, top });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user?.id);

    if (error) {
      console.error("Notification read error:", error.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: new Date().toISOString() }
          : notification
      )
    );
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Notification read-all error:", error.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || new Date().toISOString(),
      }))
    );
  };

  const openEntity = async (notification: Notification) => {
    await markAsRead(notification.id);
    setOpen(false);

    if (!notification.entity_type || !notification.entity_id) {
      return;
    }

    switch (notification.entity_type) {
      case "project":
      case "project_task":
        navigate(`/tasks/projects/${notification.entity_id}`);
        return;

      case "task":
        navigate("/tasks/next");
        return;

      case "service":
      case "service_assignment":
        navigate(`/service-planner/services/${notification.entity_id}`);
        return;

      case "person":
        navigate(`/people/${notification.entity_id}`);
        return;

      default:
        console.warn("Unknown notification entity type:", notification.entity_type);
        return;
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={
          tone === "topbar"
            ? "relative flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-soft transition hover:border-brand-teal/35 hover:bg-brand-teal/10 hover:text-brand-teal"
            : `relative flex items-center justify-center rounded-xl transition ${
                collapsed
                  ? "h-11 w-11 bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent"
                  : "h-10 w-full justify-start gap-3 px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`
        }
        onClick={() => {
          setOpen((value) => !value);
          loadNotifications();
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        <span
          className={`relative flex items-center justify-center ${
            tone === "topbar"
              ? "h-8 w-8"
              : "h-7 w-7 rounded-md bg-sidebar-accent/40"
          }`}
        >
          <Bell className={tone === "topbar" || collapsed ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-teal px-1 text-[10px] font-extrabold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>

        {!collapsed && tone === "sidebar" && <span className="text-sm">Notifications</span>}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[1000] w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border/70 bg-card text-foreground shadow-card"
          style={{
            left: panelPosition.left,
            top: panelPosition.top,
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 p-3">
            <div>
              <p className="text-sm font-extrabold text-foreground">
                Notifications
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                {unreadCount} unread
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              title="Mark all as read"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          </div>

          {notifications.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}

          {notifications.length > 0 && (
            <div className="max-h-96 divide-y divide-border/70 overflow-auto bg-card">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`flex w-full gap-3 p-3 text-left transition hover:bg-brand-teal/5 ${
                    notification.read_at ? "opacity-75" : ""
                  }`}
                  onClick={() => openEntity(notification)}
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      notification.read_at ? "bg-border" : "bg-brand-teal"
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-foreground">
                      {notification.title}
                    </span>

                    {notification.message && (
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                        {notification.message}
                      </span>
                    )}

                    <span className="mt-1 block text-[11px] font-medium text-muted-foreground/75">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </span>

                  {notification.entity_id && (
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
