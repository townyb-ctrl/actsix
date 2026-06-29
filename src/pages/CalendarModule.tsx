import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Apple,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TaskEditorModal from "@/components/TaskEditorModal";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { syncProjectStatsForIds } from "@/lib/syncProjectStats";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import { cn } from "@/lib/utils";

type CalendarSource = "actsix" | "task" | "google" | "outlook" | "apple";
type CalendarStatus = "Tentative" | "Confirmed" | "Cancelled";
type SyncProvider = "google" | "outlook" | "apple";
type SyncStatus = "Not Connected" | "Connected" | "Needs Attention";

type CalendarEvent = {
  id: string;
  entityId: string;
  entityType: "event" | "task";
  title: string;
  calendarName: string;
  source: CalendarSource;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  description: string;
  status: CalendarStatus;
  task?: any;
};

type SyncConnection = {
  id: string;
  provider: SyncProvider;
  accountLabel: string;
  status: SyncStatus;
  lastSyncedAt?: string | null;
  syncDirection: "import_only" | "export_only" | "two_way";
};

type EventForm = {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  calendarName: string;
  status: CalendarStatus;
  description: string;
};

type AppleSyncForm = {
  appleId: string;
  appSpecificPassword: string;
  calendarUrl: string;
  accountLabel: string;
};

const sourceStyles: Record<CalendarSource, string> = {
  actsix: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
  task: "border-brand-amber/25 bg-brand-amber/10 text-brand-amber",
  google: "border-brand-sage/25 bg-brand-sage/10 text-brand-sage",
  outlook: "border-primary/20 bg-primary/10 text-primary",
  apple: "border-border/70 bg-muted text-muted-foreground",
};

const syncLabels: Record<SyncProvider, string> = {
  google: "Google Calendar",
  outlook: "Outlook Calendar",
  apple: "Apple Calendar",
};

const providerIcons: Record<SyncProvider, typeof CalendarDays> = {
  google: CalendarDays,
  outlook: CalendarDays,
  apple: Apple,
};

