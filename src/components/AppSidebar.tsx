import {
  CalendarDays,
  ChevronDown,
  Clock,
  FolderKanban,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  ListChecks,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Users,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { getReleaseLabel, isAlphaMode, isModuleEnabled } from "@/lib/releaseMode";
import { type ActiveModuleKey, isRequiredModule } from "@/lib/modules";
import { useUserSettings } from "@/hooks/useUserSettings";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  badgeKey?: string;
};

type NavSection = {
  id: ActiveModuleKey | "training" | "settings";
  title: string;
  url: string;
  icon: typeof Home;
  moduleKey?: ActiveModuleKey;
  matchPrefixes: string[];
  items: NavItem[];
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

const navSections: NavSection[] = [
  {
    id: "home",
    title: "Home",
    url: "/",
    icon: Home,
    moduleKey: "home",
    matchPrefixes: ["/"],
    items: [],
  },
  {
    id: "tasks",
    title: "Tasks",
    url: "/tasks/next",
    icon: ListChecks,
    moduleKey: "tasks",
    matchPrefixes: ["/tasks", "/projects", "/inbox", "/waiting", "/someday"],
    items: [
      { title: "Inbox", url: "/tasks/inbox", icon: Inbox, badgeKey: "inbox_items" },
      { title: "Next Actions", url: "/tasks/next", icon: ListChecks, badgeKey: "tasks_open" },
      { title: "Projects", url: "/tasks/projects", icon: FolderKanban, badgeKey: "projects" },
      { title: "Waiting For", url: "/tasks/waiting", icon: Clock, badgeKey: "waiting_items" },
      { title: "Someday / Maybe", url: "/tasks/someday", icon: Sparkles, badgeKey: "someday_items" },
    ],
  },
  {
    id: "people",
    title: "People",
    url: "/people",
    icon: Users,
    moduleKey: "people",
    matchPrefixes: ["/people"],
    items: [
      { title: "People Directory", url: "/people", icon: Users },
      { title: "Groups", url: "/people/groups", icon: FolderKanban },
    ],
  },
  {
    id: "meetings",
    title: "Meetings",
    url: "/meetings",
    icon: CalendarDays,
    moduleKey: "meetings",
    matchPrefixes: ["/meetings"],
    items: [
      { title: "Meeting Dashboard", url: "/meetings", icon: LayoutGrid },
      { title: "Recurring Meetings", url: "/meetings/recurring", icon: RotateCcw },
    ],
  },
  {
    id: "service_planner",
    title: "Service Planner",
    url: "/service-planner",
    icon: Music,
    moduleKey: "service_planner",
    matchPrefixes: ["/service-planner"],
    items: [
      { title: "Services", url: "/service-planner", icon: CalendarDays },
      { title: "Teams", url: "/service-planner/teams", icon: Users },
      { title: "Repertoire", url: "/service-planner/repertoire", icon: Music },
    ],
  },
  {
    id: "training",
    title: "Training",
    url: "/training",
    icon: GraduationCap,
    matchPrefixes: ["/training"],
    items: [],
  },
  {
    id: "settings",
    title: "Settings",
    url: "/settings",
    icon: SettingsIcon,
    matchPrefixes: ["/settings", "/workspace-settings"],
    items: [
      { title: "Preferences", url: "/settings", icon: SettingsIcon },
      { title: "Workspace", url: "/workspace-settings", icon: Users },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { workspace, role } = useCurrentWorkspace();
  const { isModuleActive } = useUserSettings();
  const [recurringSidebarMeetings, setRecurringSidebarMeetings] = useState<RecurringSidebarMeeting[]>([]);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  const visibleSections = useMemo(
    () =>
      navSections.filter((section) => {
        if (!section.moduleKey) return true;
        return isModuleEnabled(section.moduleKey) && isModuleActive(section.moduleKey);
      }),
    [isModuleActive]
  );

  const inactiveOptionalSections = useMemo(
    () =>
      navSections.filter(
        (section) =>
          section.moduleKey &&
          isModuleEnabled(section.moduleKey) &&
          !isModuleActive(section.moduleKey) &&
          !isRequiredModule(section.moduleKey)
      ),
    [isModuleActive]
  );

  const activeSection = useMemo(
    () =>
      visibleSections.find((section) =>
        section.matchPrefixes.some((prefix) =>
          prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`)
        )
      ),
    [pathname, visibleSections]
  );

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isItemActive = (section: NavSection, item: NavItem) => {
    if (item.url === section.url) return pathname === item.url;
    return isActive(item.url);
  };

  useEffect(() => {
    if (!activeSection) return;
    if (activeSection.items.length === 0) {
      setOpenSections(new Set());
      return;
    }

    setOpenSections(new Set([activeSection.id]));
  }, [activeSection?.id]);

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
      const [inbox, tasksOpen, projects, waiting, someday] = await Promise.all([
        supabase.from("inbox_items").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .or(personalNextActionFilter(currentPerson?.id))
          .eq("complete", false),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("waiting_items").select("id", { count: "exact", head: true }),
        supabase.from("someday_items").select("id", { count: "exact", head: true }),
      ]);

      setCounts({
        inbox_items: inbox.count ?? 0,
        tasks_open: tasksOpen.count ?? 0,
        projects: projects.count ?? 0,
        waiting_items: waiting.count ?? 0,
        someday_items: someday.count ?? 0,
      });
    })();
  }, [user, pathname, currentPerson?.id]);

  const toggleSection = (id: string) => {
    setOpenSections((current) => {
      if (current.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const renderBadge = (item: NavItem) => {
    const count = item.badgeKey ? counts[item.badgeKey] : undefined;
    if (!count) return null;

    return (
      <span className="ml-auto rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-brand-teal-bright">
        {count}
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
              : "flex h-[5.75rem] items-center gap-3 px-3 py-3"
          }
        >
          <NavLink
            to="/"
            className={collapsed ? "flex w-full justify-center" : "flex min-w-0 flex-1 justify-start"}
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
          <SidebarGroupContent data-tour="sidebar-primary-nav">
            {!collapsed && isAlphaMode && (
              <div className="mx-1.5 mb-3 rounded-xl border border-brand-teal/35 bg-brand-teal/15 px-3 py-2 text-sm font-bold text-brand-teal-bright">
                {getReleaseLabel()} Mode
              </div>
            )}

            <SidebarMenu className={collapsed ? "items-center gap-1.5 px-0" : "gap-1.5 px-1"}>
              {visibleSections.map((section) => {
                const SectionIcon = section.icon;
                const sectionActive = section.id === activeSection?.id;
                const hasSubmenu = section.items.length > 0;
                const sectionOpen = !collapsed && openSections.has(section.id);

                return (
                  <SidebarMenuItem
                    key={section.id}
                    className={cn(section.id === "settings" && !collapsed && "mt-3 border-t border-sidebar-border/70 pt-3")}
                  >
                    {collapsed ? (
                      <SidebarMenuButton
                        asChild
                        tooltip={section.title}
                        className={cn(
                          "mx-auto h-10 w-10 justify-center rounded-xl p-0 transition-colors",
                          sectionActive
                            ? "bg-sidebar-accent text-sidebar-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                      >
                        <NavLink to={section.url} className="flex h-full w-full items-center justify-center">
                          <SectionIcon className="h-[18px] w-[18px]" />
                        </NavLink>
                      </SidebarMenuButton>
                    ) : hasSubmenu ? (
                      <>
                        <div
                          className={cn(
                            "flex h-11 w-full items-center overflow-hidden rounded-xl transition-colors",
                            sectionActive
                              ? "bg-brand-teal text-white shadow-[0_10px_24px_rgba(45,140,140,0.22)]"
                              : "text-sidebar-foreground/74 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                          )}
                        >
                          <NavLink
                            to={section.url}
                            className="flex h-full min-w-0 flex-1 items-center gap-3 px-3 text-left"
                          >
                            <SectionIcon className="h-[18px] w-[18px] shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">
                              {section.title}
                            </span>
                          </NavLink>

                          <button
                            type="button"
                            className={cn(
                              "flex h-full w-11 shrink-0 items-center justify-center transition-colors",
                              sectionActive
                                ? "text-white/90 hover:bg-white/10"
                                : "text-sidebar-foreground/45 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground"
                            )}
                            onClick={() => toggleSection(section.id)}
                            aria-label={`${sectionOpen ? "Collapse" : "Expand"} ${section.title} menu`}
                            aria-expanded={sectionOpen}
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 transition-transform",
                                sectionOpen ? "rotate-180" : ""
                              )}
                            />
                          </button>
                        </div>

                        {sectionOpen && (
                          <div className="ml-[1.65rem] mt-1.5 space-y-1 border-l border-sidebar-border/70 pb-1 pl-3">
                            {section.items.map((item) => {
                              const ItemIcon = item.icon;
                              const itemActive = isItemActive(section, item);

                              return (
                                <NavLink
                                  key={item.url}
                                  to={item.url}
                                  className={cn(
                                    "flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition",
                                    itemActive
                                      ? "bg-sidebar-accent/85 text-sidebar-foreground"
                                      : "text-sidebar-foreground/62 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                  )}
                                >
                                  <ItemIcon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/45" />
                                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                  {renderBadge(item)}
                                </NavLink>
                              );
                            })}

                            {section.id === "meetings" && (
                              <div className="space-y-1 pl-7">
                                {recurringSidebarMeetings.length === 0 ? (
                                  <p className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/35">
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
                                        className={cn(
                                          "block truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition",
                                          seriesActive
                                            ? "bg-sidebar-accent/80 text-sidebar-foreground"
                                            : "text-sidebar-foreground/55 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
                                        )}
                                      >
                                        {series.title}
                                      </NavLink>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <NavLink
                        to={section.url}
                        data-tour={section.id === "home" ? "module-menu" : undefined}
                        className={cn(
                          "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors",
                          sectionActive
                            ? "bg-brand-teal text-white shadow-[0_10px_24px_rgba(45,140,140,0.22)]"
                            : "text-sidebar-foreground/74 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                      >
                        <SectionIcon className="h-[18px] w-[18px] shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">
                          {section.title}
                        </span>
                      </NavLink>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {!collapsed && inactiveOptionalSections.length > 0 && (
              <div className="mx-1.5 mt-4 border-t border-sidebar-border/70 pt-3">
                <p className="px-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                  Available Modules
                </p>
                <div className="mt-1 space-y-1">
                  {inactiveOptionalSections.map((section) => {
                    const SectionIcon = section.icon;

                    return (
                      <NavLink
                        key={section.id}
                        to={section.url}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-sidebar-foreground/55 transition hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
                      >
                        <SectionIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{section.title}</span>
                        <span className="rounded-full border border-brand-teal/25 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-teal-bright">
                          Activate
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            )}
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
