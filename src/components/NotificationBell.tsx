import { useEffect, useMemo, useState } from "react";
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

export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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
        navigate("/tasks");
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
        type="button"
        className={`relative flex items-center justify-center rounded-xl transition ${
          collapsed
            ? "h-11 w-11 bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent"
            : "h-10 w-full justify-start gap-3 px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        }`}
        onClick={() => {
          setOpen((value) => !value);
          loadNotifications();
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-accent/40">
          <Bell className={collapsed ? "h-5 w-5" : "h-3.5 w-3.5"} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-teal-bright px-1 text-[10px] font-extrabold text-sidebar">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>

        {!collapsed && <span className="text-sm">Notifications</span>}
      </button>

      {open && (
        <div className="absolute bottom-12 left-0 z-50 w-80 overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-sidebar-border p-3">
            <div>
              <p className="text-sm font-extrabold text-sidebar-foreground">
                Notifications
              </p>
              <p className="text-xs text-sidebar-foreground/45">
                {unreadCount} unread
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          </div>

          {notifications.length === 0 && (
            <div className="p-4 text-sm text-sidebar-foreground/50">
              No notifications yet.
            </div>
          )}

          {notifications.length > 0 && (
            <div className="max-h-96 divide-y divide-sidebar-border overflow-auto">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`flex w-full gap-3 p-3 text-left transition hover:bg-sidebar-accent/50 ${
                    notification.read_at ? "opacity-70" : ""
                  }`}
                  onClick={() => openEntity(notification)}
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      notification.read_at ? "bg-sidebar-border" : "bg-brand-teal-bright"
                    }`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-sidebar-foreground">
                      {notification.title}
                    </span>

                    {notification.message && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-sidebar-foreground/55">
                        {notification.message}
                      </span>
                    )}

                    <span className="mt-1 block text-[11px] text-sidebar-foreground/35">
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </span>

                  {notification.entity_id && (
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-sidebar-foreground/35" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
