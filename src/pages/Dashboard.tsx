import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListChecks,
  Music,
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

type Task = {
  id: string;
  title: string;
  due?: string | null;
  priority?: string | null;
  project?: string | null;
  context?: string | null;
  minutes?: number | null;
  complete?: boolean | null;
  created_at?: string | null;
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

const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
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

const getServiceStartDateTime = (service: ServiceInstance) => {
  const [hour = "0", minute = "0"] = (service.start_time || "00:00").split(":");
  const date = new Date(`${service.service_date}T00:00:00`);
  date.setHours(Number(hour), Number(minute), 0, 0);
  return date;
};

const getServiceCountdownLabel = (service: ServiceInstance | null, now: Date) => {
  if (!service?.service_date) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const serviceDay = new Date(`${service.service_date}T00:00:00`);
  const dayDiff = Math.round(
    (serviceDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dayDiff === 1) return "Tomorrow";
  if (dayDiff > 1) return `${dayDiff} days`;
  if (dayDiff < 0) return null;
  if (!service.start_time) return "Today";

  const startDateTime = getServiceStartDateTime(service);
  const minutesUntil = Math.ceil((startDateTime.getTime() - now.getTime()) / (1000 * 60));

  if (minutesUntil <= 0) return "Now";
  if (minutesUntil < 60) return `${minutesUntil}m to go`;

  const hoursUntil = Math.ceil(minutesUntil / 60);
  return `${hoursUntil}h to go`;
};

const priorityClass = (priority?: string | null) => {
  return "bg-brand-teal/10 text-brand-teal";
};

const projectProgress = (project: Project, tasks: Task[]) => {
  const projectTasks = tasks.filter((task) => task.project === project.name);
  const openTasks = projectTasks.filter((task) => !task.complete);
  const completedTasks = projectTasks.filter((task) => task.complete);

  const progress =
    projectTasks.length === 0
      ? project.progress ?? 0
      : Math.round((completedTasks.length / projectTasks.length) * 100);

  return {
    openTasks: projectTasks.length > 0 ? openTasks.length : project.open_tasks || 0,
    progress,
    nextAction: openTasks[0]?.title || project.next_action || "No next action set",
  };
};

const EmptyState = ({ children }: { children: string }) => (
  <div className="rounded-lg border border-dashed border-border/80 bg-background/45 px-3 py-3 text-center text-xs text-muted-foreground">
    {children}
  </div>
);

const sectionHeadingClass =
  "text-xs font-extrabold uppercase tracking-wide text-muted-foreground";

const Dashboard = () => {
  const { user } = useAuth();
  const { displayName } = useCurrentPerson();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [nextService, setNextService] = useState<ServiceInstance | null>(null);
  const [serviceOrderItems, setServiceOrderItems] = useState<ServiceOrderItem[]>([]);
  const [serviceTeamAssignments, setServiceTeamAssignments] = useState<ServiceTeamAssignment[]>([]);
  const [serviceView, setServiceView] = useState<"plan" | "team">("plan");
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

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
          .select("*")
          .eq("complete", false)
          .order("due", { ascending: true, nullsFirst: false }),
        supabase
          .from("tasks")
          .select("id, title, project, complete")
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
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const todayKey = useMemo(() => toDateKey(startOfToday()), []);

  const importantTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const priorityDiff =
          (priorityWeight[b.priority || "Medium"] || 0) -
          (priorityWeight[a.priority || "Medium"] || 0);

        if (priorityDiff !== 0) return priorityDiff;

        const aDue = a.due ? new Date(`${a.due}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due ? new Date(`${b.due}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;

        return aDue - bDue;
      })
      .slice(0, 5);
  }, [tasks]);

  const todaysTasks = useMemo(() => {
    return tasks
      .filter((task) => task.due === todayKey)
      .sort(
        (a, b) =>
          (priorityWeight[b.priority || "Medium"] || 0) -
          (priorityWeight[a.priority || "Medium"] || 0)
      )
      .slice(0, 5);
  }, [tasks, todayKey]);

  const activeProjects = useMemo(() => {
    return projects
      .filter((project) => !project.status?.toLowerCase().includes("complete"))
      .sort((a, b) => {
        const aStats = projectProgress(a, projectTasks);
        const bStats = projectProgress(b, projectTasks);
        return bStats.openTasks - aStats.openTasks;
      })
      .slice(0, 4);
  }, [projects, projectTasks]);

  const overdueCount = tasks.filter((task) => task.due && task.due < todayKey).length;
  const dueTodayCount = tasks.filter((task) => task.due === todayKey).length;
  const activeProjectCount = projects.filter(
    (project) => !project.status?.toLowerCase().includes("complete")
  ).length;

  const upcomingMeetings = useMemo(() => {
    const endKey = toDateKey(addDays(startOfToday(), 6));

    return meetings
      .filter((meeting) => {
        if (!meeting.meeting_date) return false;
        return meeting.meeting_date >= todayKey && meeting.meeting_date <= endKey;
      })
      .slice(0, 5);
  }, [meetings, todayKey]);

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

  const serviceCountdownLabel = useMemo(() => {
    return getServiceCountdownLabel(nextService, now);
  }, [nextService, now]);

  if (!workspaceLoading && !workspace) {
    return (
      <div>
        <PageHeader
          eyebrow="ACTSIX"
          title="Workspace Setup"
          subtitle="Create or join a church workspace before using ACTSIX."
        />

        <div className="w-full px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
          <Card className="border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-2xl font-extrabold tracking-tight">
              Connect ACTSIX to your church
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ACTSIX is designed around church workspaces. Create your church workspace
              or join one using the code and secret phrase from your admin.
            </p>

            <div className="mt-5">
              <Button asChild className="actsix-btn-primary rounded-xl">
                <Link to="/workspace-setup">Set Up Workspace</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pb-5 pt-4 text-center sm:px-6 xl:px-8 2xl:px-10">
        <p className="label-eyebrow mb-1">Home</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] font-light leading-tight text-foreground/55 md:text-lg">
          {clockLabel} · {dateLabel}
        </p>
      </div>

      <div data-tour="home-overview" className="w-full space-y-4 px-4 pb-10 sm:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card className="border-border/60 bg-card/95 shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div>
                <p className="label-eyebrow">Attention</p>
                <h2 className="text-lg font-extrabold tracking-tight">Today</h2>
              </div>
              <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">
                {dueTodayCount} today
              </span>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className={sectionHeadingClass}>Due today</h3>
                  <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[11px] font-semibold text-brand-teal">
                    {dueTodayCount}
                  </span>
                </div>
                <div className="overflow-hidden rounded-md border border-border/60 bg-background/35">
                  {todaysTasks.length === 0 && <EmptyState>No tasks due today.</EmptyState>}
                  {todaysTasks.slice(0, 4).map((task) => (
                    <Link
                      key={task.id}
                      to="/tasks/next"
                      className="block border-b border-border/60 px-3 py-2 transition last:border-b-0 hover:bg-brand-teal/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">{task.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                        {task.minutes ? `${task.minutes} min` : task.context || "Today"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <h3 className={`${sectionHeadingClass} mb-2`}>High Priority</h3>
                <div className="overflow-hidden rounded-md border border-border/60 bg-background/35">
                  {importantTasks.length === 0 && <EmptyState>No important open tasks yet.</EmptyState>}
                  {importantTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      to="/tasks/next"
                      className="block border-b border-border/60 px-3 py-2 transition last:border-b-0 hover:bg-brand-teal/5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">{task.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityClass(task.priority)}`}>
                          {task.priority || "Medium"} {task.minutes ? `- ${task.minutes}m` : ""}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/95 shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div>
                <p className="label-eyebrow">Service Planner</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight">Next Service</h2>
                  {serviceCountdownLabel && (
                    <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[11px] font-bold text-brand-teal">
                      {serviceCountdownLabel}
                    </span>
                  )}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-lg px-3">
                <Link to={nextService ? `/service-planner/services/${nextService.id}` : "/service-planner"}>
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {!nextService ? (
              <div className="p-4">
                <EmptyState>No upcoming service dates found.</EmptyState>
              </div>
            ) : (
              <div className="grid gap-3 p-4">
                <div className="min-w-0 text-center">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-extrabold leading-tight tracking-tight">
                      {nextService.title || nextService.service_types?.name || "Upcoming service"}
                    </div>
                    <div className="mt-1 flex flex-wrap justify-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(nextService.service_date)}
                      </span>
                      {formatTime(nextService.start_time) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {formatTime(nextService.start_time)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <section>
                  <div className="mb-2 flex rounded-lg border border-border/70 bg-background/45 p-0.5">
                    {(["plan", "team"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setServiceView(view)}
                        className={`h-7 flex-1 rounded-md px-3 text-xs font-extrabold capitalize transition ${
                          serviceView === view
                            ? "bg-brand-teal text-white"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {view === "plan" ? "Service Plan" : "Team"}
                      </button>
                    ))}
                  </div>

                  {serviceView === "plan" ? (
                    <div className="overflow-hidden rounded-md border border-border/60 bg-background/35">
                      {serviceOrderItems.length === 0 && (
                        <EmptyState>No order items added for this service yet.</EmptyState>
                      )}
                      {serviceOrderItems.slice(0, 6).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
                        >
                          <span className="min-w-0 truncate text-sm font-medium">{item.title}</span>
                          <span className="shrink-0 text-xs capitalize text-muted-foreground">
                            {item.duration_minutes ? `${item.duration_minutes}m` : item.item_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border/60 bg-background/35">
                      {serviceTeamAssignments.length === 0 && (
                        <EmptyState>No team assignments added yet.</EmptyState>
                      )}
                      {serviceTeamAssignments.slice(0, 7).map((assignment) => (
                        <div
                          key={assignment.id}
                          className="border-b border-border/60 px-3 py-2 last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-medium">
                              {assignment.role_name}:
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {assignment.person_name || "Unassigned"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border/60 bg-card/80 shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div>
                <p className="label-eyebrow">Projects</p>
                <h2 className="text-lg font-extrabold tracking-tight">Active project momentum</h2>
              </div>
              <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">
                {activeProjectCount} active
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {activeProjects.length === 0 && (
                <div className="p-4">
                  <EmptyState>No active projects yet.</EmptyState>
                </div>
              )}
              {activeProjects.slice(0, 4).map((project) => {
                const stats = projectProgress(project, projectTasks);
                return (
                  <Link
                    key={project.id}
                    to={`/tasks/projects/${project.id}`}
                    className="block px-4 py-3 transition hover:bg-brand-teal/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{project.name}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {stats.nextAction}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand-teal"
                            style={{ width: `${Math.min(Math.max(stats.progress, 0), 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-bold text-brand-teal">
                          {stats.progress}%
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div>
                <p className="label-eyebrow">Meetings</p>
                <h2 className="text-lg font-extrabold tracking-tight">Upcoming Meetings</h2>
              </div>
              <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">
                {upcomingMeetings.length}
              </span>
            </div>

            <div className="divide-y divide-border/60">
              {upcomingMeetings.length === 0 && (
                <div className="p-4">
                  <EmptyState>No meetings in the next 6 days.</EmptyState>
                </div>
              )}
              {upcomingMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/meetings/${meeting.id}`}
                  className="block px-4 py-3 transition hover:bg-brand-teal/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{meeting.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{formatShortDate(meeting.meeting_date)}</span>
                        {formatTime(meeting.meeting_time) && (
                          <span>{formatTime(meeting.meeting_time)}</span>
                        )}
                      </div>
                    </div>
                    <CalendarDays className="h-4 w-4 shrink-0 text-brand-teal" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <Card className="border-border/60 bg-card/95 shadow-soft">
          <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-eyebrow">Calendar</p>
              <h2 className="text-lg font-extrabold tracking-tight">
                {calendarView === "week" ? currentWeekLabel : currentMonthLabel}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border/70 bg-card p-0.5">
                {(["month", "week"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCalendarView(view)}
                    className={`h-7 rounded-md px-3 text-xs font-extrabold capitalize transition ${
                      calendarView === view
                        ? "bg-brand-teal text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-lg px-3">
                <Link to="/meetings">
                  Meetings
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto p-4">
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
                  className={`rounded-md border px-2.5 py-2 ${
                    !day.inMonth
                      ? "border-border/40 bg-background/20"
                      : day.key === todayKey
                        ? "border-brand-teal/45 bg-brand-teal/10"
                        : "border-border/70 bg-background/45"
                  } h-36`}
                >
                  {day.inMonth && (
                    <>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold">{day.day}</span>
                        </div>
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
                                    {item.time ? `${formatTime(item.time)} · ${item.label}` : item.label}
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
      </div>
    </div>
  );
};

export default Dashboard;
