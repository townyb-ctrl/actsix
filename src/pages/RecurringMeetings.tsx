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
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AgendaPoint = {
  text: string;
};

type AgendaSection = {
  heading: string;
  points: AgendaPoint[];
};

type RecurringMeeting = {
  id: string;
  title: string;
  frequency: "Weekly" | "Monthly";
  startDate: string;
  meetingTime: string;
  location: string;
  occurrences: number;
  regularAttendees?: string[];
  regularAgenda?: AgendaSection[];
};

const STORAGE_KEY = "actsix_recurring_meetings";

const loadRecurringMeetings = (): RecurringMeeting[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveRecurringMeetings = (items: RecurringMeeting[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const formatDate = (date?: string) => {
  if (!date) return "No start date";

  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const RecurringMeetings = () => {
  const [items, setItems] = useState<RecurringMeeting[]>([]);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"Weekly" | "Monthly">("Weekly");
  const [startDate, setStartDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");
  const [occurrences, setOccurrences] = useState("12");
  const [deleteTarget, setDeleteTarget] = useState<RecurringMeeting | null>(null);

  useEffect(() => {
    setItems(loadRecurringMeetings());
  }, []);

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

  const createRecurringMeeting = (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) return;

    const nextItems: RecurringMeeting[] = [
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        frequency,
        startDate,
        meetingTime,
        location: location.trim(),
        occurrences: Number(occurrences) || 12,
        regularAttendees: [],
        regularAgenda: [],
      },
      ...items,
    ];

    setItems(nextItems);
    saveRecurringMeetings(nextItems);

    setTitle("");
    setFrequency("Weekly");
    setStartDate("");
    setMeetingTime("");
    setLocation("");
    setOccurrences("12");
    setAddOpen(false);
  };

  const confirmDeleteRecurringMeeting = () => {
    if (!deleteTarget) return;

    const nextItems = items.filter((item) => item.id !== deleteTarget.id);
    setItems(nextItems);
    saveRecurringMeetings(nextItems);

    try {
      const createdMap = JSON.parse(localStorage.getItem("actsix_recurring_meeting_created_map") || "{}");
      Object.keys(createdMap).forEach((key) => {
        if (key.startsWith(`${deleteTarget.id}-`)) {
          delete createdMap[key];
        }
      });
      localStorage.setItem("actsix_recurring_meeting_created_map", JSON.stringify(createdMap));
    } catch {
      // Ignore invalid localStorage data.
    }

    setDeleteTarget(null);
  };

  return (
    <div>
      <div className="w-full space-y-4 px-4 pb-12 pt-8 sm:px-6 xl:px-8 2xl:px-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">ACTSIX: Meetings</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              Recurring Meetings
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Set up repeated meetings like weekly staff meetings or monthly executive meetings.
            </p>
          </div>        </div>

        <div className="flex items-center justify-between gap-4">


          <div className="relative max-w-2xl flex-1">


            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />


            <Input


              value={search}


              onChange={(event) => setSearch(event.target.value)}


              placeholder="Search recurring meetings..."


              className="h-10 pl-10 border-border/70 bg-card shadow-soft"


            />


          </div>


        


          <Button


            type="button"


            className="actsix-btn-primary rounded-xl shrink-0"


            onClick={() => setAddOpen(true)}


          >


            <Plus className="h-4 w-4" />


            Add Recurring Meeting


          </Button>


        </div>

        <Card className="border-border/70 bg-card shadow-card overflow-hidden">
          <div className="divide-y divide-border">
            {filteredItems.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                No recurring meetings set up yet.
              </div>
            )}

            {filteredItems.map((item) => (
              <Link
                key={item.id}
                to={`/meetings/recurring/${item.id}`}
                className="group flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                  <Repeat className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-extrabold tracking-tight truncate">
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
                      {item.regularAttendees?.length || 0} regular attendees
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <ListChecks className="h-3.5 w-3.5" />
                      {item.regularAgenda?.length || 0} agenda sections
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold text-muted-foreground">
                  {item.occurrences} meetings
                </span>

                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDeleteTarget(item);
                  }}
                  className="h-9 w-9 rounded-lg border border-border/70 bg-background text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center"
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-teal transition-colors" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-3xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Recurring Meeting</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Recurring Meeting
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a repeated meeting pattern like a weekly staff meeting or monthly executive meeting.
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

            <form onSubmit={createRecurringMeeting} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Meeting Title</label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Staff Meeting"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value as "Weekly" | "Monthly")}
                    className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
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
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Number of Meetings</label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={occurrences}
                    onChange={(event) => setOccurrences(event.target.value)}
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
                  Create Recurring Meeting
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md border-border/70 bg-card shadow-card p-6">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <Trash2 className="h-5 w-5" />
            </div>

            <h2 className="text-xl font-extrabold tracking-tight">
              Delete recurring meeting?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will remove <strong>{deleteTarget.title}</strong> from your recurring meetings list.
              Existing meetings that were already created will not be deleted.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
                onClick={confirmDeleteRecurringMeeting}
              >
                Delete Recurring Meeting
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RecurringMeetings;
