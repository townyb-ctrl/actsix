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
      type: "General",
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
        (meeting.location || "").toLowerCase().includes(q)
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
    <div className="pb-12">
      <PageHeader
        eyebrow="ACTSIX: Meetings"
        title="Meetings"
        subtitle="Plan agendas, record notes, and track action points."
      />

      <div className="px-8 max-w-7xl space-y-6">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 shadow-card md:grid-cols-3">
          {[
            ["Total meetings", totalCount],
            ["Scheduled", upcomingCount],
            ["Unscheduled", unscheduledCount],
          ].map(([label, value]) => (
            <div key={label} className="bg-card px-5 py-4">
              <p className="label-eyebrow">{label}</p>
              <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card shadow-card">
          <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search meetings..."
                className="h-11 rounded-xl border-border/70 bg-background pl-10 shadow-none"
              />
            </div>

            <Button
              type="button"
              className="actsix-btn-primary h-11 shrink-0 rounded-xl px-4"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Meeting
            </Button>
          </div>

          <div className="divide-y divide-border/70">
              {filteredMeetings.length === 0 && (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">No meetings found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a meeting or adjust your search.
                  </p>
                </div>
              )}

              {filteredMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/meetings/${meeting.id}`}
                  className="group flex flex-col gap-4 p-4 transition-colors hover:bg-brand-teal/5 sm:flex-row sm:items-center"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal ring-1 ring-brand-teal/15">
                    <UsersRound className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="truncate text-base font-extrabold tracking-tight">
                      {meeting.title}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(meeting.meeting_date)}
                      </span>

                      {meeting.meeting_time && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {meeting.meeting_time.slice(0, 5)}
                        </span>
                      )}

                      {meeting.location && (
                        <span className="inline-flex items-center gap-1.5">
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


                  <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                    {meeting.google_meet_url && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => copyMeetLink(event, meeting.google_meet_url)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold text-muted-foreground transition hover:border-brand-teal/40 hover:bg-brand-teal/5 hover:text-brand-teal"
                          aria-label={`Copy Google Meet link for ${meeting.title || "meeting"}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy Link
                        </button>

                        <button
                          type="button"
                          onClick={(event) => openMeetLink(event, meeting.google_meet_url)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-3 text-xs font-bold text-brand-teal transition hover:bg-brand-teal/15"
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
                <div className="md:col-span-2">
                  <label className="label-eyebrow">Meeting Title</label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Executive Meeting"
                    className="mt-2 border-border/70 bg-background"
                  />
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

                <div>
                  <label className="label-eyebrow">Location</label>
                  <Input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Location"
                    className="border-border/70 bg-background"
                  />
                </div>

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
