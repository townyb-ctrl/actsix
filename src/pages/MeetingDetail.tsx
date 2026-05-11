import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type AgendaPoint = {
  id: string;
  text: string;
};

type AgendaSection = {
  id: string;
  heading: string;
  points: AgendaPoint[];
};

const makeAgendaPoint = (): AgendaPoint => ({
  id: crypto.randomUUID(),
  text: "",
});

const makeAgendaSection = (): AgendaSection => ({
  id: crypto.randomUUID(),
  heading: "",
  points: [makeAgendaPoint()],
});

const parseAgenda = (value?: string | null): AgendaSection[] => {
  if (!value) return [makeAgendaSection()];

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      parsed.type === "actsix-agenda-v1" &&
      Array.isArray(parsed.sections)
    ) {
      return parsed.sections.length > 0
        ? parsed.sections.map((section: any) => ({
            id: section.id || crypto.randomUUID(),
            heading: section.heading || "",
            points:
              Array.isArray(section.points) && section.points.length > 0
                ? section.points.map((point: any) => ({
                    id: point.id || crypto.randomUUID(),
                    text: point.text || "",
                  }))
                : [makeAgendaPoint()],
          }))
        : [makeAgendaSection()];
    }
  } catch {
    // Existing plain-text agendas are converted below.
  }

  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return [
    {
      id: crypto.randomUUID(),
      heading: "Agenda",
      points: lines.length
        ? lines.map((line) => ({ id: crypto.randomUUID(), text: line }))
        : [makeAgendaPoint()],
    },
  ];
};

const serializeAgenda = (sections: AgendaSection[]) =>
  JSON.stringify({
    type: "actsix-agenda-v1",
    sections: sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      points: section.points,
    })),
  });

