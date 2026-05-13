import {
  LayoutGrid,
  Inbox,
  ListChecks,
  FolderKanban,
  Clock,
  Sparkles,
  RotateCcw,
  ClipboardCheck,
  Calendar,
  Users,
  BarChart3,
  CalendarDays,
  Repeat,
  Settings as SettingsIcon,
  Music,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";

type Item = { title: string; url: string; icon: any; badgeKey?: string };

const homebaseItems: Item[] = [
  { title: "ACTSIX: Tasks", url: "/tasks", icon: ListChecks, badgeKey: "tasks_open" },
];

const meetingItems: Item[] = [
  { title: "Meeting Dashboard", url: "/meetings", icon: LayoutGrid },
  { title: "Recurring Meetings", url: "/meetings/recurring", icon: RotateCcw },
];

const taskItems: Item[] = [
  { title: "Tasks Dashboard", url: "/tasks", icon: LayoutGrid },
  { title: "Inbox", url: "/tasks/inbox", icon: Inbox, badgeKey: "inbox_items" },
  { title: "Next Actions", url: "/tasks/next", icon: ListChecks, badgeKey: "tasks_open" },
  { title: "Projects", url: "/tasks/projects", icon: FolderKanban, badgeKey: "projects" },
  { title: "Waiting For", url: "/tasks/waiting", icon: Clock, badgeKey: "waiting_items" },
  { title: "Someday / Maybe", url: "/tasks/someday", icon: Sparkles, badgeKey: "someday_items" },
  { title: "Recurring", url: "/tasks/recurring", icon: RotateCcw },
  { title: "Review", url: "/tasks/review", icon: ClipboardCheck, badgeKey: "review" },
  { title: "Calendar", url: "/tasks/calendar", icon: Calendar },
  { title: "Meetups", url: "/tasks/meetups", icon: Users },
];

const servicePlannerItems: Item[] = [
  { title: "Services", url: "/service-planner", icon: CalendarDays },
  { title: "Teams", url: "/service-planner/teams", icon: Users },
  { title: "Repertoire", url: "/service-planner/repertoire", icon: Music },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const inTasksModule = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const inMeetingsModule = pathname === "/meetings" || pathname.startsWith("/meetings/");
  const inServicePlannerModule = pathname === "/service-planner" || pathname.startsWith("/service-planner/");
  const items = inServicePlannerModule
    ? servicePlannerItems
    : inMeetingsModule
      ? meetingItems
      : inTasksModule
        ? taskItems
        : homebaseItems;

  const moduleValue = inServicePlannerModule
    ? "/service-planner"
    : inMeetingsModule
      ? "/meetings"
      : inTasksModule
        ? "/tasks"
        : "/";

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reviewProgress, setReviewProgress] = useState({ done: 0, total: 0 });

  const isActive = (p: string) => {
    if (p === "/") return pathname === "/";
    if (p === "/tasks") return pathname === "/tasks";
    if (p === "/meetings") return pathname === "/meetings";
    if (p === "/service-planner") return pathname === "/service-planner";
    return pathname.startsWith(p);
  };

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [inbox, tasksOpen, projects, waiting, someday, reviewAll, reviewDone] =
        await Promise.all([
          supabase.from("inbox_items").select("id", { count: "exact", head: true }),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("complete", false),
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("waiting_items").select("id", { count: "exact", head: true }),
          supabase.from("someday_items").select("id", { count: "exact", head: true }),
          supabase.from("review_items").select("id", { count: "exact", head: true }),
          supabase
            .from("review_items")
            .select("id", { count: "exact", head: true })
            .eq("done", true),
        ]);

      setCounts({
        inbox_items: inbox.count ?? 0,
        tasks_open: tasksOpen.count ?? 0,
        projects: projects.count ?? 0,
        waiting_items: waiting.count ?? 0,
        someday_items: someday.count ?? 0,
      });

      setReviewProgress({
        done: reviewDone.count ?? 0,
        total: reviewAll.count ?? 0,
      });
    })();
  }, [user, pathname]);

  const renderBadge = (item: Item) => {
    if (collapsed) return null;

    if (item.title === "Review") {
      return (
        <span className="ml-auto text-[11px] font-bold font-mono text-brand-teal-bright tabular-nums">
          {reviewProgress.done}/{reviewProgress.total}
        </span>
      );
    }

    const c = item.badgeKey ? counts[item.badgeKey] : undefined;
    if (!c) return null;

    return (
      <span className="ml-auto text-[11px] font-bold font-mono text-brand-teal-bright tabular-nums">
        {c}
      </span>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-gradient-sidebar">
      <SidebarHeader className="border-b border-sidebar-border bg-transparent">
        <div className="px-2 py-3">
          <Logo compact={collapsed} />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        <SidebarGroup>

          <SidebarGroupContent>
            <div className="px-1.5 mb-3">
              {!collapsed ? (
                <div className="px-1.5">
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/40">
                    Workspace
                  </label>

                  <select
                    value={moduleValue}
                    onChange={(event) => navigate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-sidebar-border bg-sidebar px-2 text-sm font-semibold text-sidebar-foreground outline-none focus:ring-2 focus:ring-sidebar-ring"
                  >
                    <option value="/">Home</option>
                    <option value="/tasks">ACTSIX: Tasks</option>
                    <option value="/meetings">ACTSIX: Meetings</option>
                    <option value="/service-planner">Service Planner</option>
                    <option value="/service-planning" disabled>Service Planning — Coming Soon</option>
                    <option value="/sermon-prep" disabled>Sermon Prep — Coming Soon</option>
                    <option value="/scripture" disabled>Scripture Tools — Coming Soon</option>
                    <option value="/media" disabled>Media Tools — Coming Soon</option>
                    <option value="/people-care" disabled>People Care — Coming Soon</option>
                  </select>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  title="Go to Homebase"
                  aria-label="Go to Homebase"
                  className="flex h-10 w-full items-center justify-center rounded-lg bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              )}
            </div>

            {!collapsed && (
              <div className="mx-3 mb-3 border-t border-sidebar-border/70" />
            )}

            <SidebarMenu className="gap-1 px-1.5">
              {items.map((item) => {
                const active = isActive(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`h-10 rounded-lg transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      }`}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-md ${
                            active
                              ? "bg-brand-teal/20 text-brand-teal-bright"
                              : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                        </span>

                        {!collapsed && <span className="text-sm">{item.title}</span>}
                        {renderBadge(item)}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={`h-10 rounded-lg ${
                    isActive("/settings")
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
                  }`}
                >
                  <NavLink to="/settings" className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-accent/40">
                      <SettingsIcon className="h-3.5 w-3.5" />
                    </span>
                    {!collapsed && <span className="text-sm">Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-transparent">
        {!collapsed ? (
          <div className="px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal-bright opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-teal-bright" />
              </span>
              <span className="text-xs font-semibold text-sidebar-foreground">
                Online ready
              </span>
            </div>

            <div className="text-[11px] text-sidebar-foreground/50 truncate">
              {user?.email}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <div className="px-2 py-2 flex justify-center">
            <span className="h-2 w-2 rounded-full bg-brand-teal-bright" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
