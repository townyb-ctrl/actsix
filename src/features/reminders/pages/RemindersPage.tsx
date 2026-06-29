import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ReminderStatus = "pending" | "done" | "cancelled";

type Reminder = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  remind_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string;
  notes: string;
  category: string;
  status: ReminderStatus;
  show_on_calendar: boolean;
  calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type ReminderForm = {
  title: string;
  remindAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  notes: string;
  category: string;
  showOnCalendar: boolean;
};

const nowLocalInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const oneHourLaterInput = () => {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const toInputDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const emptyForm = (): ReminderForm => ({
  title: "",
  remindAt: nowLocalInput(),
  endAt: "",
  allDay: false,
  location: "",
  notes: "",
  category: "General",
  showOnCalendar: true,
});

const formatDay = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const formatTime = (value: string, allDay: boolean) => {
  if (allDay) return "All day";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const upsertReminderCalendarEvent = async ({
  reminder,
  workspaceId,
  userId,
}: {
  reminder: Reminder | Record<string, any>;
  workspaceId: string;
  userId: string;
}) => {
  const startDate = new Date(reminder.remind_at);
  const endDate = reminder.end_at
    ? new Date(reminder.end_at)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  const payload = {
    workspace_id: workspaceId,
    user_id: userId,
    title: reminder.title,
    calendar_name: "ACTSIX",
    source: "actsix",
    starts_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    all_day: Boolean(reminder.all_day),
    location: reminder.location || "",
    description: reminder.notes || "",
    status: reminder.status === "cancelled" ? "Cancelled" : "Confirmed",
    updated_at: new Date().toISOString(),
  };

  return reminder.calendar_event_id
    ? (supabase as any)
        .from("calendar_events")
        .update(payload)
        .eq("id", reminder.calendar_event_id)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single()
    : (supabase as any)
        .from("calendar_events")
        .insert(payload)
        .select("id")
        .single();
};

export default function RemindersPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [form, setForm] = useState<ReminderForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadReminders = useCallback(async () => {
    if (!workspace?.id || !user?.id) {
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("reminders")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id)
      .order("remind_at", { ascending: true });
    setLoading(false);

    if (error?.code === "42P01" || error?.code === "PGRST205") {
      toast.error("Apply the Reminders migration in Supabase, then reload.");
      return;
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    setReminders(data || []);
  }, [workspace?.id, user?.id]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const upcomingReminders = useMemo(
    () =>
      reminders.filter(
        (reminder) =>
          reminder.status === "pending" &&
          new Date(reminder.remind_at).getTime() >= new Date().setHours(0, 0, 0, 0)
      ),
    [reminders]
  );

  const completedReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status !== "pending"),
    [reminders]
  );

  const openNewReminder = () => {
    setEditingReminder(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEditReminder = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setForm({
      title: reminder.title,
      remindAt: toInputDateTime(reminder.remind_at),
      endAt: toInputDateTime(reminder.end_at),
      allDay: reminder.all_day,
      location: reminder.location,
      notes: reminder.notes,
      category: reminder.category,
      showOnCalendar: reminder.show_on_calendar,
    });
    setFormOpen(true);
  };

  const saveReminder = async () => {
    if (!workspace?.id || !user?.id) return;

    if (!form.title.trim()) {
      toast.error("Give the reminder a title.");
      return;
    }

    if (!form.remindAt) {
      toast.error("Choose when ACTSIX should remember this.");
      return;
    }

    setSaving(true);

    try {
      const reminderPayload = {
        workspace_id: workspace.id,
        user_id: user.id,
        title: form.title.trim(),
        remind_at: new Date(form.remindAt).toISOString(),
        end_at: form.endAt ? new Date(form.endAt).toISOString() : null,
        all_day: form.allDay,
        location: form.location.trim(),
        notes: form.notes.trim(),
        category: form.category.trim() || "General",
        show_on_calendar: form.showOnCalendar,
        status: editingReminder?.status || "pending",
        calendar_event_id: editingReminder?.calendar_event_id || null,
        updated_at: new Date().toISOString(),
      };

      const result = editingReminder
        ? await (supabase as any)
            .from("reminders")
            .update(reminderPayload)
            .eq("id", editingReminder.id)
            .eq("user_id", user.id)
            .select("*")
            .single()
        : await (supabase as any)
            .from("reminders")
            .insert(reminderPayload)
            .select("*")
            .single();

      if (result.error) throw result.error;

      const savedReminder = result.data as Reminder;

      if (form.showOnCalendar) {
        const { data: calendarEvent, error: calendarError } =
          await upsertReminderCalendarEvent({
            reminder: savedReminder,
            workspaceId: workspace.id,
            userId: user.id,
          });

        if (calendarError) throw calendarError;

        if (calendarEvent?.id && calendarEvent.id !== savedReminder.calendar_event_id) {
          const { error: linkError } = await (supabase as any)
            .from("reminders")
            .update({
              calendar_event_id: calendarEvent.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", savedReminder.id)
            .eq("user_id", user.id);

          if (linkError) throw linkError;
        }
      } else if (savedReminder.calendar_event_id) {
        const { error: calendarDeleteError } = await (supabase as any)
          .from("calendar_events")
          .delete()
          .eq("id", savedReminder.calendar_event_id)
          .eq("workspace_id", workspace.id);

        if (calendarDeleteError) throw calendarDeleteError;

        const { error: unlinkError } = await (supabase as any)
          .from("reminders")
          .update({
            calendar_event_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", savedReminder.id)
          .eq("user_id", user.id);

        if (unlinkError) throw unlinkError;
      }

      setFormOpen(false);
      setEditingReminder(null);
      await loadReminders();
      toast.success(editingReminder ? "Reminder updated" : "Reminder added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save reminder.");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (reminder: Reminder, status: ReminderStatus) => {
    if (!user?.id || !workspace?.id) return;

    const { error } = await (supabase as any)
      .from("reminders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reminder.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (reminder.calendar_event_id) {
      await (supabase as any)
        .from("calendar_events")
        .update({
          status: status === "cancelled" ? "Cancelled" : "Confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.calendar_event_id)
        .eq("workspace_id", workspace.id);
    }

    await loadReminders();
    toast.success(status === "done" ? "Reminder marked done" : "Reminder updated");
  };

  const deleteReminder = async (reminder: Reminder) => {
    if (!user?.id || !workspace?.id) return;

    const { error } = await (supabase as any)
      .from("reminders")
      .delete()
      .eq("id", reminder.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (reminder.calendar_event_id) {
      await (supabase as any)
        .from("calendar_events")
        .delete()
        .eq("id", reminder.calendar_event_id)
        .eq("workspace_id", workspace.id);
    }

    await loadReminders();
    toast.success("Reminder deleted");
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => {
    const isDone = reminder.status !== "pending";

    return (
      <Card
        className={cn(
          "actsix-panel p-3 transition",
          isDone && "bg-muted/20 opacity-75"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-teal">
                {reminder.category || "General"}
              </span>
              {reminder.show_on_calendar && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Calendar
                </span>
              )}
            </div>

            <h2 className="mt-2 text-base font-extrabold tracking-tight">
              {reminder.title}
            </h2>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5 text-brand-amber" />
                {formatDay(reminder.remind_at)} · {formatTime(reminder.remind_at, reminder.all_day)}
              </span>
              {reminder.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-brand-teal" />
                  {reminder.location}
                </span>
              )}
            </div>

            {reminder.notes && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {reminder.notes}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {reminder.status === "pending" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-brand-sage"
                title="Mark done"
                aria-label="Mark reminder done"
                onClick={() => updateStatus(reminder, "done")}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title="Edit reminder"
              aria-label="Edit reminder"
              onClick={() => openEditReminder(reminder)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
              title="Delete reminder"
              aria-label="Delete reminder"
              onClick={() => deleteReminder(reminder)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Reminders"
        subtitle="Keep date-based things that are not tasks, projects, or meetings."
        actions={
          <Button
            type="button"
            size="sm"
            className="actsix-btn-primary h-9"
            onClick={openNewReminder}
          >
            <Plus className="h-4 w-4" />
            Add Reminder
          </Button>
        }
      />

      <div className="actsix-page-body space-y-4 pb-12">
        <section className="actsix-panel-soft grid gap-px overflow-hidden md:grid-cols-3">
          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">Upcoming</p>
                <div className="mt-1 text-xl font-extrabold">{upcomingReminders.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-amber/10 text-brand-amber">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">On Calendar</p>
                <div className="mt-1 text-xl font-extrabold">
                  {reminders.filter((reminder) => reminder.show_on_calendar).length}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-sage/10 text-brand-sage">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">Completed</p>
                <div className="mt-1 text-xl font-extrabold">{completedReminders.length}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-extrabold">Upcoming Reminders</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Personal reminders for services, care moments, errands, and events.
            </p>
          </div>

          {loading && (
            <Card className="actsix-panel p-5 text-sm font-semibold text-muted-foreground">
              Loading reminders...
            </Card>
          )}

          {!loading && upcomingReminders.length === 0 && (
            <Card className="actsix-empty-state p-5 text-left">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Bell className="h-4 w-4 text-brand-teal" />
                No upcoming reminders yet.
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Add a reminder for something like a funeral, visit, errand, or personal ministry note.
              </p>
            </Card>
          )}

          {upcomingReminders.map((reminder) => (
            <ReminderCard key={reminder.id} reminder={reminder} />
          ))}
        </section>

        {completedReminders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold">Done or Cancelled</h2>
            {completedReminders.map((reminder) => (
              <ReminderCard key={reminder.id} reminder={reminder} />
            ))}
          </section>
        )}
      </div>

      <ResponsiveModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingReminder(null);
        }}
        title={editingReminder ? "Edit Reminder" : "Add Reminder"}
        description="Save ordinary date-based things in ACTSIX without making them tasks or projects."
      >
        <div className="space-y-4">
          <div>
            <label className="label-eyebrow">Title</label>
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Funeral at church"
              className="mt-2 h-11 rounded-xl border-border/70 bg-background"
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-eyebrow">When</label>
              <Input
                type="datetime-local"
                value={form.remindAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, remindAt: event.target.value }))
                }
                className="mt-2 h-11 rounded-xl border-border/70 bg-background"
              />
            </div>

            <div>
              <label className="label-eyebrow">Ends</label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endAt: event.target.value }))
                }
                placeholder={oneHourLaterInput()}
                className="mt-2 h-11 rounded-xl border-border/70 bg-background"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-eyebrow">Location</label>
              <Input
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Church"
                className="mt-2 h-11 rounded-xl border-border/70 bg-background"
              />
            </div>

            <div>
              <label className="label-eyebrow">Category</label>
              <Input
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
                placeholder="Pastoral Care"
                className="mt-2 h-11 rounded-xl border-border/70 bg-background"
              />
            </div>
          </div>

          <div>
            <label className="label-eyebrow">Notes</label>
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Any details you want to remember..."
              className="mt-2 min-h-24 rounded-xl border-border/70 bg-background"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(event) =>
                  setForm((current) => ({ ...current, allDay: event.target.checked }))
                }
                className="h-4 w-4 accent-brand-teal"
              />
              All day
            </label>

            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.showOnCalendar}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    showOnCalendar: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-brand-teal"
              />
              Show on calendar
            </label>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="actsix-btn-primary rounded-xl"
              disabled={saving}
              onClick={saveReminder}
            >
              <Bell className="h-4 w-4" />
              {saving ? "Saving..." : "Save Reminder"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
