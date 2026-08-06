import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  MapPin,
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import {
  fromRecurringMeetingRow,
  generateMinutesFromAgenda,
  type AgendaSection,
  type RecurringMeeting,
} from "@/features/meetings/lib/recurringMeetings";

type CreatedMeetingMap = Record<number, string>;

const formatDate = (date?: string) => {
  if (!date) return "No date";

  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const RecurringMeetingDetailPage = () => {
  const { seriesId } = useParams();
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();

  const [series, setSeries] = useState<RecurringMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [createdMap, setCreatedMap] = useState<CreatedMeetingMap>({});
  const [creatingOccurrence, setCreatingOccurrence] = useState<string | null>(null);

  const [attendeeInput, setAttendeeInput] = useState("");
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [agendaDraft, setAgendaDraft] = useState<AgendaSection[]>([]);
  const [agendaOpen, setAgendaOpen] = useState(false);

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
    setAgendaDraft(
      foundSeries.regularAgenda.length ? foundSeries.regularAgenda : [{ heading: "", points: [{ text: "" }] }]
    );

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

  const saveSeries = async (patch: Partial<Pick<RecurringMeeting, "regularAttendees" | "regularAgenda">>) => {
    if (!series) return;

    const nextSeries = { ...series, ...patch };
    setSeries(nextSeries);

    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.regularAttendees) dbPatch.regular_attendees = patch.regularAttendees;
    if (patch.regularAgenda) dbPatch.regular_agenda = patch.regularAgenda;

    const { error } = await (supabase as any)
      .from("recurring_meeting_series")
      .update(dbPatch)
      .eq("id", series.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      setSeries(series);
    }
  };

  const occurrences = useMemo(() => {
    if (!series?.startDate) return [];

    const start = new Date(series.startDate + "T00:00:00");

    return Array.from({ length: series.occurrences || 12 }, (_, index) => {
      const date =
        series.frequency === "Weekly"
          ? new Date(start.getTime() + index * 7 * 24 * 60 * 60 * 1000)
          : addMonths(start, index);

      return {
        index,
        number: index + 1,
        date: toDateInputValue(date),
      };
    });
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

  const openAgendaEditor = () => {
    if (!series) return;

    setAgendaDraft(
      series.regularAgenda.length ? series.regularAgenda : [{ heading: "", points: [{ text: "" }] }]
    );
    setAgendaOpen(true);
  };

  const addAgendaSection = () => {
    setAgendaDraft((previous) => [...previous, { heading: "", points: [{ text: "" }] }]);
  };

  const removeAgendaSection = (sectionIndex: number) => {
    setAgendaDraft((previous) => previous.filter((_, index) => index !== sectionIndex));
  };

  const updateAgendaSection = (sectionIndex: number, value: string) => {
    setAgendaDraft((previous) =>
      previous.map((section, index) =>
        index === sectionIndex ? { ...section, heading: value } : section
      )
    );
  };

  const addAgendaPoint = (sectionIndex: number) => {
    setAgendaDraft((previous) =>
      previous.map((section, index) =>
        index === sectionIndex
          ? { ...section, points: [...section.points, { text: "" }] }
          : section
      )
    );
  };

  const removeAgendaPoint = (sectionIndex: number, pointIndex: number) => {
    setAgendaDraft((previous) =>
      previous.map((section, index) =>
        index === sectionIndex
          ? { ...section, points: section.points.filter((_, pIndex) => pIndex !== pointIndex) }
          : section
      )
    );
  };

  const updateAgendaPoint = (sectionIndex: number, pointIndex: number, value: string) => {
    setAgendaDraft((previous) =>
      previous.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              points: section.points.map((point, pIndex) =>
                pIndex === pointIndex ? { text: value } : point
              ),
            }
          : section
      )
    );
  };

  const saveRegularAgenda = () => {
    if (!series) return;

    const cleanedAgenda = agendaDraft
      .map((section) => ({
        heading: section.heading.trim(),
        points: section.points
          .map((point) => ({ text: point.text.trim() }))
          .filter((point) => point.text),
      }))
      .filter((section) => section.heading || section.points.length);

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
      agenda: JSON.stringify({
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

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Meetings" title="Recurring Meeting" />
        <div className="w-full px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
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

        <div className="w-full px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
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
      />

      <div className="w-full space-y-5 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
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
          <div className="border-b border-border/70 p-4">
            <p className="label-eyebrow">Generated Meetings</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Meetings inside this recurring meeting
            </h2>
          </div>

          <div className="divide-y divide-border/70">
            {occurrences.map((occurrence) => {
              const createdMeetingId = createdMap[occurrence.index];

              return (
                <div
                  key={occurrence.index}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold tracking-tight">
                      Meeting {occurrence.number}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(occurrence.date)}
                      </span>

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

                  {createdMeetingId ? (
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link to={`/meetings/${createdMeetingId}`}>
                        Open Meeting
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      className="actsix-btn-primary min-h-10 rounded-xl"
                      onClick={() => createMeetingFromOccurrence(occurrence)}
                      disabled={creatingOccurrence === `${occurrence.index}`}
                    >
                      <Plus className="h-4 w-4" />
                      {creatingOccurrence === `${occurrence.index}` ? "Creating..." : "Create Meeting"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
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

              <Button variant="outline" className="rounded-xl" onClick={() => setAttendeesOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={attendeeInput}
                onChange={(event) => setAttendeeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addRegularAttendee();
                }}
                placeholder="Add regular attendee..."
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

      {agendaOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="actsix-panel max-h-[86vh] w-full max-w-3xl overflow-auto p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Regular Agenda</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Manage Regular Agenda
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This agenda will be copied into every meeting created from this recurring meeting.
                </p>
              </div>

              <Button variant="outline" className="rounded-xl" onClick={() => setAgendaOpen(false)}>
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {agendaDraft.map((section, sectionIndex) => (
                <div key={sectionIndex} className="rounded-xl border border-border/70 bg-background p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center text-sm font-extrabold">
                      {sectionIndex + 1}
                    </div>

                    <Input
                      value={section.heading}
                      onChange={(event) => updateAgendaSection(sectionIndex, event.target.value)}
                      placeholder="Section heading..."
                      className="border-border/70 bg-background font-bold"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl text-destructive"
                      onClick={() => removeAgendaSection(sectionIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2 pl-10">
                    {section.points.map((point, pointIndex) => (
                      <div key={pointIndex} className="flex items-center gap-2">
                        <span className="w-10 text-xs font-bold text-muted-foreground">
                          {sectionIndex + 1}.{pointIndex + 1}
                        </span>

                        <Input
                          value={point.text}
                          onChange={(event) =>
                            updateAgendaPoint(sectionIndex, pointIndex, event.target.value)
                          }
                          placeholder="Agenda point..."
                          className="border-border/70 bg-background"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl text-destructive"
                          onClick={() => removeAgendaPoint(sectionIndex, pointIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl text-brand-teal"
                      onClick={() => addAgendaPoint(sectionIndex)}
                    >
                      <Plus className="h-4 w-4" />
                      Add agenda point
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={addAgendaSection}>
                <Plus className="h-4 w-4" />
                Add Section
              </Button>

              <Button type="button" className="actsix-btn-primary min-h-10 rounded-xl" onClick={saveRegularAgenda}>
                Save Regular Agenda
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RecurringMeetingDetailPage;
