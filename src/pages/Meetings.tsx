import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Copy,
  MapPin,
  Plus,
  Search,
  Video,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const formatDate = (date?: string | null) => {
  if (!date) return "No date";

  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const Meetings = () => {
  const { user } = useAuth();

  const [meetings, setMeetings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState("In Person");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");
  const [googleMeetUrl, setGoogleMeetUrl] = useState("");

  const load = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: true })
      .order("meeting_time", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }

    setMeetings(data ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const createMeeting = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !user) return;

    const { error } = await supabase.from("meetings").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      title: title.trim(),
      meeting_date: meetingDate || null,
      meeting_time: meetingTime || null,
      location: location.trim(),
      google_meet_url: googleMeetUrl.trim() || null,
      type: meetingType.trim() || "In Person",
      status: "Planned",
      agenda: "",
      notes: "",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTitle("");
    setMeetingDate("");
    setMeetingTime("");
    setLocation("");
    setGoogleMeetUrl("");
    toast.success("Meeting created");
    load();
  };

  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return meetings.filter((meeting) => {
      if (!q) return true;

      return (
        (meeting.title || "").toLowerCase().includes(q) ||
        (meeting.location || "").toLowerCase().includes(q) ||
        (meeting.type || "").toLowerCase().includes(q)
      );
    });
  }, [meetings, search]);

  const totalCount = meetings.length;
  const upcomingCount = meetings.filter((meeting) => meeting.meeting_date).length;
  const unscheduledCount = meetings.filter((meeting) => !meeting.meeting_date).length;

  const openMeetLink = (event: React.MouseEvent, url?: string | null) => {
    event.preventDefault();
    event.stopPropagation();

    if (!url) {
      toast.error("No Google Meet link saved for this meeting.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyMeetLink = async (event: React.MouseEvent, url?: string | null) => {
    event.preventDefault();
    event.stopPropagation();

    if (!url) {
      toast.error("No Google Meet link saved for this meeting.");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Google Meet link copied");
    } catch {
      toast.error("Could not copy Google Meet link.");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX: Meetings"
        title="Meetings"
        subtitle="Plan agendas, record notes, and track action points."
      />

      <div className="px-8 pb-12 max-w-7xl space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Total Meetings</p>
            <div className="mt-2 text-3xl font-extrabold">{totalCount}</div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Scheduled</p>
            <div className="mt-2 text-3xl font-extrabold">{upcomingCount}</div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Unscheduled</p>
            <div className="mt-2 text-3xl font-extrabold">{unscheduledCount}</div>
          </Card>
        </div>

<div className="space-y-3">
          <div className="flex items-center justify-between gap-4">

            <div className="relative max-w-2xl flex-1">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

              <Input

                value={search}

                onChange={(event) => setSearch(event.target.value)}

                placeholder="Search meetings..."

                className="h-10 pl-10 border-border/70 bg-card shadow-soft"

              />

            </div>

          

            <Button

              type="button"

              className="actsix-btn-primary rounded-xl shrink-0"

              onClick={() => setAddOpen(true)}

            >

              <Plus className="h-4 w-4" />

              Add Meeting

            </Button>

          </div>

          <Card className="border-border/70 bg-card shadow-card overflow-hidden">
            <div className="divide-y divide-border">
              {filteredMeetings.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  No meetings found.
                </div>
              )}

              {filteredMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/meetings/${meeting.id}`}
                  className="group flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                    <UsersRound className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold tracking-tight truncate">
                      {meeting.title}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(meeting.meeting_date)}
                      </span>

                      {meeting.meeting_time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {meeting.meeting_time.slice(0, 5)}
                        </span>
                      )}

                      {meeting.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {meeting.location}
                        </span>
                      )}

                      {meeting.google_meet_url && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 font-bold text-brand-teal">
                          <Video className="h-3.5 w-3.5" />
                          Online
                        </span>
                      )}
                    </div>
                  </div>


                  <div className="flex items-center gap-2">
                    {meeting.google_meet_url && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => copyMeetLink(event, meeting.google_meet_url)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-brand-teal/40 hover:bg-brand-teal/5 hover:text-brand-teal"
                          aria-label={`Copy Google Meet link for ${meeting.title || "meeting"}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy Link
                        </button>

                        <button
                          type="button"
                          onClick={(event) => openMeetLink(event, meeting.google_meet_url)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-3 py-2 text-xs font-bold text-brand-teal transition hover:bg-brand-teal/15"
                          aria-label={`Open Google Meet for ${meeting.title || "meeting"}`}
                        >
                          <Video className="h-3.5 w-3.5" />
                          Open Meet
                        </button>
                      </>
                    )}

                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-teal transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-3xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Meeting</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Meeting
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a meeting, then add agenda, minutes, attendees, and action points.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={createMeeting} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Meeting Title</label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Executive Meeting"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Type</label>
                  <select
                    value={meetingType}
                    onChange={(event) => {
                      setMeetingType(event.target.value);
                      if (event.target.value === "Online") {
                        setLocation("");
                      }
                    }}
                    className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option value="In Person">In Person</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Date</label>
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(event) => setMeetingDate(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Time</label>
                  <Input
                    type="time"
                    value={meetingTime}
                    onChange={(event) => setMeetingTime(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                {meetingType !== "Online" && (
                <div>
                  <label className="label-eyebrow">Location</label>
                  <Input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Location"
                    className="border-border/70 bg-background"
                  />
                </div>
              )}

                <div>
                  <label className="label-eyebrow">Google Meet Link</label>
                  <Input
                    value={googleMeetUrl}
                    onChange={(event) => setGoogleMeetUrl(event.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Plus className="h-4 w-4" />
                  Create Meeting
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
};

export default Meetings;