const parseAttendees = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const MeetingDetail = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState<any | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [attendeesText, setAttendeesText] = useState("");
  const [agendaSections, setAgendaSections] = useState<AgendaSection[]>([
    makeAgendaSection(),
  ]);
  const [actionTitle, setActionTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");

  const load = async () => {
    if (!user || !meetingId) return;

    const { data: meetingData, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError) {
      toast.error(meetingError.message);
      return;
    }

    const { data: actionData, error: actionError } = await supabase
      .from("meeting_actions")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });

    if (actionError) {
      toast.error(actionError.message);
      return;
    }

    setMeeting(meetingData);
    setAttendeesText(
      Array.isArray(meetingData.attendees)
        ? meetingData.attendees.join(", ")
        : ""
    );
    setAgendaSections(parseAgenda(meetingData.agenda));
    setActions(actionData ?? []);
  };

  useEffect(() => {
    load();
  }, [user, meetingId]);

  const saveMeeting = async () => {
    if (!meeting) return;

    const { error } = await supabase
      .from("meetings")
      .update({
        title: meeting.title || "",
        meeting_date: meeting.meeting_date || null,
        meeting_time: meeting.meeting_time || null,
        location: meeting.location || "",
        type: meeting.type || "General",
        status: meeting.status || "Planned",
        attendees: parseAttendees(attendeesText),
        agenda: serializeAgenda(agendaSections),
        notes: meeting.notes || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Meeting saved");
    load();
  };

  const deleteMeeting = async () => {
    if (!meeting) return;

    const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Meeting deleted");
    navigate("/meetings");
  };

  const loadActions = async () => {
    if (!meetingId) return;

    const { data, error } = await supabase
      .from("meeting_actions")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setActions(data ?? []);
  };

  const addAction = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!actionTitle.trim() || !user || !meeting) return;

    const { error } = await supabase.from("meeting_actions").insert({
      id: crypto.randomUUID(),
      meeting_id: meeting.id,
      user_id: user.id,
      title: actionTitle.trim(),
      assignee: assignee.trim(),
      due: due || null,
      linked_project: "",
      status: "Open",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setActionTitle("");
    setAssignee("");
    setDue("");
    toast.success("Action point added");
    loadActions();
  };

  const removeAction = async (id: string) => {
    const { error } = await supabase.from("meeting_actions").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Action point removed");
    loadActions();
  };

  if (!meeting) {
    return (
      <div>
        <PageHeader eyebrow="ACTSIX: Meetings" title="Meeting" subtitle="Loading meeting..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX: Meetings"
        title={meeting.title || "Meeting"}
        subtitle="Agenda, notes, attendees, and action points."
      />

      <div className="px-8 pb-12 max-w-7xl space-y-6">
        <Button asChild variant="ghost" className="rounded-xl text-muted-foreground">
          <Link to="/meetings">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meetings
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px] items-start">
          <Card className="p-6 border-border/70 bg-card shadow-card space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label-eyebrow">Meeting title</label>
                <Input
                  value={meeting.title || ""}
                  onChange={(event) => setMeeting({ ...meeting, title: event.target.value })}
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Status</label>
                <select
                  value={meeting.status || "Planned"}
                  onChange={(event) => setMeeting({ ...meeting, status: event.target.value })}
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option>Planned</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </div>

              <div>
                <label className="label-eyebrow">Date</label>
                <Input
                  type="date"
                  value={meeting.meeting_date || ""}
                  onChange={(event) =>
                    setMeeting({ ...meeting, meeting_date: event.target.value || null })
                  }
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Time</label>
                <Input
                  type="time"
                  value={meeting.meeting_time || ""}
                  onChange={(event) =>
                    setMeeting({ ...meeting, meeting_time: event.target.value || null })
                  }
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Location</label>
                <Input
                  value={meeting.location || ""}
                  onChange={(event) => setMeeting({ ...meeting, location: event.target.value })}
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Type</label>
                <Input
                  value={meeting.type || "General"}
                  onChange={(event) => setMeeting({ ...meeting, type: event.target.value })}
                  className="mt-2 border-border/70 bg-background"
                />
              </div>
            </div>

            <div>
              <label className="label-eyebrow">Attendees</label>
              <Input
                value={attendeesText}
                onChange={(event) => setAttendeesText(event.target.value)}
                placeholder="Separate names with commas"
                className="mt-2 border-border/70 bg-background"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <label className="label-eyebrow">Agenda</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create numbered sections and agenda points.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    setAgendaSections((sections) => [
                      ...sections,
                      makeAgendaSection(),
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </div>

              <div className="space-y-3">
                {agendaSections.map((section, sectionIndex) => (
                  <Card
                    key={section.id}
                    className="p-4 border-border/70 bg-muted/10 shadow-soft"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
                        {sectionIndex + 1}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={section.heading}
                            onChange={(event) =>
                              setAgendaSections((sections) =>
                                sections.map((item) =>
                                  item.id === section.id
                                    ? { ...item, heading: event.target.value }
                                    : item
                                )
                              )
                            }
                            placeholder="Section heading..."
                            className="border-border/70 bg-background font-semibold"
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete section"
                            aria-label="Delete section"
                            onClick={() =>
                              setAgendaSections((sections) =>
                                sections.length > 1
                                  ? sections.filter((item) => item.id !== section.id)
                                  : [makeAgendaSection()]
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {section.points.map((point, pointIndex) => (
                            <div key={point.id} className="flex items-center gap-2">
                              <div className="w-10 shrink-0 text-xs font-bold text-muted-foreground">
                                {sectionIndex + 1}.{pointIndex + 1}
                              </div>

                              <Input
                                value={point.text}
                                onChange={(event) =>
                                  setAgendaSections((sections) =>
                                    sections.map((item) =>
                                      item.id === section.id
                                        ? {
                                            ...item,
                                            points: item.points.map((agendaPoint) =>
                                              agendaPoint.id === point.id
                                                ? {
                                                    ...agendaPoint,
                                                    text: event.target.value,
                                                  }
                                                : agendaPoint
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                                placeholder="Agenda point..."
                                className="border-border/70 bg-background"
                              />

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                title="Delete point"
                                aria-label="Delete point"
                                onClick={() =>
                                  setAgendaSections((sections) =>
                                    sections.map((item) =>
                                      item.id === section.id
                                        ? {
                                            ...item,
                                            points:
                                              item.points.length > 1
                                                ? item.points.filter(
                                                    (agendaPoint) =>
                                                      agendaPoint.id !== point.id
                                                  )
                                                : [makeAgendaPoint()],
                                          }
                                        : item
                                    )
                                  )
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-brand-teal hover:text-brand-teal"
                          onClick={() =>
                            setAgendaSections((sections) =>
                              sections.map((item) =>
                                item.id === section.id
                                  ? {
                                      ...item,
                                      points: [...item.points, makeAgendaPoint()],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add agenda point
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <label className="label-eyebrow">Notes / Minutes</label>
              <textarea
                value={meeting.notes || ""}
                onChange={(event) => setMeeting({ ...meeting, notes: event.target.value })}
                className="mt-2 min-h-48 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Meeting notes, decisions, and minutes..."
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={deleteMeeting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Meeting
              </Button>

              <Button className="actsix-btn-primary rounded-xl" onClick={saveMeeting}>
                <Save className="h-4 w-4" />
                Save Meeting
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5 border-border/70 bg-card shadow-card">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {meeting.meeting_date || "No date"}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  {meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : "No time"}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {meeting.location || "No location"}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <UsersRound className="h-4 w-4" />
                  {Array.isArray(meeting.attendees) && meeting.attendees.length > 0
                    ? `${meeting.attendees.length} attendees`
                    : "No attendees"}
                </div>
              </div>
            </Card>

            <Card className="p-5 border-border/70 bg-card shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold tracking-tight">Action Points</h2>
                <span className="text-xs font-bold text-brand-teal">
                  {actions.length}
                </span>
              </div>

              <form onSubmit={addAction} className="space-y-2 mb-4">
                <Input
                  value={actionTitle}
                  onChange={(event) => setActionTitle(event.target.value)}
                  placeholder="Action point..."
                  className="border-border/70 bg-background"
                />

                <div className="grid grid-cols-[1fr_130px_auto] gap-2">
                  <Input
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    placeholder="Assignee"
                    className="border-border/70 bg-background"
                  />

                  <Input
                    type="date"
                    value={due}
                    onChange={(event) => setDue(event.target.value)}
                    className="border-border/70 bg-background"
                  />

                  <Button type="submit" size="icon" className="actsix-btn-primary rounded-xl">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                {actions.length === 0 && (
                  <div className="p-4 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                    No action points yet.
                  </div>
                )}

                {actions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-lg border border-border/70 bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm">{action.title}</div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {action.assignee || "Unassigned"}
                          {action.due ? ` · Due ${action.due}` : ""}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAction(action.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetail;
