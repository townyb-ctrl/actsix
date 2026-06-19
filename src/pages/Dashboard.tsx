import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
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
};

type CalendarDay = {
  key: string;
  day: number | null;
  weekday: string;
  items: CalendarItem[];
  inMonth: boolean;
};

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

const formatDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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

const EmptyState = ({ children }: { children: string }) => (
  <div className="actsix-empty-state">
    {children}
  </div>
);

const SectionHeader = ({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
    <div className="min-w-0">
      <p className="label-eyebrow">{eyebrow}</p>
      <h2 className="mt-0.5 truncate text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
        {title}
      </h2>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const AgendaItemRow = ({ item }: { item: CalendarItem }) => {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className="group flex min-h-[50px] items-center gap-2.5 rounded-lg border border-border/80 bg-background/70 px-3 py-2 transition hover:border-brand-teal/35 hover:bg-brand-teal/5"
    >
      <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-extrabold text-foreground group-hover:text-brand-teal">
          {item.title}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs font-semibold text-muted-foreground">
          <span>{formatAgendaDate(item.date)}</span>
          {formatTime(item.time) && <span>{formatTime(item.time)}</span>}
          <span>{item.label}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
};

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
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
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
          .not("project", "is", null),
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

    return `${formatShortDate(toDateKey(currentWeek))} - ${formatShortDate(toDateKey(end))}`;
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
      now,
      todayKey,
    }),
    [
      meetings,
      nextService,
      now,
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = useMemo(() => {
    return (displayName || "there").trim().split(/\s+/)[0] || "there";
  }, [displayName]);

  const clockLabel = useMemo(
    () =>
      now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [now]
  );

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [now]
  );

  if (!workspaceLoading && !workspace) {
    return (
      <div>
        <PageHeader
          eyebrow="ACTSIX"
          title="Workspace Setup"
          subtitle="Join the Alpha Testing Workspace before using ACTSIX."
        />

        <div className="w-full px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
          <Card className="actsix-panel-soft p-4 sm:p-5">
            <h2 className="text-2xl font-extrabold tracking-tight">
              Connect ACTSIX to your church
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ACTSIX is designed around church workspaces. Create your church workspace
              or join one using the code and secret phrase from your admin.
            </p>

            <div className="mt-5">
              <Button asChild className="actsix-btn-primary rounded-xl">
                <Link to="/workspace-setup">Join Alpha Workspace</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 px-4 pb-28 pt-4 sm:px-6 md:gap-5 md:pb-12 xl:px-8 2xl:max-w-[104rem] 2xl:px-10">
          <section className="actsix-panel p-4 sm:p-5">
            <div className="actsix-loading-state" role="status">
              Loading your home overview...
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden">
      <div
        data-tour="home-overview"
        className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 px-4 pb-28 pt-4 sm:px-6 md:gap-5 md:pb-12 xl:px-8 2xl:max-w-[104rem] 2xl:px-10"
      >
        <section className="actsix-panel-soft p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="label-eyebrow text-brand-teal">Home</p>
              <h1 className="mt-1 text-balance text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
                {greeting}, {firstName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-extrabold text-muted-foreground sm:text-sm">
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                  {dateLabel}
                </span>
                <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                  {clockLabel}
                </span>
                {workspace?.name && (
                  <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 text-brand-teal">
                    {workspace.name}
                  </span>
                )}
              </div>
            </div>
            <Button
              className="actsix-btn-primary h-10 shrink-0 px-3 text-xs"
              onClick={() => setCustomizeMode(true)}
            >
              <Settings2 className="h-4 w-4" />
              Customize Dashboard
            </Button>
          </div>
        </section>

        {customizeMode && (
          <DashboardCustomizeBar
            savedState={savedState}
            onAddWidget={() => setLibraryOpen(true)}
            onResetLayout={() => setResetConfirmOpen(true)}
            onDone={() => setCustomizeMode(false)}
          />
        )}

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

        <Card className="actsix-panel min-w-0 overflow-hidden md:hidden">
          <SectionHeader
            eyebrow="Calendar"
            title="Upcoming Agenda"
            action={
              <Button asChild variant="outline" size="sm" className="actsix-btn-outline h-9 px-3 text-xs">
                <Link to="/meetings">
                  Meetings
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />
          <div className="space-y-3 p-4 sm:p-5">
            {mobileAgendaItems.length === 0 && <EmptyState>No dated items in the next 7 days.</EmptyState>}
            {mobileAgendaItems.map((item) => (
              <AgendaItemRow key={item.id} item={item} />
            ))}
          </div>
        </Card>

        <Card className="actsix-panel hidden min-w-0 overflow-hidden md:block">
          <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-eyebrow">Calendar</p>
              <h2 className="mt-0.5 text-lg font-extrabold tracking-tight">
                {calendarView === "week" ? currentWeekLabel : currentMonthLabel}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <Button asChild variant="outline" size="sm" className="actsix-btn-outline h-9 px-3">
                <Link to="/meetings">
                  Meetings
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="w-full overflow-x-auto p-5">
            <div className="mb-2 grid min-w-[720px] grid-cols-7 gap-2 px-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
                <div
                  key={weekday}
                  className="text-[10px] font-black uppercase tracking-wide text-muted-foreground"
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div className="grid min-w-[720px] grid-cols-7 gap-2">
              {visibleCalendarDays.map((day) => (
                <div
                  key={day.key}
                  className={`h-36 rounded-xl border px-2.5 py-2 ${
                    !day.inMonth
                      ? "border-border/40 bg-background/20"
                      : day.key === todayKey
                        ? "border-brand-teal/45 bg-brand-teal/10"
                        : "border-border/70 bg-background/45"
                  }`}
                >
                  {day.inMonth && (
                    <>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="text-sm font-extrabold">{day.day}</span>
                        {day.key === todayKey && (
                          <span className="rounded-full bg-brand-teal px-2 py-0.5 text-[10px] font-semibold text-white">
                            Today
                          </span>
                        )}
                      </div>

                      {day.items.length > 0 && (
                        <div className="max-h-[calc(100%-2.25rem)] overflow-y-auto border-t border-border/60 pr-1">
                          <div className="divide-y divide-border/60">
                            {day.items.map((item) => {
                              const ItemIcon = item.icon;
                              return (
                                <Link
                                  key={item.id}
                                  to={item.to}
                                  className="group block py-1.5 text-xs transition hover:text-brand-teal"
                                >
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <ItemIcon className="h-3 w-3 shrink-0 text-brand-teal" />
                                    <span className="truncate font-semibold">{item.title}</span>
                                  </div>
                                  <div className="mt-0.5 truncate pl-[18px] text-[10px] text-muted-foreground group-hover:text-brand-teal/80">
                                    {item.time ? `${formatTime(item.time)} / ${item.label}` : item.label}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

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
              <AlertDialogCancel className="actsix-btn-outline">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="actsix-btn-primary"
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