const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const oneHourLater = () => {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const emptyForm = (): EventForm => ({
  title: "",
  startsAt: nowLocalInput(),
  endsAt: oneHourLater(),
  allDay: false,
  location: "",
  calendarName: "ACTSIX",
  status: "Confirmed",
  description: "",
});

const emptyAppleSyncForm = (): AppleSyncForm => ({
  appleId: "",
  appSpecificPassword: "",
  calendarUrl: "",
  accountLabel: "",
});

const toInputDateTime = (value: string) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const formatTime = (value: string, allDay?: boolean) => {
  if (allDay) return "All day";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
};

const formatDay = (value: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(value));

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const getTaskCalendarRange = (task: any) => {
  const due = task.due || "";
  const hasTime = Boolean(task.start_time);
  const startsAt = due.includes("T")
    ? due
    : `${due}T${hasTime ? task.start_time : "00:00:00"}`;
  const startDate = new Date(startsAt);
  const endDate = hasTime
    ? new Date(startDate.getTime() + Math.max(Number(task.minutes) || 15, 15) * 60 * 1000)
    : new Date(`${due}T23:59:59`);

  return {
    startsAt,
    endsAt: endDate.toISOString(),
    allDay: !hasTime,
  };
};

export default function CalendarModule() {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { workspace } = useCurrentWorkspace();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connections, setConnections] = useState<SyncConnection[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | CalendarSource>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [appleSyncOpen, setAppleSyncOpen] = useState(false);
  const [appleSyncForm, setAppleSyncForm] = useState<AppleSyncForm>(emptyAppleSyncForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [syncingApple, setSyncingApple] = useState(false);

  const loadCalendar = async () => {
    if (!workspace?.id || !user?.id) {
      setEvents([]);
      setConnections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [eventResult, connectionResult, taskResult] = await Promise.all([
      (supabase as any)
        .from("calendar_events")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("starts_at", { ascending: true }),
      (supabase as any)
        .from("calendar_sync_connections")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("provider", { ascending: true }),
      (supabase as any)
        .from("tasks")
        .select("*, project_sections(name), recurring_task_templates(frequency, interval)")
        .or(personalNextActionFilter(currentPerson?.id))
        .eq("complete", false)
        .not("due", "is", null)
        .order("due", { ascending: true }),
    ]);
    setLoading(false);

    if (eventResult.error?.code === "42P01" || connectionResult.error?.code === "42P01") {
      toast.error("Apply the Calendar module migration in Supabase, then reload Calendar.");
      return;
    }

    if (eventResult.error) toast.error(eventResult.error.message);
    if (connectionResult.error) toast.error(connectionResult.error.message);
    if (taskResult.error) toast.error(taskResult.error.message);

    const calendarEvents = (eventResult.data || []).map((event: any) => ({
      id: `event-${event.id}`,
      entityId: event.id,
      entityType: "event" as const,
      title: event.title,
      calendarName: event.calendar_name,
      source: event.source,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      allDay: event.all_day,
      location: event.location,
      description: event.description,
      status: event.status,
    }));

    const taskEvents = (taskResult.data || []).map((task: any) => {
      const range = getTaskCalendarRange(task);

      return {
        id: `task-${task.id}`,
        entityId: task.id,
        entityType: "task" as const,
        title: task.title,
        calendarName: "Tasks",
        source: "task" as const,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        allDay: range.allDay,
        location: task.location || "",
        description: task.notes || "",
        status: "Confirmed" as CalendarStatus,
        task,
      };
    });

    setEvents([...calendarEvents, ...taskEvents]);

    setConnections(
      (connectionResult.data || []).map((connection: any) => ({
        id: connection.id,
        provider: connection.provider,
        accountLabel: connection.account_label,
        status: connection.status,
        lastSyncedAt: connection.last_synced_at,
        syncDirection: connection.sync_direction,
      }))
    );
  };

  useEffect(() => {
    loadCalendar();
  }, [workspace?.id, user?.id, currentPerson?.id]);

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const days = useMemo(() => {
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [gridStart.getTime()]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSource = sourceFilter === "all" || event.source === sourceFilter;
      const matchesQuery =
        !normalizedQuery ||
        [event.title, event.calendarName, event.location, event.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesSource && matchesQuery;
    });
  }, [events, query, sourceFilter]);

  const visibleEvents = filteredEvents.filter((event) => {
    const starts = new Date(event.startsAt);
    return starts >= monthStart && starts <= monthEnd;
  });

  const upcomingEvents = filteredEvents
    .filter((event) => new Date(event.endsAt) >= new Date())
    .slice(0, 8);

  const sourceOptions: Array<{ value: "all" | CalendarSource; label: string }> = [
    { value: "all", label: "All" },
    { value: "actsix", label: "ACTSIX" },
    { value: "task", label: "Tasks" },
    { value: "google", label: "Google" },
    { value: "outlook", label: "Outlook" },
    { value: "apple", label: "Apple" },
  ];

  const openNewEvent = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const editEvent = (event: CalendarEvent) => {
    if (event.entityType === "task") {
      setEditingTask({ ...event.task });
      return;
    }

    setEditingId(event.entityId);
    setForm({
      title: event.title,
      startsAt: toInputDateTime(event.startsAt),
      endsAt: toInputDateTime(event.endsAt),
      allDay: event.allDay,
      location: event.location,
      calendarName: event.calendarName,
      status: event.status,
      description: event.description,
    });
    setFormOpen(true);
  };

  const saveEvent = async () => {
    if (!workspace?.id || !user?.id) return;
    if (!form.title.trim()) {
      toast.error("Give the calendar event a title.");
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      calendar_name: form.calendarName.trim() || "ACTSIX",
      source: "actsix",
      starts_at: new Date(form.startsAt).toISOString(),
      ends_at: new Date(form.endsAt).toISOString(),
      all_day: form.allDay,
      location: form.location.trim(),
      description: form.description.trim(),
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await (supabase as any)
          .from("calendar_events")
          .update(payload)
          .eq("id", editingId)
          .eq("workspace_id", workspace.id)
      : await (supabase as any)
          .from("calendar_events")
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            ...payload,
          });

    setSaving(false);

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    setFormOpen(false);
    setEditingId(null);
    await loadCalendar();
    toast.success(editingId ? "Calendar event updated" : "Calendar event added");
  };

  const deleteEvent = async (eventId: string) => {
    if (!workspace?.id) return;
    const { error } = await (supabase as any)
      .from("calendar_events")
      .delete()
      .eq("id", eventId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadCalendar();
    toast.success("Calendar event removed");
  };

  const saveTask = async () => {
    if (!editingTask) return;

    setSavingTask(true);

    const previousProjectId = editingTask.project_id || null;
    const { error } = await supabase
      .from("tasks")
      .update({
        title: editingTask.title || "",
        notes: editingTask.notes || "",
        project: editingTask.project || "",
        project_id: editingTask.project_id || null,
        context: editingTask.context || "General",
        priority: editingTask.priority || "Medium",
        energy: editingTask.energy || "Medium",
        minutes: Number(editingTask.minutes) || 15,
        due: editingTask.due || null,
        tags: Array.isArray(editingTask.tags) ? editingTask.tags : [],
        assigned_person_id: editingTask.assigned_person_id || null,
        complete: Boolean(editingTask.complete),
        completed_at: editingTask.complete
          ? editingTask.completed_at || new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingTask.id);

    setSavingTask(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsForIds([previousProjectId, editingTask.project_id]);
    setEditingTask(null);
    await loadCalendar();
    toast.success("Task updated");
  };

  const connectProvider = async (provider: SyncProvider) => {
    if (provider === "apple") {
      const existing = connections.find((connection) => connection.provider === "apple");
      setAppleSyncForm((current) => ({
        ...current,
        accountLabel: existing?.accountLabel && existing.accountLabel !== "Not configured" ? existing.accountLabel : "",
      }));
      setAppleSyncOpen(true);
      return;
    }

    if (!workspace?.id || !user?.id) return;
    const { error } = await (supabase as any)
      .from("calendar_sync_connections")
      .upsert(
        {
          workspace_id: workspace.id,
          user_id: user.id,
          provider,
          account_label: `${syncLabels[provider]} account`,
          status: "Needs Attention",
          sync_direction: "two_way",
          settings: {
            setup_required: true,
            note:
              provider === "apple"
                ? "Apple Calendar sync normally uses CalDAV/app-specific credentials."
                : "OAuth credentials are required before live sync can run.",
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,user_id,provider" }
      );

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadCalendar();
    toast.success(`${syncLabels[provider]} marked for setup`);
  };

  const syncAppleCalendar = async () => {
    if (!workspace?.id) return;
    if (!appleSyncForm.appleId.trim() || !appleSyncForm.appSpecificPassword.trim() || !appleSyncForm.calendarUrl.trim()) {
      toast.error("Apple ID, app-specific password, and CalDAV calendar URL are required.");
      return;
    }

    setSyncingApple(true);
    const { data, error } = await supabase.functions.invoke("apple-calendar-sync", {
      body: {
        workspace_id: workspace.id,
        apple_id: appleSyncForm.appleId.trim(),
        app_specific_password: appleSyncForm.appSpecificPassword.trim(),
        calendar_url: appleSyncForm.calendarUrl.trim(),
        account_label: appleSyncForm.accountLabel.trim() || appleSyncForm.appleId.trim(),
        sync_direction: "import_only",
      },
    });
    setSyncingApple(false);

    if (error) {
      toast.error(error.message || "Apple Calendar sync failed.");
      return;
    }

    setAppleSyncOpen(false);
    setAppleSyncForm(emptyAppleSyncForm());
    await loadCalendar();
    toast.success(`Apple Calendar synced: ${data?.imported || 0} added, ${data?.updated || 0} updated`);
  };

  const connectedCount = connections.filter((connection) => connection.status === "Connected").length;

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Calendar"
        subtitle="One view for ACTSIX events, meetings, services, tasks, and external calendars."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="actsix-search-field sm:w-48 lg:w-56">
              <Search className="actsix-search-icon" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search calendar..."
                className="actsix-search-input"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" className="actsix-btn-primary h-8 rounded-full px-3 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={openNewEvent}
                >
                  <CalendarDays className="h-4 w-4 text-brand-teal" />
                  Event
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => navigate("/reminders")}
                >
                  <Bell className="h-4 w-4 text-brand-amber" />
                  Reminder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="actsix-page-body actsix-page-stack pb-12">
        <div className="actsix-filter-pills">
          {sourceOptions.map((option) => {
            const active = sourceFilter === option.value;
            const count =
              option.value === "all" ? events.length : events.filter((event) => event.source === option.value).length;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSourceFilter(option.value)}
                className={cn(
                  "actsix-filter-pill",
                  active
                    ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                    : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:bg-brand-teal/5 hover:text-brand-teal"
                )}
              >
                {option.label}
                <span className={cn("actsix-filter-pill-count", active ? "bg-brand-teal/15" : "bg-muted")}>{count}</span>
              </button>
            );
          })}
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
          <Card className="actsix-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
              <div>
                <p className="label-eyebrow">
                  {visibleMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </p>
                <h2 className="sr-only">Month View</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setVisibleMonth(startOfMonth(new Date()))}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-border/70 bg-muted/35 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="px-2 py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayKey = day.toISOString().slice(0, 10);
                const dayEvents = filteredEvents.filter((event) => event.startsAt.slice(0, 10) === dayKey);
                const muted = day.getMonth() !== visibleMonth.getMonth();
                const today = dayKey === new Date().toISOString().slice(0, 10);

                return (
                  <div key={dayKey} className={cn("min-h-28 border-b border-r border-border/60 p-2 last:border-r-0", muted && "bg-muted/20 text-muted-foreground")}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cn("text-xs font-extrabold", today && "rounded-full bg-brand-teal px-1.5 py-0.5 text-white")}>
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 2 && <span className="text-[10px] font-bold text-muted-foreground">+{dayEvents.length - 2}</span>}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => editEvent(event)}
                          className={cn("block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-bold", sourceStyles[event.source])}
                        >
                          {event.allDay ? event.title : `${formatTime(event.startsAt, event.allDay)} ${event.title}`}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <aside className="space-y-2.5">
            <Card className="actsix-panel bg-background/55 p-2 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-eyebrow">Agenda</p>
                  <h2 className="mt-0.5 text-sm font-extrabold">Upcoming</h2>
                </div>
                {loading && <span className="text-xs font-bold text-muted-foreground">Loading...</span>}
              </div>

              <div className="mt-1.5 max-h-[20rem] space-y-1.5 overflow-y-auto pr-1">
                {!loading && upcomingEvents.length === 0 && (
                  <div className="actsix-empty-state min-h-16 text-left text-xs">
                    No upcoming calendar events.
                  </div>
                )}
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="rounded-md border border-border/50 bg-background/45 px-2 py-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold">{event.title}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                          {formatDay(event.startsAt)} · {formatTime(event.startsAt, event.allDay)}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 rounded-full px-1.5 py-0 text-[9px] font-bold", sourceStyles[event.source])}>
                        {event.source === "task" ? "task" : event.source}
                      </Badge>
                    </div>
                    {event.location && (
                      <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-medium text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </p>
                    )}
                    <div className="mt-1 flex justify-end gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => editEvent(event)}>
                        <CalendarDays className="h-3 w-3" />
                      </Button>
                      {event.entityType === "event" && event.source === "actsix" && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive" onClick={() => deleteEvent(event.entityId)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="actsix-panel bg-background/55 p-2 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-eyebrow">Sync</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                    {connectedCount} connected
                  </p>
                </div>
              </div>

              <div className="mt-1.5 divide-y divide-border/50 overflow-hidden rounded-md border border-border/50 bg-background/35">
                {(["google", "outlook", "apple"] as SyncProvider[]).map((provider) => {
                  const connection = connections.find((item) => item.provider === provider);
                  const Icon = providerIcons[provider];
                  const status = connection?.status || "Not Connected";

                  return (
                    <div key={provider} className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-teal/10 text-brand-teal">
                            <Icon className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-extrabold">{syncLabels[provider]}</p>
                            <p className="truncate text-[10px] font-semibold text-muted-foreground">
                              {connection?.accountLabel || "Not configured"}
                            </p>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" className="ml-auto h-6 shrink-0 rounded-full px-2 text-[11px] text-muted-foreground hover:text-brand-teal" onClick={() => connectProvider(provider)}>
                          {provider === "apple" && status === "Connected" ? "Sync" : "Connect"}
                        </Button>
                      </div>
                      {status !== "Not Connected" && (
                        <Badge variant="outline" className={cn("mt-1 rounded-full px-1.5 py-0 text-[9px] font-bold", status === "Connected" ? "border-brand-sage/25 bg-brand-sage/10 text-brand-sage" : "border-brand-amber/25 bg-brand-amber/10 text-brand-amber")}>
                          {status}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </aside>
        </section>
      </div>

      <ResponsiveModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
        title={editingId ? "Edit Calendar Event" : "Add Calendar Event"}
        description="Create an ACTSIX calendar event. Synced provider events are read through their calendar connection."
        className="max-h-[92svh] max-w-3xl overflow-y-auto rounded-xl"
        bodyClassName="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">Title</span>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="h-9 rounded-xl bg-background" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Starts</span>
            <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} className="h-9 rounded-xl bg-background" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Ends</span>
            <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} className="h-9 rounded-xl bg-background" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Calendar</span>
            <Input value={form.calendarName} onChange={(event) => setForm((current) => ({ ...current, calendarName: event.target.value }))} className="h-9 rounded-xl bg-background" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Status</span>
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CalendarStatus }))} className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none">
              <option>Tentative</option>
              <option>Confirmed</option>
              <option>Cancelled</option>
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">Location</span>
            <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="h-9 rounded-xl bg-background" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-semibold">
            <input type="checkbox" checked={form.allDay} onChange={(event) => setForm((current) => ({ ...current, allDay: event.target.checked }))} />
            All-day event
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">Description</span>
            <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-xl bg-background" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="actsix-btn-primary h-9 rounded-xl" onClick={saveEvent} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Add event"}
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={appleSyncOpen}
        onOpenChange={(open) => {
          setAppleSyncOpen(open);
          if (!open) setAppleSyncForm(emptyAppleSyncForm());
        }}
        title="Sync Apple Calendar"
        description="Import Apple Calendar events into ACTSIX using CalDAV and an Apple app-specific password."
        className="max-h-[92svh] max-w-2xl overflow-y-auto rounded-xl"
        bodyClassName="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Apple ID</span>
            <Input
              value={appleSyncForm.appleId}
              onChange={(event) => setAppleSyncForm((current) => ({ ...current, appleId: event.target.value }))}
              placeholder="name@icloud.com"
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">App-specific password</span>
            <Input
              type="password"
              value={appleSyncForm.appSpecificPassword}
              onChange={(event) => setAppleSyncForm((current) => ({ ...current, appSpecificPassword: event.target.value }))}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">CalDAV calendar URL</span>
            <Input
              value={appleSyncForm.calendarUrl}
              onChange={(event) => setAppleSyncForm((current) => ({ ...current, calendarUrl: event.target.value }))}
              placeholder="https://caldav.icloud.com/..."
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">Connection label</span>
            <Input
              value={appleSyncForm.accountLabel}
              onChange={(event) => setAppleSyncForm((current) => ({ ...current, accountLabel: event.target.value }))}
              placeholder="Brandon's Apple Calendar"
              className="h-9 rounded-xl bg-background"
            />
          </label>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs font-medium text-muted-foreground">
          This first Apple sync imports events from 30 days back through 365 days ahead. ACTSIX does not save the app-specific password in the browser after the sync modal closes.
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl" onClick={() => setAppleSyncOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="actsix-btn-primary h-9 rounded-xl" onClick={syncAppleCalendar} disabled={syncingApple}>
            {syncingApple ? "Syncing..." : "Sync Apple Calendar"}
          </Button>
        </div>
      </ResponsiveModal>

      <TaskEditorModal
        task={editingTask}
        saving={savingTask}
        eyebrow="Calendar Task"
        description="Edit this dated task from the shared ACTSIX task editor."
        onChange={setEditingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
        onRefreshOptions={loadCalendar}
      />
    </div>
  );
}
