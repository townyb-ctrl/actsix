import {
  LayoutGrid,
  Inbox,
  ListChecks,
  FolderKanban,
  House,
  Clock,
  Sparkles,
  RotateCcw,
  ClipboardCheck,
  Calendar,
  Users,
  BarChart3,
  Check,
  ChevronsUpDown,
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
  { title: "ACTSIX: Meetings", url: "/meetings", icon: CalendarDays },
  { title: "ACTSIX: Service Planner", url: "/service-planner", icon: Music },
  { title: "ACTSIX: People", url: "/people", icon: Users },
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

const peopleItems: Item[] = [
  { title: "People Directory", url: "/people", icon: Users },
];

const workspaceItems = [
  { title: "Home", url: "/", icon: House, disabled: false },
  { title: "ACTSIX: Tasks", url: "/tasks", icon: ListChecks, disabled: false },
  { title: "ACTSIX: Meetings", url: "/meetings", icon: CalendarDays, disabled: false },
  { title: "ACTSIX: Service Planner", url: "/service-planner", icon: Music, disabled: false },
  { title: "ACTSIX: People", url: "/people", icon: Users, disabled: false },
  { title: "Sermon Prep — Coming Soon", url: "/sermon-prep", icon: Sparkles, disabled: true },
  { title: "Scripture Tools — Coming Soon", url: "/scripture", icon: ClipboardCheck, disabled: true },
  { title: "Media Tools — Coming Soon", url: "/media", icon: BarChart3, disabled: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const inTasksModule = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const inMeetingsModule = pathname === "/meetings" || pathname.startsWith("/meetings/");
  const inServicePlannerModule = pathname === "/service-planner" || pathname.startsWith("/service-planner/");
  const inPeopleModule = pathname === "/people" || pathname.startsWith("/people/");
  const items = inPeopleModule
    ? peopleItems
    : inServicePlannerModule
      ? servicePlannerItems
      : inMeetingsModule
      ? meetingItems
      : inTasksModule
        ? taskItems
        : homebaseItems;

  const moduleValue = inPeopleModule
    ? "/people"
    : inServicePlannerModule
      ? "/service-planner"
      : inMeetingsModule
      ? "/meetings"
      : inTasksModule
        ? "/tasks"
        : "/";

  const selectedWorkspace =
    workspaceItems.find((item) => item.url === moduleValue) || workspaceItems[0];

  const SelectedWorkspaceIcon = selectedWorkspace.icon;

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
    setWorkspaceOpen(false);
  }, [pathname]);

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
            <div className={collapsed ? "mb-3 flex justify-center px-0" : "px-1.5 mb-3"}>
              {!collapsed ? (
                <div className="px-0">
                  <label className="mb-1.5 block px-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/40">
                    Workspace
                  </label>

                  {moduleValue === "/" ? (
                    <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar px-3 text-sidebar-foreground">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-teal/15 text-brand-teal-bright">
                        <House className="h-3.5 w-3.5" />
                      </span>
                      <span className="block truncate text-sm font-bold">
                        Home
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        className="grid h-11 w-full grid-cols-1 rounded-xl border border-sidebar-border bg-sidebar px-3 text-left text-sidebar-foreground outline-none transition hover:bg-sidebar-accent/45 focus:ring-2 focus:ring-sidebar-ring"
                        onClick={() => setWorkspaceOpen((open) => !open)}
                      >
                        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 pr-7">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-teal/15 text-brand-teal-bright">
                            <SelectedWorkspaceIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="block truncate text-sm font-bold">
                            {selectedWorkspace.title}
                          </span>
                        </span>

                        <ChevronsUpDown className="col-start-1 row-start-1 h-4 w-4 self-center justify-self-end text-sidebar-foreground/45" />
                      </button>

                      {workspaceOpen && (
                        <div className="absolute left-0 right-0 top-12 z-50 max-h-80 overflow-auto rounded-2xl border border-sidebar-border bg-sidebar p-1.5 shadow-xl">
                          {workspaceItems.map((item) => {
                            const active = item.url === moduleValue;
                            const WorkspaceIcon = item.icon;

                            return (
                              <button
                                key={item.url}
                                type="button"
                                disabled={item.disabled}
                                className={`group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                                  active
                                    ? "bg-sidebar-accent text-sidebar-foreground"
                                    : item.disabled
                                      ? "cursor-not-allowed text-sidebar-foreground/30"
                                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                                }`}
                                onClick={() => {
                                  if (item.disabled) return;
                                  setWorkspaceOpen(false);
                                  navigate(item.url);
                                }}
                              >
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                    active
                                      ? "bg-brand-teal/20 text-brand-teal-bright"
                                      : "bg-sidebar-accent/35 text-sidebar-foreground/55"
                                  }`}
                                >
                                  <WorkspaceIcon className="h-3.5 w-3.5" />
                                </span>

                                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                                  {item.title}
                                </span>

                                {active && (
                                  <Check className="h-4 w-4 shrink-0 text-brand-teal-bright" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  title="Go to Homebase"
                  aria-label="Go to Homebase"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-accent/60 p-0 text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <House className="h-5 w-5 shrink-0" />
                </button>
              )}
            </div>

            {!collapsed && (
              <div className="mx-3 mb-3 border-t border-sidebar-border/70" />
            )}

            <SidebarMenu className={collapsed ? "items-center gap-2 px-0" : "gap-1 px-1.5"}>
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
