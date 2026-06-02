import {
  ChevronDown,
  LayoutGrid,
  Inbox,
  ListChecks,
  FolderKanban,
  Clock,
  Sparkles,
  RotateCcw,
  Users,
  Home,
  CalendarDays,
  Settings as SettingsIcon,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
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
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { isAlphaMode, isModuleEnabled, getReleaseLabel } from "@/lib/releaseMode";
import { type ActiveModuleKey, getModuleKeyForPath, isRequiredModule } from "@/lib/modules";
import { useUserSettings } from "@/hooks/useUserSettings";
import { personalNextActionFilter } from "@/lib/taskVisibility";

type Item = { title: string; url: string; icon: any; badgeKey?: string; moduleKey?: string };

type ModuleItem = {
  title: string;
  url: string;
  icon: any;
  moduleKey: ActiveModuleKey;
  matchPrefixes?: string[];
};

type RecurringSidebarMeeting = {
  id: string;
  title: string;
  frequency?: string;
};

const RECURRING_MEETINGS_STORAGE_KEY = "actsix_recurring_meetings";

const loadRecurringSidebarMeetings = (): RecurringSidebarMeeting[] => {
  try {
    const items = JSON.parse(localStorage.getItem(RECURRING_MEETINGS_STORAGE_KEY) || "[]");

    return Array.isArray(items)
      ? items
          .filter((item) => item?.id && item?.title)
          .map((item) => ({
            id: item.id,
            title: item.title,
            frequency: item.frequency,
          }))
      : [];
  } catch {
    return [];
  }
};

const homebaseItems: Item[] = [
  { title: "Tasks", url: "/tasks/next", icon: ListChecks, badgeKey: "tasks_open", moduleKey: "tasks" },
  { title: "Meetings", url: "/meetings", icon: CalendarDays, moduleKey: "meetings" },
  { title: "Service Planner", url: "/service-planner", icon: Music, moduleKey: "service_planner" },
  { title: "People", url: "/people", icon: Users, moduleKey: "people" },
];

const meetingItems: Item[] = [
  { title: "Meeting Dashboard", url: "/meetings", icon: LayoutGrid },
  { title: "Recurring Meetings", url: "/meetings/recurring", icon: RotateCcw },
];

const taskItems: Item[] = [
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

const moduleItems: ModuleItem[] = [
  { title: "Home", url: "/", icon: Home, moduleKey: "home" },
  {
    title: "Tasks",
    url: "/tasks/next",
    icon: ListChecks,
    moduleKey: "tasks",
    matchPrefixes: ["/tasks", "/projects", "/inbox", "/waiting", "/someday"],
  },
  { title: "People", url: "/people", icon: Users, moduleKey: "people", matchPrefixes: ["/people"] },
  { title: "Meetings", url: "/meetings", icon: CalendarDays, moduleKey: "meetings", matchPrefixes: ["/meetings"] },
  {
    title: "Service Planner",
    url: "/service-planner",
    icon: Music,
    moduleKey: "service_planner",
    matchPrefixes: ["/service-planner"],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { workspace, role } = useCurrentWorkspace();
  const { isModuleActive, setModuleActive } = useUserSettings();
  const [recurringSidebarMeetings, setRecurringSidebarMeetings] = useState<RecurringSidebarMeeting[]>([]);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const moduleMenuRef = useRef<HTMLDivElement | null>(null);
  const routeModuleKey = getModuleKeyForPath(pathname);
  const routeModuleActive = isModuleActive(routeModuleKey);

  const inTasksModule = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const inMeetingsModule = pathname === "/meetings" || pathname.startsWith("/meetings/");
  const inServicePlannerModule = pathname === "/service-planner" || pathname.startsWith("/service-planner/");
  const inPeopleModule = pathname === "/people" || pathname.startsWith("/people/");
  const rawItems = !routeModuleActive
    ? homebaseItems
    : inPeopleModule
    ? peopleItems
    : inServicePlannerModule
      ? servicePlannerItems
      : inMeetingsModule
      ? meetingItems
      : inTasksModule
        ? taskItems
        : homebaseItems;

  const items = rawItems.filter((item) =>
    item.moduleKey
      ? isModuleEnabled(item.moduleKey as any) && isModuleActive(item.moduleKey as ActiveModuleKey)
      : true
  );
  const availableModules = moduleItems.filter(
    (item) => isModuleEnabled(item.moduleKey as any) && isModuleActive(item.moduleKey)
  );
  const inactiveOptionalModules = moduleItems.filter(
    (item) =>
      isModuleEnabled(item.moduleKey as any) &&
      !isModuleActive(item.moduleKey) &&
      !isRequiredModule(item.moduleKey)
  );
  const currentModule =
    moduleItems.find((item) => {
      if (item.url === "/") return pathname === "/";
      return item.matchPrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    }) ||
    availableModules.find((item) => item.url === "/") ||
    availableModules[0];
  const CurrentModuleIcon = currentModule?.icon || Home;

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
    if (!moduleMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!moduleMenuRef.current?.contains(event.target as Node)) {
        setModuleMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModuleMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moduleMenuOpen]);

  useEffect(() => {
    setModuleMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const refreshRecurringMeetings = () => {
      setRecurringSidebarMeetings(loadRecurringSidebarMeetings());
    };

    refreshRecurringMeetings();

    window.addEventListener("storage", refreshRecurringMeetings);
    window.addEventListener("actsix-recurring-meetings-updated", refreshRecurringMeetings);

    return () => {
      window.removeEventListener("storage", refreshRecurringMeetings);
      window.removeEventListener("actsix-recurring-meetings-updated", refreshRecurringMeetings);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [inbox, tasksOpen, projects, waiting, someday, reviewAll, reviewDone] =
        await Promise.all([
          supabase.from("inbox_items").select("id", { count: "exact", head: true }),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .or(personalNextActionFilter(currentPerson?.id))
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
  }, [user, pathname, currentPerson?.id]);

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
        <div
          className={
            collapsed
              ? "flex h-20 flex-col items-center justify-center gap-2 px-0 py-2"
              : "flex h-16 items-center gap-2 px-2 py-2"
          }
        >
          <NavLink
            to="/"
            className={collapsed ? "flex w-full justify-center" : "flex min-w-0 flex-1 justify-center"}
            title="Home"
            aria-label="Go home"
          >
            <Logo compact={collapsed} />
          </NavLink>

          <button
            type="button"
            className={
              collapsed
                ? "flex h-7 w-7 items-center justify-center rounded-lg border border-sidebar-border/80 bg-sidebar-accent/35 text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/80 bg-sidebar-accent/35 text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        <SidebarGroup>
          <div
            ref={moduleMenuRef}
            className={collapsed ? "relative mb-2 flex justify-center px-0" : "relative mb-3 px-1.5"}
          >
            <button
              type="button"
              data-tour="module-menu"
              className={
                collapsed
                  ? "flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border/80 bg-sidebar-accent/45 text-sidebar-foreground outline-none ring-brand-teal/25 transition hover:bg-sidebar-accent focus-visible:ring-4"
                  : "flex h-10 w-full items-center gap-2.5 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/35 px-2.5 text-left text-sidebar-foreground outline-none ring-brand-teal/25 transition hover:bg-sidebar-accent/60 focus-visible:ring-4"
              }
              onClick={() => setModuleMenuOpen((open) => !open)}
              title="Switch module"
              aria-label="Switch module"
              aria-expanded={moduleMenuOpen}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-teal/15 text-brand-teal-bright">
                <CurrentModuleIcon className="h-3.5 w-3.5" />
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {currentModule?.title || "Home"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-sidebar-foreground/55 transition-transform ${
                      moduleMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </>
              )}
            </button>

            {moduleMenuOpen && (
              <div
                className={
                  collapsed
                    ? "fixed left-16 top-[5.75rem] z-[1000] w-60 rounded-xl border border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-card"
                    : "fixed left-2 top-[5.75rem] z-[1000] w-52 rounded-xl border border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-card"
                }
              >
                <div className="border-b border-sidebar-border/70 px-3 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                    Switch Module
                  </p>
                </div>

                <div className="p-1">
                  {availableModules.map((item) => {
                    const Icon = item.icon;
                    const active = item.title === currentModule?.title;

                    return (
                      <button
                        key={item.url}
                        type="button"
                        className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition ${
                          active
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground"
                        }`}
                        onClick={() => {
                          setModuleMenuOpen(false);
                          navigate(item.url);
                        }}
                      >
                        {active && (
                          <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-brand-teal-bright" />
                        )}
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            active
                              ? "bg-brand-teal/20 text-brand-teal-bright"
                              : "bg-sidebar-accent/45 text-sidebar-foreground/60"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </button>
                    );
                  })}

                  {inactiveOptionalModules.length > 0 && (
                    <div className="mt-1 border-t border-sidebar-border/70 pt-1">
                      {inactiveOptionalModules.map((item) => {
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.url}
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-sidebar-foreground/55 transition hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
                            onClick={async () => {
                              await setModuleActive(item.moduleKey, true);
                              setModuleMenuOpen(false);
                              navigate(item.url);
                            }}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/35 text-sidebar-foreground/45">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            <span className="rounded-full border border-brand-teal/25 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-teal-bright">
                              Activate
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <SidebarGroupContent data-tour="sidebar-primary-nav">
            {!collapsed && isAlphaMode && (
              <div className="mx-1.5 mb-3 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-3 py-2 text-xs font-bold text-brand-teal-bright">
                {getReleaseLabel()} Mode
              </div>
            )}

            <SidebarMenu className={collapsed ? "items-center gap-1.5 px-0" : "gap-0.5 px-1"}>
              {items.map((item) => {
                const active = isActive(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={`${collapsed ? "mx-auto h-10 w-10 justify-center rounded-xl p-0" : "h-9 rounded-lg"} transition-colors ${
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      }`}
                    >
                      <NavLink
                        to={item.url}
                        className={collapsed ? "flex h-full w-full items-center justify-center" : "flex items-center gap-2.5"}
                      >
                        <span
                          className={`flex ${collapsed ? "h-8 w-8 rounded-xl" : "h-6 w-6 rounded-md"} items-center justify-center ${
                            active
                              ? "bg-brand-teal/20 text-brand-teal-bright"
                              : "bg-sidebar-accent/40 text-sidebar-foreground/60"
                          }`}
                        >
                          <item.icon className={collapsed ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} />
                        </span>

                        {!collapsed && <span className="text-sm">{item.title}</span>}
                        {renderBadge(item)}
                      </NavLink>
                    </SidebarMenuButton>

                    {!collapsed && inMeetingsModule && item.url === "/meetings/recurring" && (
                      <div className="ml-8 mt-1 space-y-1 border-l border-sidebar-border/70 pl-3">
                        {recurringSidebarMeetings.length === 0 ? (
                          <p className="px-2 py-1.5 text-xs text-sidebar-foreground/35">
                            No recurring meetings yet
                          </p>
                        ) : (
                          recurringSidebarMeetings.map((series) => {
                            const seriesUrl = `/meetings/recurring/${series.id}`;
                            const seriesActive = pathname === seriesUrl;

                            return (
                              <NavLink
                                key={series.id}
                                to={seriesUrl}
                                className={`block truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                                  seriesActive
                                    ? "bg-sidebar-accent/80 text-sidebar-foreground"
                                    : "text-sidebar-foreground/55 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
                                }`}
                              >
                                {series.title}
                              </NavLink>
                            );
                          })
                        )}
                      </div>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className={collapsed ? "items-center gap-1.5 px-0" : "gap-0.5 px-1"}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={`${collapsed ? "mx-auto h-10 w-10 justify-center rounded-xl p-0" : "h-9 rounded-lg"} ${
                    isActive("/settings")
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
                  }`}
                >
                  <NavLink to="/settings" className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-accent/40">
                      <SettingsIcon className={collapsed ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} />
                    </span>
                    {!collapsed && <span className="text-sm">Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-transparent p-2">
        {collapsed ? (
          <div className="flex h-9 items-center justify-center">
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
