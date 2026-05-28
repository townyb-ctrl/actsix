import {
  LayoutGrid,
  Inbox,
  ListChecks,
  FolderKanban,
  Clock,
  Sparkles,
  RotateCcw,
  Users,
  CalendarDays,
  Settings as SettingsIcon,
  Music,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { isAlphaMode, isModuleEnabled, getReleaseLabel } from "@/lib/releaseMode";

type Item = { title: string; url: string; icon: any; badgeKey?: string; moduleKey?: string };

const homebaseItems: Item[] = [
  { title: "ACTSIX: Tasks", url: "/tasks", icon: ListChecks, badgeKey: "tasks_open", moduleKey: "tasks" },
  { title: "ACTSIX: Meetings", url: "/meetings", icon: CalendarDays, moduleKey: "meetings" },
  { title: "ACTSIX: Service Planner", url: "/service-planner", icon: Music, moduleKey: "service_planner" },
  { title: "ACTSIX: People", url: "/people", icon: Users, moduleKey: "people" },
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
];

const servicePlannerItems: Item[] = [
  { title: "Services", url: "/service-planner", icon: CalendarDays },
  { title: "Teams", url: "/service-planner/teams", icon: Users },
  { title: "Repertoire", url: "/service-planner/repertoire", icon: Music },
];

const peopleItems: Item[] = [
  { title: "People Directory", url: "/people", icon: Users },
  { title: "Groups", url: "/people/groups", icon: FolderKanban },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { workspace, role } = useCurrentWorkspace();

  const inTasksModule = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const inMeetingsModule = pathname === "/meetings" || pathname.startsWith("/meetings/");
  const inServicePlannerModule = pathname === "/service-planner" || pathname.startsWith("/service-planner/");
  const inPeopleModule = pathname === "/people" || pathname.startsWith("/people/");
  const rawItems = inPeopleModule
    ? peopleItems
    : inServicePlannerModule
      ? servicePlannerItems
      : inMeetingsModule
      ? meetingItems
      : inTasksModule
        ? taskItems
        : homebaseItems;

  const items = rawItems.filter((item) =>
    item.moduleKey ? isModuleEnabled(item.moduleKey as any) : true
  );

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reviewProgress, setReviewProgress] = useState({ done: 0, total: 0 });

  const isActive = (p: string) => {
    if (p === "/") return pathname === "/";
    if (p === "/tasks") return pathname === "/tasks";
    if (p === "/meetings") return pathname === "/meetings";
    if (p === "/service-planner") return pathname === "/service-planner";
    if (p === "/people") return pathname === "/people";
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
        <div className={collapsed ? "flex h-16 items-center justify-center px-0 py-0" : "px-2 py-3"}>
          <Logo compact={collapsed} />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        <SidebarGroup>
          <SidebarGroupContent>
            {!collapsed && isAlphaMode && (
              <div className="mx-1.5 mb-3 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-3 py-2 text-xs font-bold text-brand-teal-bright">
                {getReleaseLabel()} Mode
              </div>
            )}

            <SidebarMenu
              data-tour="sidebar-primary-nav"
              className={collapsed ? "items-center gap-2 px-0" : "gap-1 px-1.5"}
            >
              {items.map((item) => {
                const active = isActive(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`${collapsed ? "mx-auto h-11 w-11 justify-center rounded-xl p-0" : "h-10 rounded-lg"} transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      }`}
                    >
                      <NavLink
                        to={item.url}
                        className={collapsed ? "flex h-full w-full items-center justify-center" : "flex items-center gap-3"}
                      >
                        <span
                          className={`flex ${collapsed ? "h-9 w-9 rounded-xl" : "h-7 w-7 rounded-md"} items-center justify-center ${
                            active
                              ? "bg-brand-teal/20 text-brand-teal-bright"
                              : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                          }`}
                        >
                          <item.icon className={collapsed ? "h-5 w-5" : "h-3.5 w-3.5"} />
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
            <SidebarMenu className={collapsed ? "items-center gap-2 px-0" : "gap-1 px-1.5"}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={`${collapsed ? "mx-auto h-11 w-11 justify-center rounded-xl p-0" : "h-10 rounded-lg"} ${
                    isActive("/settings")
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
                  }`}
                >
                  <NavLink to="/settings" className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-accent/40">
                      <SettingsIcon className={collapsed ? "h-5 w-5" : "h-3.5 w-3.5"} />
                    </span>
                    {!collapsed && <span className="text-sm">Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-transparent p-3">
        {collapsed ? (
          <div className="flex h-10 items-center justify-center">
            <span className="h-3 w-3 rounded-full bg-brand-teal-bright" title="Online" />
          </div>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-sidebar-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-teal-bright" />
              <span>Online</span>
            </div>

            {workspace?.name && (
              <p className="mt-1 truncate text-xs font-bold text-sidebar-foreground/70">
                {workspace.name}
              </p>
            )}

            <p className="mt-1 truncate text-xs text-sidebar-foreground/45">
              {role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : user?.email}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

