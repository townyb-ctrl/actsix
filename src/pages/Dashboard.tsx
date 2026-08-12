import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  ListChecks,
  Music,
  Settings2,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardCustomizeBar } from "@/features/dashboard/components/DashboardCustomizeBar";
import { DashboardGrid } from "@/features/dashboard/components/DashboardGrid";
import { WidgetLibraryModal } from "@/features/dashboard/components/WidgetLibraryModal";
import { WidgetSettingsModal } from "@/features/dashboard/components/WidgetSettingsModal";
import { widgetDefinitions } from "@/features/dashboard/data/widgetDefinitions";
import { useDashboardLayout } from "@/features/dashboard/hooks/useDashboardLayout";
import type { UserDashboardWidget } from "@/features/dashboard/types/dashboardTypes";

type Task = {
  id: string;
  title: string;
  due?: string | null;
  priority?: string | null;
  project?: string | null;
  project_id?: string | null;
  context?: string | null;
  minutes?: number | null;
  complete?: boolean | null;
  created_at?: string | null;
  project_sections?: { name?: string | null } | { name?: string | null }[] | null;
};

type Project = {
  id: string;
  name: string;
  area?: string | null;
  status?: string | null;
  next_action?: string | null;
  open_tasks?: number | null;
  progress?: number | null;
  updated_at?: string | null;
};

type Meeting = {
  id: string;
  title: string;
  meeting_date?: string | null;
  meeting_time?: string | null;
  location?: string | null;
  status?: string | null;
  type?: string | null;
};

type ServiceInstance = {
  id: string;
  title?: string | null;
  service_date: string;
  start_time?: string | null;
  location?: string | null;
  service_type_id: string;
  service_types?: { name?: string | null } | null;
};

type ServiceOrderItem = {
  id: string;
  title: string;
  item_type: string;
  duration_minutes?: number | null;
  sort_order: number;
};

type ServiceTeamAssignment = {
  id: string;
  person_name: string;
  role_name: string;
  sort_order: number;
};

type CalendarItem = {
  id: string;
  label: string;
  title: string;
  date?: string | null;
  time?: string | null;
  to: string;
  icon: LucideIcon;
  kind: "meeting" | "task" | "service";
};

type CalendarDay = {
  key: string;
  day: number | null;
  weekday: string;
  items: CalendarItem[];
  inMonth: boolean;
};

