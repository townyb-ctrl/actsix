import {
  BookOpen,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Users,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { isModuleEnabled } from "@/lib/releaseMode";
import { type ActiveModuleKey } from "@/lib/modules";
import { useUserSettings } from "@/hooks/useUserSettings";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  badgeKey?: string;
  /** Reviewed periodically rather than daily — folded behind "More" by default. */
  secondary?: boolean;
};

type NavSection = {
  id: ActiveModuleKey | "training" | "settings";
  title: string;
  url: string;
  icon: typeof Home;
  moduleKey?: ActiveModuleKey;
  matchPrefixes: string[];
  items: NavItem[];
  /** Groups related modules under a shared label so the top level never reads as one flat list. */
  group?: "Ministry Work" | "Planning" | "Content";
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
    group: "Ministry Work",
    items: [
      { title: "Inbox", url: "/tasks/inbox", icon: Inbox, badgeKey: "inbox_items" },
      { title: "Next Actions", url: "/tasks/next", icon: ListChecks, badgeKey: "tasks_open" },
      { title: "Projects", url: "/tasks/projects", icon: FolderKanban, badgeKey: "projects" },
      { title: "Waiting For", url: "/tasks/waiting", icon: Clock, badgeKey: "waiting_items" },
      { title: "Someday / Maybe", url: "/tasks/someday", icon: Sparkles, badgeKey: "someday_items", secondary: true },
      { title: "Recurring", url: "/tasks/recurring", icon: CalendarClock, secondary: true },
      { title: "Weekly Review", url: "/tasks/review", icon: CheckCircle2, secondary: true },
    ],
  },
  {
    id: "people",
    title: "People",
    url: "/people",
    icon: Users,
    moduleKey: "people",
    matchPrefixes: ["/people"],
    group: "Ministry Work",
    items: [],
  },
  {
    id: "groups",
    title: "Groups",
    url: "/groups",
    icon: FolderKanban,
    moduleKey: "groups",
    matchPrefixes: ["/groups"],
    group: "Ministry Work",
    items: [],
  },
  {
    id: "meetings",
    title: "Meetings",
    url: "/meetings",
    icon: Presentation,
    moduleKey: "meetings",
    matchPrefixes: ["/meetings"],
    group: "Planning",
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
    group: "Planning",
    items: [
      { title: "Services", url: "/service-planner", icon: CalendarDays },
      { title: "Teams", url: "/service-planner/teams", icon: Users },
      { title: "Repertoire", url: "/service-planner/repertoire", icon: Music },
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    url: "/calendar",
    icon: CalendarDays,
    moduleKey: "calendar",
    matchPrefixes: ["/calendar", "/reminders"],
    group: "Planning",
    items: [
      { title: "Calendar", url: "/calendar", icon: CalendarDays },
      { title: "Reminders", url: "/reminders", icon: Bell, badgeKey: "reminders_open" },
    ],
  },
  {
    id: "training",
    title: "Training",
    url: "/training",
    icon: GraduationCap,
    matchPrefixes: ["/training"],
    group: "Content",
    items: [],
  },
  {
    id: "sermon_hub",
    title: "Sermon Hub",
    url: "/sermon-hub",
    icon: BookOpen,
    moduleKey: "sermon_hub",
    matchPrefixes: ["/sermon-hub"],
    group: "Content",
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
  const [moreOpenSections, setMoreOpenSections] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsError, setCountsError] = useState(false);

  const visibleSections = useMemo(
    () =>
      navSections.filter((section) => {
        if (!section.moduleKey) return true;
        return isModuleEnabled(section.moduleKey) && isModuleActive(section.moduleKey);
      }),
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

  const activeLeafTitle = useMemo(() => {
    if (!activeSection) return undefined;
    return activeSection.items.find((item) => isItemActive(activeSection, item))?.title;
  }, [activeSection, pathname]);

  useEffect(() => {
    if (!activeSection) return;
    if (activeSection.items.length === 0) {
      setOpenSections(new Set());
      return;
    }

    setOpenSections(new Set([activeSection.id]));
  }, [activeSection?.id]);

  // A secondary ("More") item can be the active page via direct link/refresh;
  // make sure its section's More group is open so the active pill is visible.
  useEffect(() => {
    if (!activeSection) return;
    const activeItem = activeSection.items.find((item) => isItemActive(activeSection, item));
    if (!activeItem?.secondary) return;

    setMoreOpenSections((current) => new Set(current).add(activeSection.id));
  }, [activeSection, pathname]);

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

    // A fast double-navigation can let an older count response resolve after a
    // newer one; `ignore` drops it instead of overwriting fresher badge counts.
    let ignore = false;

    (async () => {
      const [inbox, tasksOpen, projects, waiting, someday, reminders] = await Promise.all([
        supabase.from("inbox_items").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .or(personalNextActionFilter(currentPerson?.id))
          .eq("complete", false),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("waiting_items").select("id", { count: "exact", head: true }),
        supabase.from("someday_items").select("id", { count: "exact", head: true }),
        (supabase as any)
          .from("reminders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      if (ignore) return;

      // Supabase resolves query errors on the response rather than throwing, so a
      // failed count silently reads as `null` unless we check `.error` per query.
      const failed = [inbox, tasksOpen, projects, waiting, someday, reminders].some((r) => r.error);
      setCountsError(failed);
      if (failed) return;

      setCounts({
        inbox_items: inbox.count ?? 0,
        tasks_open: tasksOpen.count ?? 0,
        projects: projects.count ?? 0,
        waiting_items: waiting.count ?? 0,
        someday_items: someday.count ?? 0,
        reminders_open: reminders.count ?? 0,
      });
    })();

    return () => {
      ignore = true;
    };
  }, [user, pathname, currentPerson?.id]);

  const toggleSection = (id: string) => {
    setOpenSections((current) => {
      if (current.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const toggleMoreItems = (id: string) => {
    setMoreOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderBadge = (item: NavItem) => {
    if (item.badgeKey && countsError) {
      return <span className="ml-auto text-sidebar-foreground/45" title="Count unavailable">–</span>;
    }

    const count = item.badgeKey ? counts[item.badgeKey] : undefined;
    if (!count) return null;

    return (
      <span className="ml-auto rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-sidebar-foreground">
        {count}
      </span>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      role="navigation"
      aria-label="Main"
      className="!border-r-0 border-r-0 [&_[data-sidebar=sidebar]]:overflow-hidden [&_[data-sidebar=sidebar]]:!border-r-0 [&_[data-sidebar=sidebar]]:border-r-0 [&_[data-sidebar=sidebar]]:bg-gradient-sidebar"
    >
      <SidebarHeader className="border-b border-sidebar-border/55 bg-transparent">
        <div
          className={
            collapsed
              ? "flex h-24 flex-col items-center justify-center gap-2 px-0 py-2"
              : "flex h-[4.75rem] items-center gap-2.5 px-3 py-2.5"
          }
        >
          <NavLink
            to="/"
            className={cn(
              collapsed ? "flex w-full justify-center" : "flex min-w-0 flex-1 justify-start",
              "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            )}
            title="Home"
            aria-label="Go home"
          >
            <Logo compact={collapsed} />
          </NavLink>

          <button
            type="button"
            className={cn(
              collapsed
                ? "flex h-11 w-11 items-center justify-center rounded-lg border border-sidebar-border/80 bg-sidebar-foreground/10 text-sidebar-foreground/65 transition hover:bg-sidebar-foreground/20 hover:text-sidebar-foreground"
                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/80 bg-sidebar-foreground/10 text-sidebar-foreground/65 transition hover:bg-sidebar-foreground/20 hover:text-sidebar-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            )}
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
            <SidebarMenu className={collapsed ? "items-center gap-1.5 px-0" : "gap-1 pl-3 pr-5"}>
              {visibleSections.map((section, index) => {
                const SectionIcon = section.icon;
                const sectionActive = section.id === activeSection?.id;
                const hasSubmenu = section.items.length > 0;
                const sectionOpen = !collapsed && openSections.has(section.id);
                const moreOpen = !collapsed && moreOpenSections.has(section.id);
                const primaryItems = section.items.filter((item) => !item.secondary);
                const secondaryItems = section.items.filter((item) => item.secondary);
                const startsNewGroup = !collapsed && section.group && section.group !== visibleSections[index - 1]?.group;

                return (
                  <Fragment key={section.id}>
                    {startsNewGroup && (
                      <li className="list-none">
                        <p
                          className={cn(
                            "px-3 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sidebar-foreground/50",
                            index === 0 && "pt-0"
                          )}
                        >
                          {section.group}
                        </p>
                      </li>
                    )}

                    <SidebarMenuItem
                      className={cn(
                        collapsed && "w-full",
                        section.id === "settings" && !collapsed && "mt-2 border-t border-sidebar-border/70 pt-2.5"
                      )}
                    >
                    {collapsed ? (
                      <>
                        {sectionActive && (
                          <span
                            aria-hidden="true"
                            className="absolute right-0 top-1/2 h-9 w-3 -translate-y-1/2 translate-x-1/2 rounded-l-full bg-background"
                          />
                        )}

                        <SidebarMenuButton
                          asChild
                          tooltip={
                            sectionActive && activeLeafTitle
                              ? `${section.title} · ${activeLeafTitle}`
                              : section.title
                          }
                          className={cn(
                            "mx-auto h-11 w-11 justify-center rounded-xl p-0 transition-colors",
                            sectionActive
                              ? "bg-sidebar-foreground/10 text-sidebar-foreground hover:bg-sidebar-foreground/10"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                          )}
                        >
                          <NavLink to={section.url} className="flex h-full w-full items-center justify-center">
                            <SectionIcon className="h-[18px] w-[18px]" />
                          </NavLink>
                        </SidebarMenuButton>
                      </>
                    ) : hasSubmenu ? (
                      <>
                        <div
                          className={cn(
                            "flex h-11 w-full items-center overflow-hidden rounded-xl border transition-colors",
                            sectionActive
                              ? "border-brand-teal/30 bg-brand-teal/14 text-sidebar-foreground"
                              : "border-transparent text-sidebar-foreground/74 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                          )}
                        >
                          <NavLink
                            to={section.url}
                            className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-l-xl px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                          >
                            <SectionIcon
                              className={cn("h-4 w-4 shrink-0", sectionActive && "text-brand-teal-bright")}
                            />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold">
                              {section.title}
                            </span>
                          </NavLink>

                          <button
                            type="button"
                            className={cn(
                              "flex h-full w-11 shrink-0 items-center justify-center rounded-r-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                              sectionActive
                                ? "text-brand-teal-bright/70 hover:bg-brand-teal/10 hover:text-brand-teal-bright"
                                : "text-sidebar-foreground/45 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
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
                          <div className="ml-[1.45rem] mr-1.5 mt-1 space-y-0.5 border-l border-sidebar-border/70 pb-0.5 pl-2.5">
                            {primaryItems.map((item) => {
                              const ItemIcon = item.icon;
                              const itemActive = isItemActive(section, item);

                              return (
                                <NavLink
                                  key={item.url}
                                  to={item.url}
                                  className={cn(
                                    "flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                                    itemActive
                                      ? "bg-sidebar-foreground text-sidebar shadow-[0_4px_10px_hsl(var(--brand-charcoal)/0.18)]"
                                      : "text-sidebar-foreground/62 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                                  )}
                                >
                                  <ItemIcon
                                    className={cn(
                                      "h-3 w-3 shrink-0",
                                      itemActive ? "text-sidebar/60" : "text-sidebar-foreground/45"
                                    )}
                                  />
                                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                  {renderBadge(item)}
                                </NavLink>
                              );
                            })}

                            {secondaryItems.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleMoreItems(section.id)}
                                  aria-expanded={moreOpen}
                                  className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-sidebar-foreground/55 transition hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                                >
                                  <MoreHorizontal className="h-3 w-3 shrink-0 text-sidebar-foreground/45" />
                                  <span className="min-w-0 flex-1 truncate text-left">
                                    {moreOpen ? "Less" : "More"}
                                  </span>
                                </button>

                                {moreOpen &&
                                  secondaryItems.map((item) => {
                                    const ItemIcon = item.icon;
                                    const itemActive = isItemActive(section, item);

                                    return (
                                      <NavLink
                                        key={item.url}
                                        to={item.url}
                                        className={cn(
                                          "flex min-h-8 items-center gap-2 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                                          itemActive
                                            ? "bg-sidebar-foreground text-sidebar shadow-[0_4px_10px_hsl(var(--brand-charcoal)/0.18)]"
                                            : "text-sidebar-foreground/62 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                                        )}
                                      >
                                        <ItemIcon
                                          className={cn(
                                            "h-3 w-3 shrink-0",
                                            itemActive ? "text-sidebar/60" : "text-sidebar-foreground/45"
                                          )}
                                        />
                                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                        {renderBadge(item)}
                                      </NavLink>
                                    );
                                  })}
                              </>
                            )}

                            {section.id === "meetings" && (
                              <div className="space-y-1 pl-7">
                                {recurringSidebarMeetings.length === 0 ? (
                                  <p className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/60">
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
                                          "block truncate rounded-lg px-2 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                                          seriesActive
                                            ? "bg-sidebar-foreground text-sidebar"
                                            : "text-sidebar-foreground/58 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
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
                          "flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                          sectionActive
                            ? "bg-sidebar-foreground text-sidebar shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_14px_28px_hsl(var(--brand-charcoal)/0.2)]"
                            : "text-sidebar-foreground/74 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                        )}
                      >
                        <SectionIcon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold">
                          {section.title}
                        </span>
                      </NavLink>
                    )}
                    </SidebarMenuItem>
                  </Fragment>
                );
              })}
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

            <p className="mt-1 truncate text-xs text-sidebar-foreground/60">
              {role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : user?.email}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
