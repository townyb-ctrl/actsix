import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  ArrowUpRight,
  Users,
  ListChecks,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldRow, fieldControlClass } from "@/components/ui/field";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useRecurringPeopleGroupOptions } from "@/features/meetings/hooks/useRecurringPeopleGroupOptions";
import { MeetingAgendaModal } from "@/features/meetings/components/MeetingAgendaModal";
import { cleanAgendaSections, isSectionEmpty, makeAgendaSection } from "@/features/meetings/lib/meetingAgenda";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import {
  fromRecurringMeetingRow,
  generateMinutesFromAgenda,
  buildOccurrences,
  notifyRecurringMeetingsChanged,
  toRecurringMeetingPatch,
  type AgendaSection,
  type RecurringMeeting,
} from "@/features/meetings/lib/recurringMeetings";

type WorkspacePerson = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
};

type CreatedMeetingMap = Record<number, string>;

const formatDate = (date?: string) => {
  if (!date) return "No date";

  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const ordinalDay = (day: number) => {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] || "th"}`;
};

/** "Meeting 1" tells a leader nothing; the actual date does. */
const formatOccurrenceHeading = (date?: string) => {
  if (!date) return "No date set";

  const parsed = new Date(date + "T00:00:00");
  const month = parsed.toLocaleDateString(undefined, { month: "long" });
  return `${ordinalDay(parsed.getDate())} ${month} ${parsed.getFullYear()}`;
};

const RecurringMeetingDetailPage = () => {
  const { seriesId } = useParams();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { workspace } = useCurrentWorkspace();
  const peopleGroupOptions = useRecurringPeopleGroupOptions();

  const [series, setSeries] = useState<RecurringMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [createdMap, setCreatedMap] = useState<CreatedMeetingMap>({});
  const [creatingOccurrence, setCreatingOccurrence] = useState<string | null>(null);
  const [occurrencesOpen, setOccurrencesOpen] = useState(true);
  const [futureMeetingsOpen, setFutureMeetingsOpen] = useState(false);

  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [agendaDraft, setAgendaDraft] = useState<AgendaSection[]>([]);
  const [agendaOpen, setAgendaOpen] = useState(false);

  const [workspacePeople, setWorkspacePeople] = useState<WorkspacePerson[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTitleTouched, setEditTitleTouched] = useState(false);
  const [editFrequency, setEditFrequency] = useState<"Weekly" | "Monthly">("Weekly");
  const [editStartDate, setEditStartDate] = useState("");
  const [editMeetingTime, setEditMeetingTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editOccurrences, setEditOccurrences] = useState("12");
  const [editPeopleGroupId, setEditPeopleGroupId] = useState("");

  useEffect(() => {
    if (!currentPerson?.workspace_id) return;

    (supabase as any)
      .from("people")
      .select("id, display_name, email, avatar_url")
      .eq("workspace_id", currentPerson.workspace_id)
      .order("display_name", { ascending: true })
      .then(({ data, error }: { data: WorkspacePerson[] | null; error: unknown }) => {
        if (error) return;
        setWorkspacePeople(data ?? []);
      });
  }, [currentPerson?.workspace_id]);

  const openEditModal = () => {
    if (!series) return;

    setEditTitle(series.title);
    setEditFrequency(series.frequency);
    setEditStartDate(series.startDate);
    setEditMeetingTime(series.meetingTime);
    setEditLocation(series.location);
    setEditOccurrences(String(series.occurrences || 12));
    setEditPeopleGroupId(series.peopleGroupId || "");
    setEditTitleTouched(false);
    setEditOpen(true);
  };

  const saveEditedSeries = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editTitle.trim()) {
      setEditTitleTouched(true);
      return;
    }

    const selectedGroup = peopleGroupOptions.find((group) => group.id === editPeopleGroupId);

    setEditSaving(true);
    await saveSeries({
      title: editTitle.trim(),
      frequency: editFrequency,
      startDate: editStartDate,
      meetingTime: editMeetingTime,
      location: editLocation.trim(),
      occurrences: Number(editOccurrences) || 12,
      // Switching (or clearing) the linked group replaces the copied
      // membership outright, matching how the create form treats it.
      peopleGroupId: selectedGroup?.id,
      peopleGroupName: selectedGroup?.name,
      peopleGroupMemberIds: selectedGroup?.members.map((member) => member.person_id) || [],
    });
    setEditSaving(false);
    setEditOpen(false);
    toast.success("Recurring meeting updated");
  };

  const load = async () => {
    if (!seriesId) return;

    setLoading(true);

    const [{ data: seriesRow, error: seriesError }, { data: occurrenceRows, error: occurrenceError }] =
      await Promise.all([
        (supabase as any).from("recurring_meeting_series").select("*").eq("id", seriesId).maybeSingle(),
        (supabase as any)
          .from("recurring_meeting_occurrences")
          .select("occurrence_index, meeting_id")
          .eq("series_id", seriesId),
      ]);

    if (seriesError) toast.error(friendlyErrorMessage(seriesError));
    if (occurrenceError) toast.error(friendlyErrorMessage(occurrenceError));

    if (!seriesRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const foundSeries = fromRecurringMeetingRow(seriesRow);

    setSeries(foundSeries);
    setAgendaDraft(foundSeries.regularAgenda.length ? foundSeries.regularAgenda : [makeAgendaSection()]);

    const map: CreatedMeetingMap = {};
    (occurrenceRows || []).forEach((row: any) => {
      map[row.occurrence_index] = row.meeting_id;
    });
    setCreatedMap(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [seriesId]);

  const saveSeries = async (patch: Partial<RecurringMeeting>) => {
    if (!series) return;

    const previousSeries = series;
    const nextSeries = { ...series, ...patch };
    setSeries(nextSeries);

    const { error } = await (supabase as any)
      .from("recurring_meeting_series")
      .update({ ...toRecurringMeetingPatch(patch), updated_at: new Date().toISOString() })
      .eq("id", series.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      setSeries(previousSeries);
      return;
    }

    // Only the nav-visible fields matter to the sidebar, but re-notifying on
    // every save is cheap and keeps this in one place instead of guessing
    // which patches the sidebar cares about.
    notifyRecurringMeetingsChanged();
  };

  const occurrences = useMemo(() => {
    if (!series) return [];
    return buildOccurrences(series);
  }, [series]);

  const addRegularAttendee = () => {
    if (!series) return;

    const value = attendeeInput.trim();
    if (!value) return;

    const attendees = series.regularAttendees || [];

    if (attendees.some((attendee) => attendee.toLowerCase() === value.toLowerCase())) {
      setAttendeeInput("");
      return;
    }

    saveSeries({ regularAttendees: [...attendees, value] });
    setAttendeeInput("");
  };

  const removeRegularAttendee = (name: string) => {
    if (!series) return;

    saveSeries({
      regularAttendees: (series.regularAttendees || []).filter((attendee) => attendee !== name),
    });
  };

  // Regular attendees are stored as free-text names (some may not have a
  // People profile at all), so the multi-select works off a best-effort
  // name match rather than owning the list of IDs directly.
  const regularAttendeeNames = useMemo(() => series?.regularAttendees || [], [series?.regularAttendees]);

  const matchedAttendeePersonIds = useMemo(() => {
    const byName = new Map(workspacePeople.map((person) => [person.display_name.trim().toLowerCase(), person.id]));
    return regularAttendeeNames
      .map((name) => byName.get(name.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));
  }, [workspacePeople, regularAttendeeNames]);

  const handleAttendeePersonIdsChange = (personIds: string[]) => {
    if (!series) return;

    const matchedIds = new Set(matchedAttendeePersonIds);
    const unmatchedNames = regularAttendeeNames.filter((name) => {
      const person = workspacePeople.find((p) => p.display_name.trim().toLowerCase() === name.trim().toLowerCase());
      return !person || !matchedIds.has(person.id);
    });
    const selectedNames = personIds
      .map((id) => workspacePeople.find((person) => person.id === id)?.display_name)
      .filter((name): name is string => Boolean(name));

    saveSeries({ regularAttendees: [...unmatchedNames, ...selectedNames] });
  };

  const openAgendaEditor = () => {
    if (!series) return;

    setAgendaDraft(series.regularAgenda.length ? series.regularAgenda : [makeAgendaSection()]);
    setAgendaOpen(true);
  };

  const saveRegularAgenda = () => {
    if (!series) return;

    // cleanAgendaSections always hands back at least one section, so an agenda
    // emptied down to nothing has to be stored as a real empty list rather than
    // that one blank placeholder - the series header counts these.
    const cleaned = cleanAgendaSections(agendaDraft);
    const cleanedAgenda = cleaned.length === 1 && isSectionEmpty(cleaned[0]) ? [] : cleaned;

    saveSeries({ regularAgenda: cleanedAgenda });
    setAgendaOpen(false);
    toast.success("Regular agenda saved");
  };

  const createMeetingFromOccurrence = async (occurrence: { index: number; number: number; date: string }) => {
    if (!series || !workspace) {
      toast.error("Recurring meeting not loaded yet.");
      return;
    }

    if (!user) {
      toast.error("You need to be signed in to create a meeting.");
      return;
    }

    setCreatingOccurrence(`${occurrence.index}`);

    const regularAgenda = series.regularAgenda || [];
    const notes = generateMinutesFromAgenda(regularAgenda);

    const payload = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: series.title,
      meeting_date: occurrence.date,
      meeting_time: series.meetingTime || null,
      location: series.location || "",
      type: "Recurring",
      attendees: series.regularAttendees || [],
      // type must match the tag parseAgendaPayload checks for - without it,
      // the single-meeting agenda editor doesn't recognize this as structured
      // JSON and falls back to treating the whole payload as one line of
      // plain-text agenda, garbling it on the very first open.
      agenda: JSON.stringify({
        type: "actsix-agenda-v1",
        sections: regularAgenda,
        apologies: [],
        recurringSeriesId: series.id,
        peopleGroupId: series.peopleGroupId || null,
        peopleGroupName: series.peopleGroupName || null,
      }),
      notes,
    };

    const { data, error } = await supabase
      .from("meetings")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("Create recurring meeting occurrence failed:", error);
      toast.error(friendlyErrorMessage(error, "Could not create meeting."));
      setCreatingOccurrence(null);
      return;
    }

    const meetingId = data?.id;

    if (!meetingId) {
      toast.error("Meeting was created, but no meeting ID was returned.");
      setCreatingOccurrence(null);
      return;
    }

    if (series.peopleGroupId) {
      const { error: groupSourceError } = await (supabase as any).rpc(
        "add_meeting_group_source",
        {
          p_meeting_id: meetingId,
          p_group_id: series.peopleGroupId,
        }
      );

      if (groupSourceError) {
        console.error("Attach recurring meeting group failed:", groupSourceError);
        toast.error("Meeting created, but the people group could not be attached.");
      }
    }

    const { error: occurrenceError } = await (supabase as any).from("recurring_meeting_occurrences").insert({
      series_id: series.id,
      workspace_id: workspace.id,
      user_id: user.id,
      occurrence_index: occurrence.index,
      meeting_id: meetingId,
    });

    setCreatingOccurrence(null);

    if (occurrenceError) {
      console.error("Record recurring occurrence failed:", occurrenceError);
      toast.error("Meeting created, but couldn't be marked as generated. It may offer to create again.");
      return;
    }

    setCreatedMap((previous) => ({ ...previous, [occurrence.index]: meetingId }));
    toast.success("Meeting created with regular attendees and agenda");
  };

  const renderOccurrenceRow = (occurrence: { index: number; number: number; date: string }) => {
    if (!series) return null;

    const createdMeetingId = createdMap[occurrence.index];

    const rowContent = (
      <>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
          <CalendarDays className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-extrabold tracking-tight">
            {formatOccurrenceHeading(occurrence.date)}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-muted-foreground/70">Meeting {occurrence.number}</span>

            {series.meetingTime && (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {series.meetingTime}
              </span>
            )}

            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {series.peopleGroupName
                ? `${series.peopleGroupName} group`
                : `${(series.regularAttendees || []).length} regular attendees`}
            </span>

            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" />
              {(series.regularAgenda || []).length} agenda sections
            </span>
          </div>
        </div>
      </>
    );

    if (createdMeetingId) {
      return (
        <Link
          key={occurrence.index}
          to={`/meetings/${createdMeetingId}`}
          className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
        >
          {rowContent}
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      );
    }

    return (
      <div key={occurrence.index} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30">
        {rowContent}
        <Button
          type="button"
          className="actsix-btn-primary min-h-10 rounded-xl"
          onClick={() => createMeetingFromOccurrence(occurrence)}
          disabled={creatingOccurrence === `${occurrence.index}`}
        >
          <Plus className="h-4 w-4" />
          {creatingOccurrence === `${occurrence.index}` ? "Creating..." : "Create Meeting"}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Meetings" title="Recurring Meeting" />
        <div className="actsix-page-body">
          <div className="actsix-loading-state" role="status">
            Loading recurring meeting...
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !series) {
    return (
      <div>
        <PageHeader
          eyebrow="Meetings"
          title="Recurring Meeting"
          subtitle="This recurring meeting could not be found."
        />

        <div className="actsix-page-body">
          <Card className="actsix-panel p-4 sm:p-5">
            <div className="actsix-empty-state min-h-[10rem] text-left">
              Recurring meeting not found.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Meetings"
        title={series.title}
        subtitle="Manage regular attendees, regular agenda, and generated meetings."
        actions={
          <Button type="button" variant="outline" className="actsix-btn-outline min-h-10" onClick={openEditModal}>
            <Pencil className="h-4 w-4" />
            Edit Series
          </Button>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        <Card className="actsix-panel-soft p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              {series.frequency}
            </span>

            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Starts {formatDate(series.startDate)}
            </span>

            {series.meetingTime && (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {series.meetingTime}
              </span>
            )}

            {series.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {series.location}
              </span>
            )}
          </div>
        </Card>

        <Card className="actsix-panel-soft overflow-hidden">
          <div className="grid gap-0 divide-y divide-border/70 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="label-eyebrow">Regular Attendees</p>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {(series.regularAttendees || []).length} people copied into created meetings
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl shrink-0"
                  onClick={() => setAttendeesOpen(true)}
                >
                  Edit
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(series.regularAttendees || []).length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    No regular attendees added.
                  </span>
                ) : (
                  <>
                    {(series.regularAttendees || []).slice(0, 5).map((attendee) => (
                      <span
                        key={attendee}
                        className="inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-bold text-muted-foreground"
                      >
                        {attendee}
                      </span>
                    ))}

                    {(series.regularAttendees || []).length > 5 && (
                      <span className="inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                        + {(series.regularAttendees || []).length - 5} more
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="label-eyebrow">Regular Agenda</p>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {(series.regularAgenda || []).length} sections copied into created meetings
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl shrink-0"
                  onClick={openAgendaEditor}
                >
                  Edit
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(series.regularAgenda || []).length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    No regular agenda added.
                  </span>
                ) : (
                  <>
                    {(series.regularAgenda || []).slice(0, 4).map((section, sectionIndex) => (
                      <span
                        key={`${section.heading}-${sectionIndex}`}
                        className="inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-bold text-muted-foreground"
                      >
                        {sectionIndex + 1}. {section.heading || "Untitled Section"}
                      </span>
                    ))}

                    {(series.regularAgenda || []).length > 4 && (
                      <span className="inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                        + {(series.regularAgenda || []).length - 4} more
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="actsix-panel overflow-hidden">
          <Collapsible open={occurrencesOpen} onOpenChange={setOccurrencesOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 border-b border-border/70 p-4 text-left transition hover:bg-muted/20"
              >
                <div>
                  <p className="label-eyebrow">Generated Meetings</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    Meetings inside this recurring meeting
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {Object.keys(createdMap).length} of {occurrences.length} created
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                    occurrencesOpen && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="divide-y divide-border/70">
                {occurrences[0] && renderOccurrenceRow(occurrences[0])}

                {occurrences.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-muted-foreground transition hover:bg-muted/20 hover:text-foreground"
                      onClick={() => setFutureMeetingsOpen((open) => !open)}
                    >
                      {futureMeetingsOpen
                        ? "Hide future meetings"
                        : `Show ${occurrences.length - 1} future meeting${occurrences.length - 1 === 1 ? "" : "s"}`}
                      <ChevronDown
                        className={cn("h-4 w-4 shrink-0 transition-transform", futureMeetingsOpen && "rotate-180")}
                      />
                    </button>

                    {futureMeetingsOpen && occurrences.slice(1).map(renderOccurrenceRow)}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {attendeesOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="actsix-panel w-full max-w-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Regular Attendees</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Edit Regular Attendees
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  These people will be copied into every meeting created from this recurring meeting.
                </p>
              </div>

              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAttendeesOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-4">
              <p className="label-eyebrow">Add from People</p>
              <div className="mt-2">
                <PeopleMultiSearchSelect
                  people={workspacePeople}
                  selectedPersonIds={matchedAttendeePersonIds}
                  onChange={handleAttendeePersonIdsChange}
                  placeholder="Search people..."
                  emptyText="No matching People profiles found."
                  showAllOnFocus
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={attendeeInput}
                onChange={(event) => setAttendeeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addRegularAttendee();
                }}
                placeholder="Or type a name not in your People directory..."
                aria-label="Add regular attendee by name"
                className="border-border/70 bg-background"
              />

              <Button type="button" className="actsix-btn-primary min-h-10 rounded-xl" onClick={addRegularAttendee}>
                Add
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(series.regularAttendees || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No regular attendees added yet.
                </p>
              ) : (
                (series.regularAttendees || []).map((attendee) => (
                  <button
                    key={attendee}
                    type="button"
                    onClick={() => removeRegularAttendee(attendee)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-bold text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {attendee}
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="actsix-btn-primary min-h-10 rounded-xl"
                onClick={() => setAttendeesOpen(false)}
              >
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}

      <MeetingAgendaModal
        open={agendaOpen}
        onOpenChange={setAgendaOpen}
        draft={agendaDraft}
        onChange={(updater) => setAgendaDraft((sections) => updater(sections))}
        onSave={saveRegularAgenda}
        title="Regular Agenda"
        description="This agenda is copied into every meeting created from this recurring meeting."
        saveLabel="Save Regular Agenda"
      />


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="actsix-panel max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Recurring Meeting</DialogTitle>
            <DialogDescription>
              Changes apply to this series and any meetings you generate from it after saving.
              Meetings already created keep their own date and time.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveEditedSeries} className="space-y-4">
            <FieldRow>
              <Field
                label="Meeting Title"
                htmlFor="edit-recurring-title"
                hint={editTitleTouched && !editTitle.trim() ? "Title is required." : undefined}
                className={cn(editTitleTouched && !editTitle.trim() && "[&_p]:text-brand-danger")}
              >
                <Input
                  id="edit-recurring-title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  aria-invalid={(editTitleTouched && !editTitle.trim()) || undefined}
                  className={cn(
                    fieldControlClass,
                    editTitleTouched && !editTitle.trim() && "border-brand-danger focus-visible:border-brand-danger focus-visible:ring-brand-danger/15"
                  )}
                />
              </Field>

              <Field label="Frequency" htmlFor="edit-recurring-frequency">
                <select
                  id="edit-recurring-frequency"
                  value={editFrequency}
                  onChange={(event) => setEditFrequency(event.target.value as "Weekly" | "Monthly")}
                  className={fieldControlClass}
                >
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Start Date" htmlFor="edit-recurring-start-date">
                <Input
                  id="edit-recurring-start-date"
                  type="date"
                  value={editStartDate}
                  onChange={(event) => setEditStartDate(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>

              <Field label="Time" htmlFor="edit-recurring-time">
                <Input
                  id="edit-recurring-time"
                  type="time"
                  value={editMeetingTime}
                  onChange={(event) => setEditMeetingTime(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Location" htmlFor="edit-recurring-location">
                <Input
                  id="edit-recurring-location"
                  value={editLocation}
                  onChange={(event) => setEditLocation(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>

              <Field label="Number of Meetings" htmlFor="edit-recurring-occurrences">
                <Input
                  id="edit-recurring-occurrences"
                  type="number"
                  min="1"
                  max="60"
                  value={editOccurrences}
                  onChange={(event) => setEditOccurrences(event.target.value)}
                  className={fieldControlClass}
                />
              </Field>
            </FieldRow>

            <Field
              label="People Group Source"
              htmlFor="edit-recurring-people-group"
              hint="Switching groups replaces the regular attendees copied from the previous one."
            >
              <select
                id="edit-recurring-people-group"
                value={editPeopleGroupId}
                onChange={(event) => setEditPeopleGroupId(event.target.value)}
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
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>

              <Button type="submit" className="actsix-btn-primary min-h-10 rounded-xl" disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecurringMeetingDetailPage;