// How many items a calendar cell shows before it collapses the rest behind a
// "+N more" control. Previously the overflow just scrolled inside a 144px box,
// which hid items with no affordance that they existed.
const DAY_ITEM_LIMIT = 2;

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const startOfWeek = (date: Date) => {
  const start = new Date(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatAgendaDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return null;

  const [hour = "0", minute = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

// The clock owns its own ticking state so the 30s update repaints two chips
// instead of re-rendering the dashboard's widget tree and calendar grid.
const HeaderClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      {" · "}
      {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </>
  );
};

const AgendaItemRow = ({ item }: { item: CalendarItem }) => {
  const Icon = item.icon;

  return (
    <Link to={item.to} className="st-row">
      <Icon className="h-4 w-4" style={{ color: "var(--st-accent)" }} aria-hidden="true" />
      <span>
        <span className="st-row-title">{item.title}</span>
        <span className="st-row-sub">
          {formatAgendaDate(item.date)}
          {formatTime(item.time) ? ` · ${formatTime(item.time)}` : ""} · {item.label}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--st-ink-3)" }} />
    </Link>
  );
};

// Skeleton mirrors the real grid's shape so the page doesn't reflow when data
// lands — the old loading state was a single line of text that the full
// dashboard then shoved out of the way.
const DashboardSkeleton = () => (
  <div className="flex flex-col gap-4" role="status" aria-label="Loading your dashboard">
    <div className="st-panel">
      <div className="st-panel-head">
        <span className="st-skeleton block h-3 w-24" />
        <span className="st-skeleton block h-3 w-16" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <span className="st-skeleton block h-3.5 w-3.5 shrink-0" />
            <span className="st-skeleton block h-3 flex-1" style={{ maxWidth: `${72 - row * 6}%` }} />
            <span className="st-skeleton block h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {[0, 1].map((panel) => (
        <div key={panel} className="st-panel">
          <div className="st-panel-head">
            <span className="st-skeleton block h-3 w-20" />
          </div>
          <div className="flex flex-col gap-3 p-4">
            {[0, 1, 2].map((row) => (
              <span key={row} className="st-skeleton block h-3" style={{ width: `${86 - row * 14}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { displayName, person: currentPerson } = useCurrentPerson();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [nextService, setNextService] = useState<ServiceInstance | null>(null);
  const [serviceOrderItems, setServiceOrderItems] = useState<ServiceOrderItem[]>([]);
  const [serviceTeamAssignments, setServiceTeamAssignments] = useState<ServiceTeamAssignment[]>([]);
  const [calendarView, setCalendarView] = useState<"month" | "week">("week");
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [settingsWidget, setSettingsWidget] = useState<UserDashboardWidget | null>(null);
  const {
    layout,
    savedState,
    addWidget,
    removeWidget,
    moveWidget,
    reorderWidget,
    resizeWidget,
    updateWidgetSettings,
    resetLayout,
  } = useDashboardLayout(user?.id, widgetDefinitions);

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      const today = toDateKey(startOfToday());
      const monthStart = toDateKey(startOfMonth(startOfToday()));
      const monthEndDate = endOfMonth(startOfToday());
      const nextSixDaysEnd = addDays(startOfToday(), 6);
      const meetingRangeEnd = toDateKey(
        nextSixDaysEnd > monthEndDate ? nextSixDaysEnd : monthEndDate
      );

      const [
        taskResult,
        projectTaskResult,
        projectResult,
        meetingResult,
        serviceResult,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, project_sections(name)")
          .or(personalNextActionFilter(currentPerson?.id))
          .eq("complete", false)
          .order("due", { ascending: true, nullsFirst: false }),
        supabase
          .from("tasks")
          .select("id, title, project, project_id, complete")
          // Project stats match on project_id first and fall back to the legacy
          // project name, so both carriers have to come back. Filtering on the
          // name alone dropped every task that only had project_id set.
          .or("project.not.is.null,project_id.not.is.null"),
        supabase
          .from("projects")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("meetings")
          .select("*")
          .gte("meeting_date", monthStart)
          .lte("meeting_date", meetingRangeEnd)
          .order("meeting_date", { ascending: true })
          .order("meeting_time", { ascending: true })
          .limit(80),
        supabase
          .from("service_instances")
          .select("*, service_types(name)")
          .gte("service_date", today)
          .order("service_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(1),
      ]);

      // A failed query used to fall through as an empty array, so a network
      // outage rendered as "you have nothing to do" — the most dangerous thing
      // this page can say to someone running a Sunday.
      const failed = [
        taskResult.error,
        projectTaskResult.error,
        projectResult.error,
        meetingResult.error,
        serviceResult.error,
      ].filter(Boolean);

      if (failed.length > 0) {
        setLoadError(failed[0]?.message ?? "Something went wrong loading your dashboard.");
        setLoading(false);
        return;
      }

      const service = (serviceResult.data?.[0] as ServiceInstance | undefined) ?? null;
      setTasks((taskResult.data ?? []) as Task[]);
      setProjectTasks((projectTaskResult.data ?? []) as Task[]);
      setProjects((projectResult.data ?? []) as Project[]);
      setMeetings((meetingResult.data ?? []) as Meeting[]);
      setNextService(service);

      if (service) {
        const [orderItemsResult, assignmentsResult] = await Promise.all([
          supabase
            .from("service_order_items")
            .select("*")
            .eq("service_id", service.id)
            .order("sort_order", { ascending: true })
            .limit(8),
          supabase
            .from("service_team_assignments")
            .select("id, person_name, role_name, sort_order")
            .eq("service_id", service.id)
            .order("sort_order", { ascending: true })
            .limit(8),
        ]);

        setServiceOrderItems((orderItemsResult.data ?? []) as ServiceOrderItem[]);
        setServiceTeamAssignments((assignmentsResult.data ?? []) as ServiceTeamAssignment[]);
      } else {
        setServiceOrderItems([]);
        setServiceTeamAssignments([]);
      }

      setLoading(false);
    })();
  }, [user, currentPerson?.id]);

  const todayKey = useMemo(() => toDateKey(startOfToday()), []);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const meetingItems = meetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      label: "Meeting",
      title: meeting.title,
      date: meeting.meeting_date,
      time: meeting.meeting_time,
      to: `/meetings/${meeting.id}`,
      icon: UsersRound,
      kind: "meeting" as const,
    }));

    const taskItems = tasks
      .filter((task) => task.due)
      .map((task) => ({
        id: `task-${task.id}`,
        label: task.priority || "Task",
        title: task.title,
        date: task.due,
        time: null,
        to: "/tasks/next",
        icon: ListChecks,
        kind: "task" as const,
      }));

    const serviceItem = nextService
      ? [
          {
            id: `service-${nextService.id}`,
            label: "Service",
            title: nextService.title || nextService.service_types?.name || "Upcoming service",
            date: nextService.service_date,
            time: nextService.start_time,
            to: `/service-planner/services/${nextService.id}`,
            icon: Music,
            kind: "service" as const,
          },
        ]
      : [];

    return [...meetingItems, ...taskItems, ...serviceItem]
      .filter((item) => item.date)
      .sort((a, b) => {
        const aTime = `${a.date}T${a.time || "23:59"}`;
        const bTime = `${b.date}T${b.time || "23:59"}`;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });
  }, [meetings, nextService, tasks]);

  const currentMonth = useMemo(() => startOfMonth(startOfToday()), []);
  const calendarDays = useMemo(() => {
    const daysInMonth = endOfMonth(currentMonth).getDate();
    const firstDayOffset = (currentMonth.getDay() + 6) % 7;
    const monthDays: CalendarDay[] = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
      const key = toDateKey(date);
      const items = calendarItems.filter((item) => item.date === key);

      return {
        key,
        day: index + 1,
        weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
        items,
        inMonth: true,
      };
    });

    const leadingDays: CalendarDay[] = Array.from({ length: firstDayOffset }, (_, index) => ({
      key: `empty-start-${index}`,
      day: null,
      weekday: "",
      items: [],
      inMonth: false,
    }));

    const trailingCount = (7 - ((leadingDays.length + monthDays.length) % 7)) % 7;
    const trailingDays: CalendarDay[] = Array.from({ length: trailingCount }, (_, index) => ({
      key: `empty-end-${index}`,
      day: null,
      weekday: "",
      items: [],
      inMonth: false,
    }));

    return [...leadingDays, ...monthDays, ...trailingDays];
  }, [calendarItems, currentMonth]);

  const currentWeek = useMemo(() => startOfWeek(startOfToday()), []);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + index);
      const key = toDateKey(date);
      const items = calendarItems.filter((item) => item.date === key);

      return {
        key,
        day: date.getDate(),
        weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
        items,
        inMonth: true,
      };
    });
  }, [calendarItems, currentWeek]);

  const currentMonthLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [currentMonth]
  );

  const currentWeekLabel = useMemo(() => {
    const end = new Date(currentWeek);
    end.setDate(currentWeek.getDate() + 6);

    return `${formatShortDate(toDateKey(currentWeek))} – ${formatShortDate(toDateKey(end))}`;
  }, [currentWeek]);

  const visibleCalendarDays = calendarView === "week" ? weekDays : calendarDays;

  const widgetData = useMemo(
    () => ({
      tasks,
      projectTasks,
      projects,
      meetings,
      nextService,
      serviceOrderItems,
      serviceTeamAssignments,
      todayKey,
    }),
    [
      meetings,
      nextService,
      projectTasks,
      projects,
      serviceOrderItems,
      serviceTeamAssignments,
      tasks,
      todayKey,
    ]
  );

  const settingsDefinition = settingsWidget
    ? widgetDefinitions.find((definition) => definition.id === settingsWidget.definitionId)
    : undefined;

  const mobileAgendaItems = useMemo(() => {
    const endKey = toDateKey(addDays(startOfToday(), 6));
    return calendarItems
      .filter((item) => item.date && item.date >= todayKey && item.date <= endKey)
      .slice(0, 8);
  }, [calendarItems, todayKey]);

  const openCount = tasks.length;
  const lateCount = useMemo(
    () => tasks.filter((task) => task.due && task.due < todayKey).length,
    [tasks, todayKey]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = useMemo(() => {
    return (displayName || "there").trim().split(/\s+/)[0] || "there";
  }, [displayName]);

  if (!workspaceLoading && !workspace) {
    return (
      <div>
        <PageHeader
          eyebrow="ACTSIX"
          title="Workspace Setup"
          subtitle="Join the Alpha Testing Workspace before using ACTSIX."
        />

        <div className="actsix-page-body">
          <Card className="actsix-panel-soft p-4 sm:p-5">
            <h2 className="text-2xl font-extrabold tracking-tight">
              Connect ACTSIX to your church
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ACTSIX is designed around church workspaces. Create your church workspace
              or join one using the code and secret phrase from your admin.
            </p>

            <div className="mt-5">
              <Button asChild className="actsix-btn-primary min-h-10 rounded-xl">
                <Link to="/workspace-setup">Join Alpha Workspace</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <div data-tour="home-overview" className="actsix-page-body flex flex-col gap-5 pt-6">
        <header className="st-topline">
          <div className="min-w-0">
            <h1 className="st-h1">
              {greeting}, {firstName}
            </h1>
            <p className="st-topline-meta">
              <HeaderClock />
              {workspace?.name ? ` · ${workspace.name}` : ""}
              {!loading && !loadError ? (
                <>
                  {" · "}
                  <span className="st-mono">{openCount}</span> open
                  {lateCount > 0 && (
                    <>
                      {" · "}
                      <span className="st-mono" style={{ color: "var(--st-rose)", fontWeight: 700 }}>
                        {lateCount} late
                      </span>
                    </>
                  )}
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className={`st-btn${customizeMode ? " st-btn-primary" : ""}`}
              onClick={() => setCustomizeMode((active) => !active)}
            >
              <Settings2 className="h-4 w-4" />
              {customizeMode ? "Done editing" : "Edit layout"}
            </button>
          </div>
        </header>

        {loadError && (
          <div className="st-panel" role="alert">
            <div className="st-error">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Your dashboard didn&rsquo;t load. {loadError} Check your connection and reload —
                nothing here reflects your real workload right now.
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {customizeMode && (
              <DashboardCustomizeBar
                savedState={savedState}
                onAddWidget={() => setLibraryOpen(true)}
                onResetLayout={() => setResetConfirmOpen(true)}
                onDone={() => setCustomizeMode(false)}
              />
            )}

            {/* One rendering path. The previous build showed the saved layout
                only while customizing and a hardcoded panel set otherwise, so
                every layout edit silently vanished on "Finish Editing". */}
            <DashboardGrid
              widgets={layout.widgets}
              definitions={widgetDefinitions}
              data={widgetData}
              customizeMode={customizeMode}
              onMoveWidget={moveWidget}
              onReorderWidget={reorderWidget}
              onResizeWidget={resizeWidget}
              onRemoveWidget={removeWidget}
              onConfigureWidget={setSettingsWidget}
              onUpdateWidgetSettings={updateWidgetSettings}
            />
          </>
        )}

        {!loading && (
          <>
            <section className="st-panel md:hidden">
              <div className="st-panel-head">
                <h2 className="st-panel-title">Next 7 days</h2>
                <Link to="/meetings" className="st-tally" style={{ color: "var(--st-accent)" }}>
                  Meetings <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              <div className="st-rows">
                {mobileAgendaItems.length === 0 ? (
                  <p className="st-empty">Nothing dated in the next 7 days.</p>
                ) : (
                  mobileAgendaItems.map((item) => <AgendaItemRow key={item.id} item={item} />)
                )}
              </div>
            </section>

            <section className="st-panel hidden md:block">
              <div className="st-panel-head">
                <h2 className="st-panel-title">
                  {calendarView === "week" ? "This week" : "This month"}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="st-tally">
                    {calendarView === "week" ? currentWeekLabel : currentMonthLabel}
                  </span>
                  <div className="actsix-segmented">
                    {(["month", "week"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setCalendarView(view)}
                        data-state={calendarView === view ? "active" : "inactive"}
                        className="actsix-segmented-item h-8 px-3 text-xs font-extrabold capitalize"
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="st-week">
                <div
                  className="mb-2 grid gap-2 px-1"
                  style={{ gridTemplateColumns: "repeat(7, minmax(96px, 1fr))", minWidth: "660px" }}
                >
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
                    <div
                      key={weekday}
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: "var(--st-ink-3)" }}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="st-week-grid">
                  {visibleCalendarDays.map((day) => {
                    const expanded = expandedDays.includes(day.key);
                    const shown = expanded ? day.items : day.items.slice(0, DAY_ITEM_LIMIT);
                    const hidden = day.items.length - shown.length;

                    return (
                      <div
                        key={day.key}
                        className={`st-day${day.key === todayKey ? " st-day-today" : ""}`}
                        style={!day.inMonth ? { opacity: 0.4 } : undefined}
                      >
                        {day.inMonth && (
                          <>
                            <div className="st-day-num">
                              <span>{day.day}</span>
                              {day.key === todayKey && <span>Today</span>}
                            </div>

                            {shown.map((item) => (
                              <Link
                                key={item.id}
                                to={item.to}
                                className={`st-chip${item.kind === "meeting" ? " st-chip-meeting" : ""}`}
                              >
                                {item.title}
                                {item.time && (
                                  <>
                                    <br />
                                    <span className="st-mono">{formatTime(item.time)}</span>
                                  </>
                                )}
                              </Link>
                            ))}

                            {hidden > 0 && (
                              <button
                                type="button"
                                className="st-more"
                                onClick={() => setExpandedDays((keys) => [...keys, day.key])}
                              >
                                +{hidden} more
                              </button>
                            )}

                            {expanded && day.items.length > DAY_ITEM_LIMIT && (
                              <button
                                type="button"
                                className="st-more"
                                onClick={() =>
                                  setExpandedDays((keys) => keys.filter((key) => key !== day.key))
                                }
                              >
                                Show less
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}

        <WidgetLibraryModal
          open={libraryOpen}
          definitions={widgetDefinitions}
          onOpenChange={setLibraryOpen}
          onAddWidget={addWidget}
        />

        <WidgetSettingsModal
          open={Boolean(settingsWidget)}
          widget={settingsWidget}
          definition={settingsDefinition}
          onOpenChange={(open) => {
            if (!open) setSettingsWidget(null);
          }}
          onSave={updateWidgetSettings}
        />

        <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset dashboard layout?</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the default ACTSIX dashboard widgets and sizes for your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="actsix-btn-outline min-h-10">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="actsix-btn-primary min-h-10"
                onClick={() => {
                  resetLayout();
                  setResetConfirmOpen(false);
                }}
              >
                Reset Layout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Dashboard;
