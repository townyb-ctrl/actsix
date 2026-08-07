import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Repeat,
  Search,
  Trash2,
  Users,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  fromRecurringMeetingRow,
  notifyRecurringMeetingsChanged,
  toRecurringMeetingInsert,
  type RecurringMeeting,
} from "@/features/meetings/lib/recurringMeetings";
import { useRecurringPeopleGroupOptions } from "@/features/meetings/hooks/useRecurringPeopleGroupOptions";

const formatDate = (date?: string | null) => {
  if (!date) return "No start date";

  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const RecurringMeetingsPage = () => {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [items, setItems] = useState<RecurringMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"Weekly" | "Monthly">("Weekly");
  const [startDate, setStartDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");
  const [occurrences, setOccurrences] = useState("12");
  const peopleGroupOptions = useRecurringPeopleGroupOptions();
  const [selectedPeopleGroupId, setSelectedPeopleGroupId] = useState("");
  const [saving, setSaving] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringMeeting | null>(null);

  const loadSeries = async () => {
    if (!workspace) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("recurring_meeting_series")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("title", { ascending: true });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      setLoading(false);
      return;
    }

    setItems((data || []).map(fromRecurringMeetingRow));
    setLoading(false);
  };

  useEffect(() => {
    loadSeries();
  }, [workspace?.id]);


  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (!q) return true;

      return (
        item.title.toLowerCase().includes(q) ||
        item.frequency.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const createRecurringMeeting = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setTitleTouched(true);
      return;
    }
    if (!workspace || !user) return;

    const selectedPeopleGroup = peopleGroupOptions.find(
      (group) => group.id === selectedPeopleGroupId
    );

    setSaving(true);

    const { error } = await (supabase as any).from("recurring_meeting_series").insert(
      toRecurringMeetingInsert({
        workspaceId: workspace.id,
        userId: user.id,
        title: title.trim(),
        frequency,
        startDate,
        meetingTime,
        location: location.trim(),
        occurrences: Number(occurrences) || 12,
        regularAttendees: selectedPeopleGroup
          ? selectedPeopleGroup.members.map((member) => member.display_name)
          : [],
        regularAgenda: [],
        peopleGroupId: selectedPeopleGroup?.id,
        peopleGroupName: selectedPeopleGroup?.name,
        peopleGroupMemberIds: selectedPeopleGroup?.members.map((member) => member.person_id) || [],
      })
    );

    setSaving(false);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success("Recurring meeting created");
    notifyRecurringMeetingsChanged();
    setTitle("");
    setFrequency("Weekly");
    setStartDate("");
    setMeetingTime("");
    setLocation("");
    setOccurrences("12");
    setSelectedPeopleGroupId("");
    setTitleTouched(false);
    setAddOpen(false);
    loadSeries();
  };

  const closeAddModal = () => {
    setAddOpen(false);
    setTitleTouched(false);
  };

  const confirmDeleteRecurringMeeting = async () => {
    if (!deleteTarget) return;

    // Occurrence rows cascade-delete with the series; the meetings they
    // point at are left alone (matches the old "already created meetings
    // stay" behavior).
    const { error } = await (supabase as any)
      .from("recurring_meeting_series")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success("Recurring meeting deleted");
    notifyRecurringMeetingsChanged();
    setDeleteTarget(null);
    loadSeries();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Meetings"
        title="Recurring Meetings"
        subtitle="Set up repeated meetings like weekly staff meetings or monthly executive meetings."
        actions={
          <>
            <div className="actsix-search-field sm:w-48 lg:w-56">
              <Search className="actsix-search-icon" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search recurring..."
                aria-label="Search recurring meetings"
                className="actsix-search-input"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="actsix-btn-primary min-h-10 h-9"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Recurring
            </Button>
          </>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        <Card className="actsix-panel overflow-hidden">
          {loading ? (
            <div className="actsix-loading-state m-3" role="status">
              Loading recurring meetings...
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {filteredItems.length === 0 && (
                <div className="actsix-empty-state m-3 min-h-[9rem] text-left">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Repeat className="h-4 w-4 text-brand-teal" />
                    No recurring meetings set up yet.
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add a recurring rhythm, then generate the individual meetings as needed.
                  </p>
                </div>
              )}

              {filteredItems.map((item) => (
                <div key={item.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                  <Link to={`/meetings/recurring/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                      <Repeat className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-extrabold tracking-tight">
                        {item.title}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="h-3.5 w-3.5" />
                          {item.frequency}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Starts {formatDate(item.startDate)}
                        </span>

                        {item.meetingTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {item.meetingTime}
                          </span>
                        )}

                        {item.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {item.location}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {item.peopleGroupName
                            ? `${item.peopleGroupName} group`
                            : `${item.regularAttendees?.length || 0} regular attendees`}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {item.regularAgenda?.length || 0} agenda sections
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 text-xs font-bold text-muted-foreground">
                      {item.occurrences} meetings
                    </span>

                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-teal" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={(next) => (next ? setAddOpen(true) : closeAddModal())}>
        <DialogContent className="actsix-panel max-w-3xl rounded-xl">
          <DialogHeader>
            <p className="label-eyebrow">Recurring Meeting</p>
            <DialogTitle>Add Recurring Meeting</DialogTitle>
            <DialogDescription>
              Create a repeated meeting pattern like a weekly staff meeting or monthly executive meeting.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createRecurringMeeting} className="space-y-4">
            <FieldRow>
              <Field
                label="Meeting Title"
                htmlFor="recurring-title"
                hint={titleTouched && !title.trim() ? "Title is required." : undefined}
                className={cn(titleTouched && !title.trim() && "[&_p]:text-brand-danger")}
              >
                <Input
                  id="recurring-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Staff Meeting"
                  aria-invalid={(titleTouched && !title.trim()) || undefined}
                  className={cn(
                    fieldControlClass,
                    titleTouched && !title.trim() && "border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger/15"
                  )}
                />
              </Field>

              <Field label="Frequency" htmlFor="recurring-frequency">
                <select
                  id="recurring-frequency"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as "Weekly" | "Monthly")}
                  className={fieldControlClass}
                >
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Start Date" htmlFor="recurring-start-date">
                <Input
                  id="recurring-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>

              <Field label="Time" htmlFor="recurring-time">
                <Input
                  id="recurring-time"
                  type="time"
                  value={meetingTime}
                  onChange={(event) => setMeetingTime(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Location" htmlFor="recurring-location">
                <Input
                  id="recurring-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Location"
                  className={fieldControlClass}
                />
              </Field>

              <Field label="Number of Meetings" htmlFor="recurring-occurrences">
                <Input
                  id="recurring-occurrences"
                  type="number"
                  min="1"
                  max="60"
                  value={occurrences}
                  onChange={(event) => setOccurrences(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>
            </FieldRow>

            <Field
              label="People Group Source"
              htmlFor="recurring-people-group"
              hint="Use this for recurring meetings that happen within a fixed team or leadership group."
            >
              <select
                id="recurring-people-group"
                value={selectedPeopleGroupId}
                onChange={(event) => setSelectedPeopleGroupId(event.target.value)}
                className={fieldControlClass}
              >
                <option value="">No linked group</option>
                {peopleGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} - {group.members.length} people
                  </option>
                ))}
              </select>
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={closeAddModal}>
                Cancel
              </Button>

              <Button type="submit" className="actsix-btn-primary min-h-10 rounded-xl" disabled={saving}>
                <Plus className="h-4 w-4" />
                {saving ? "Creating..." : "Create Recurring Meeting"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete recurring meeting?"
        description={`This will remove "${deleteTarget?.title ?? ""}" from your recurring meetings list. Existing meetings that were already created will not be deleted.`}
        confirmLabel="Delete Recurring Meeting"
        onConfirm={confirmDeleteRecurringMeeting}
      />
    </div>
  );
};

export default RecurringMeetingsPage;
