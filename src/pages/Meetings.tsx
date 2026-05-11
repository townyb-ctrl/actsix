import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Search,
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
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");

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
      type: "General",
      status: "Planned",
      attendees: [],
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

        <Card className="p-4 border-border/70 bg-card shadow-card">
          <form
            onSubmit={createMeeting}
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_130px_minmax(0,220px)_auto]"
          >
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Meeting title..."
              className="border-border/70 bg-background"
            />

            <Input
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              className="border-border/70 bg-background"
            />

            <Input
              type="time"
              value={meetingTime}
              onChange={(event) => setMeetingTime(event.target.value)}
              className="border-border/70 bg-background"
            />

            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location"
              className="border-border/70 bg-background"
            />

            <Button type="submit" className="actsix-btn-primary rounded-xl px-4">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </Card>

        <div className="space-y-3">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meetings..."
              className="h-10 pl-10 border-border/70 bg-card shadow-soft"
            />
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
                    </div>
                  </div>


                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-teal transition-colors" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Meetings;
