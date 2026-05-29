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

const priorityClass = (priority?: string | null) => {
  return "bg-brand-sage/10 text-brand-sage";
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
    openTasks: openTasks.length || project.open_tasks || 0,
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
  "text-sm font-black uppercase underline decoration-2 underline-offset-4";

const Dashboard = () => {
  const { user } = useAuth();
  const { displayName } = useCurrentPerson();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [nextService, setNextService] = useState<ServiceInstance | null>(null);
  const [serviceOrderItems, setServiceOrderItems] = useState<ServiceOrderItem[]>([]);
  const [serviceTeamAssignments, setServiceTeamAssignments] = useState<ServiceTeamAssignment[]>([]);
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);
      const today = toDateKey(startOfToday());
      const monthStart = toDateKey(startOfMonth(startOfToday()));
      const monthEnd = toDateKey(endOfMonth(startOfToday()));

      const [
        taskResult,
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
          .from("projects")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("meetings")
          .select("*")
          .gte("meeting_date", monthStart)
          .lte("meeting_date", monthEnd)
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
        const aStats = projectProgress(a, tasks);
        const bStats = projectProgress(b, tasks);
        return bStats.openTasks - aStats.openTasks;
      })
      .slice(0, 4);
  }, [projects, tasks]);

  const overdueCount = tasks.filter((task) => task.due && task.due < todayKey).length;
  const dueTodayCount = tasks.filter((task) => task.due === todayKey).length;
  const activeProjectCount = projects.filter(
    (project) => !project.status?.toLowerCase().includes("complete")
  ).length;

  const calendarItems = useMemo(() => {
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

    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1);
      const key = toDateKey(date);
      return {
        key,
        day: index + 1,
        weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
        items: calendarItems.filter((item) => item.date === key).slice(0, 3),
      };
    });
  }, [calendarItems, currentMonth]);

  const currentWeek = useMemo(() => startOfWeek(startOfToday()), []);
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + index);
      const key = toDateKey(date);

      return {
        key,
        day: date.getDate(),
        weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
        items: calendarItems.filter((item) => item.date === key).slice(0, 6),
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
      <PageHeader
        eyebrow="ACTSIX"
        title="Homebase"
        subtitle={`${greeting}, ${displayName}. What needs attention across ACTSIX.`}
      />

      <div className="w-full space-y-5 px-4 pb-10 sm:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="border-border/70 bg-card shadow-card">
            <div className="border-b border-brand-sage/25 bg-brand-sage/5 px-5 py-4">
              <p className="label-eyebrow">Homebase</p>
              <h2 className="text-xl font-extrabold tracking-tight">Tasks Overview</h2>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className={`${sectionHeadingClass} decoration-brand-sage text-foreground`}>Today</h3>
                  <span className="rounded-full bg-brand-sage/10 px-2 py-0.5 text-[11px] font-semibold text-brand-sage">
                    {dueTodayCount}
                  </span>
                </div>
                <div className="overflow-hidden rounded-md border border-brand-sage/25 bg-brand-sage/5">
                  {todaysTasks.length === 0 && <EmptyState>No tasks due today.</EmptyState>}
                  {todaysTasks.slice(0, 4).map((task) => (
                    <Link
                      key={task.id}
                      to="/tasks/next"
                      className="block border-b border-border/60 px-3 py-2 transition last:border-b-0 hover:bg-brand-sage/10"
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
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className={`${sectionHeadingClass} decoration-brand-sage text-foreground`}>Projects</h3>
                  <span className="rounded-full bg-brand-sage/10 px-2 py-0.5 text-[11px] font-semibold text-brand-sage">
                    {activeProjectCount}
                  </span>
                </div>
                <div className="overflow-hidden rounded-md border border-brand-sage/25 bg-brand-sage/5">
                  {activeProjects.length === 0 && <EmptyState>No active projects yet.</EmptyState>}
                  {activeProjects.slice(0, 4).map((project) => {
                    const stats = projectProgress(project, tasks);
                    return (
                      <Link
                        key={project.id}
                        to={`/tasks/projects/${project.id}`}
                        className="block border-b border-border/60 px-3 py-2 transition last:border-b-0 hover:bg-brand-sage/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 truncate text-sm font-medium">{project.name}</div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-brand-sage"
                                style={{ width: `${Math.min(Math.max(stats.progress, 0), 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-brand-sage">
                              {stats.progress}%
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section className="md:col-span-2">
                <h3 className={`${sectionHeadingClass} mb-2 decoration-brand-sage text-foreground`}>Most Important</h3>
                <div className="overflow-hidden rounded-md border border-brand-sage/25 bg-brand-sage/5">
                  {importantTasks.length === 0 && <EmptyState>No important open tasks yet.</EmptyState>}
                  {importantTasks.slice(0, 3).map((task) => (
                    <Link
                      key={task.id}
                      to="/tasks/next"
                      className="block border-b border-border/60 px-3 py-2 transition last:border-b-0 hover:bg-brand-sage/10"
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

          <Card className="border-border/70 bg-card shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-brand-sage/25 bg-brand-sage/5 px-5 py-4">
              <div>
                <p className="label-eyebrow">Service Planner</p>
                <h2 className="text-xl font-extrabold tracking-tight">Upcoming Service</h2>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-full px-3">
                <Link to={nextService ? `/service-planner/services/${nextService.id}` : "/service-planner"}>
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {!nextService ? (
              <div className="p-5">
                <EmptyState>No upcoming service dates found.</EmptyState>
              </div>
            ) : (
              <div className="grid gap-4 p-5 md:grid-cols-[1.1fr_0.9fr]">
                <section>
                  <h3 className={`${sectionHeadingClass} mb-2 decoration-brand-sage text-foreground`}>
                    Service Info
                  </h3>
                  <div className="mb-3 rounded-md border border-brand-sage/25 bg-brand-sage/5 px-3 py-2">
                    <div className="truncate text-sm font-medium">
                      {nextService.title || nextService.service_types?.name || "Upcoming service"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(nextService.service_date)}
                      </span>
                      {formatTime(nextService.start_time) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatTime(nextService.start_time)}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className={`${sectionHeadingClass} mb-2 decoration-brand-sage text-foreground`}>Service plan</h3>
                  <div className="overflow-hidden rounded-md border border-brand-sage/25 bg-brand-sage/5">
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
                </section>

                <section className="border-t border-border/70 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                  <h3 className={`${sectionHeadingClass} mb-2 decoration-brand-sage text-foreground`}>Team</h3>
                  <div className="overflow-hidden rounded-md border border-brand-sage/25 bg-brand-sage/5">
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
                </section>
              </div>
            )}
          </Card>
        </div>

        <Card className="border-border/70 bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-brand-bronze/25 bg-brand-bronze/5 px-5 py-4">
            <div>
              <p className="label-eyebrow">Calendar</p>
              <h2 className="text-xl font-extrabold tracking-tight">
                {calendarView === "week" ? currentWeekLabel : currentMonthLabel}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-border/70 bg-card p-0.5">
                {(["month", "week"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCalendarView(view)}
                    className={`h-7 rounded-full px-3 text-xs font-extrabold capitalize transition ${
                      calendarView === view
                        ? "bg-brand-bronze text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-full px-3">
                <Link to="/meetings">
                  Meetings
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div
            className={`grid gap-3 p-5 ${
              calendarView === "week"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7"
                : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-8"
            }`}
          >
            {visibleCalendarDays.map((day) => (
              <div
                key={day.key}
                className={`rounded-lg border px-3 py-2 ${
                  day.key === todayKey
                    ? "border-brand-bronze/50 bg-brand-bronze/10"
                    : "border-border/70 bg-background/45"
                } ${calendarView === "week" ? "min-h-48" : "min-h-28"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase text-muted-foreground">
                      {day.weekday}
                    </div>
                    <span className="text-sm font-semibold">{day.day}</span>
                  </div>
                  {day.key === todayKey && (
                    <span className="rounded-full bg-brand-bronze px-2 py-0.5 text-[10px] font-semibold text-white">
                      Today
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {day.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        className="block rounded-md bg-card/80 px-2 py-1 text-xs transition hover:bg-brand-bronze/10"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <ItemIcon className="h-3 w-3 shrink-0 text-brand-bronze" />
                          <span className="truncate font-medium">{item.title}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {item.time ? `${formatTime(item.time)} - ${item.label}` : item.label}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
