import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Check, CheckCircle2, ChevronsUpDown, Clock3, Copy, ExternalLink, FileText, ListChecks, MapPin, MoreHorizontal, Pencil, Plus, Save, Search, Trash2, UserRoundX, UsersRound, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createNotificationForPerson } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PeopleSearchSelect } from "@/components/people/PeopleSearchSelect";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const EMPTY_MEETING = {
  title: "",
  meeting_date: null as string | null,
  meeting_time: null as string | null,
  location: "",
  type: "General",
  notes: "",
};

type AgendaPoint = {
  id: string;
  text: string;
};

type AgendaSection = {
  id: string;
  heading: string;
  points: AgendaPoint[];
};

type AgendaPayload = {
  type: "actsix-agenda-v1";
  sections: AgendaSection[];
  apologies?: string[];
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

const cleanNameList = (items: string[]) =>
  items.map((item) => item.trim()).filter(Boolean);

const parseAgendaPayload = (value?: string | null): AgendaPayload => {
  if (!value) {
    return { type: "actsix-agenda-v1", sections: [makeAgendaSection()], apologies: [] };
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      parsed.type === "actsix-agenda-v1" &&
      Array.isArray(parsed.sections)
    ) {
      return {
        type: "actsix-agenda-v1",
        sections: parsed.sections.length
          ? parsed.sections.map((section: any) => ({
              id: section.id || crypto.randomUUID(),
              heading: section.heading || "",
              points:
                Array.isArray(section.points) && section.points.length
                  ? section.points.map((point: any) => ({
                      id: point.id || crypto.randomUUID(),
                      text: typeof point === "string" ? point : point.text || "",
                    }))
                  : [makeAgendaPoint()],
            }))
          : [makeAgendaSection()],
        apologies: Array.isArray(parsed.apologies) ? cleanNameList(parsed.apologies) : [],
      };
    }
  } catch {
    // Existing plain-text agendas are converted below.
  }

  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    type: "actsix-agenda-v1",
    sections: [
      {
        id: crypto.randomUUID(),
        heading: "Agenda",
        points: lines.length
          ? lines.map((line) => ({ id: crypto.randomUUID(), text: line }))
          : [makeAgendaPoint()],
      },
    ],
    apologies: [],
  };
};

const serializeAgenda = (sections: AgendaSection[], apologies: string[]) =>
  JSON.stringify({
    type: "actsix-agenda-v1",
    sections: sections.map((section) => ({
      id: section.id,
      heading: section.heading,
      points: section.points,
    })),
    apologies: cleanNameList(apologies),
  });

const parseAttendees = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const formatDate = (date?: string | null) => {
  if (!date) return "No date";

  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isMeetingDayOrAfter = (date?: string | null) => {
  if (!date) return false;

  const today = new Date();
  const meetingDate = new Date(`${date}T00:00:00`);

  today.setHours(0, 0, 0, 0);
  meetingDate.setHours(0, 0, 0, 0);

  return today >= meetingDate;
};

const generateMinutesFromAgenda = (sections: AgendaSection[]) => {
  const cleanSections = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      points: section.points.map((point) => ({ ...point, text: point.text.trim() })).filter((point) => point.text),
    }))
    .filter((section) => section.heading || section.points.length);

  if (!cleanSections.length) return "";

  return cleanSections
    .map((section, sectionIndex) => {
      const sectionNumber = sectionIndex + 1;
      const title = (section.heading || "Untitled Section").toUpperCase();

      const points = section.points
        .map((point, pointIndex) => `${sectionNumber}.${pointIndex + 1} ${point.text}\n\nNotes:\nDecisions:\n`)
        .join("\n");

      return `${sectionNumber}. ${title}\n\n${points}`;
    })
    .join("\n\n");
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const renderMinutesHtml = (notes?: string | null) => {
  if (!notes) return "";

  return notes
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);

      if (/^\d+\.\s+/.test(line)) {
        return `<div class="minutes-section-heading">${escaped.toUpperCase()}</div>`;
      }

      if (/^\d+\.\d+\s+/.test(line)) {
        return `<div class="minutes-agenda-point">${escaped}</div>`;
      }

      if (line.trim() === "") {
        return `<div class="minutes-blank-line"><br /></div>`;
      }

      return `<div>${escaped}</div>`;
    })
    .join("");
};

const getMinutesDocumentText = (element: HTMLDivElement | null) => {
  if (!element) return "";

  const lines = Array.from(element.childNodes).map((node) => {
    const value = node.textContent ?? "";
    return value.replace(/\u00a0/g, " ").trimEnd();
  });

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
};


const cleanAgendaSections = (sections: AgendaSection[]) => {
  const cleaned = sections
    .map((section) => ({
      ...section,
      heading: section.heading.trim(),
      points: section.points
        .map((point) => ({ ...point, text: point.text.trim() }))
        .filter((point) => point.text),
    }))
    .filter((section) => section.heading || section.points.length);

  return cleaned.length ? cleaned : [makeAgendaSection()];
};


const getRecurringSeriesIdFromAgenda = (agenda?: string | Record<string, unknown> | null) => {
  if (!agenda) return null;

  try {
    const parsed = typeof agenda === "string" ? JSON.parse(agenda) : agenda;
    return typeof parsed?.recurringSeriesId === "string" ? parsed.recurringSeriesId : null;
  } catch {
    return null;
  }
};


type MeetingSourceOption = {
  value: string;
  label: string;
  description?: string | null;
};

function MeetingSourceCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
}: {
  value: string;
  onChange: (value: string) => void;
  options: MeetingSourceOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options;

    return options.filter((option) =>
      [option.label, option.description]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(normalizedQuery))
    );
  }, [options, query]);

  return (
    <div className="relative">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 text-left text-sm shadow-soft transition hover:border-brand-teal/40 hover:bg-card focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedOption ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-[56px] z-[80] w-full overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
          <div className="border-b border-border/70 bg-card p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 rounded-2xl border-border/70 bg-background pl-9 pr-3 text-sm focus-visible:ring-brand-teal/40"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-72 overflow-auto bg-card">
            {filteredOptions.length === 0 && (
              <div className="px-4 py-5 text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}

            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-brand-teal/5"
                onClick={() => {
                  onChange(option.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                  <UsersRound className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold tracking-tight text-foreground">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>

                <Check
                  className={`h-4 w-4 shrink-0 text-brand-teal ${
                    value === option.value ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MeetingDetail = () => {
  const minutesRef = useRef<HTMLDivElement | null>(null);
  const { meetingId } = useParams();
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [generatedMinutes, setGeneratedMinutes] = useState("");
  const [generatedActionPoints, setGeneratedActionPoints] = useState<string[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [meeting, setMeeting] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState<any>(EMPTY_MEETING);
  const [actions, setActions] = useState<any[]>([]);
  const [attendeesText, setAttendeesText] = useState("");
  const [apologies, setApologies] = useState<string[]>([]);
  const [agendaSections, setAgendaSections] = useState<AgendaSection[]>([
    makeAgendaSection(),
  ]);
  const [agendaDraft, setAgendaDraft] = useState<AgendaSection[]>([
    makeAgendaSection(),
  ]);
  const [attendeesDraft, setAttendeesDraft] = useState("");
  const [apologiesDraft, setApologiesDraft] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [selectedActionPersonId, setSelectedActionPersonId] = useState("");
  const [due, setDue] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [googleMeetUrlDraft, setGoogleMeetUrlDraft] = useState("");
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [meetingPeopleOpen, setMeetingPeopleOpen] = useState(false);
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false);

  const [meetingPeople, setMeetingPeople] = useState<any[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<any[]>([]);
  const [groupOptions, setGroupOptions] = useState<any[]>([]);
  const [folderOptions, setFolderOptions] = useState<any[]>([]);
  const [meetingGroupSources, setMeetingGroupSources] = useState<any[]>([]);
  const [meetingFolderSources, setMeetingFolderSources] = useState<any[]>([]);
  const [selectedMeetingPersonId, setSelectedMeetingPersonId] = useState("");
  const [selectedMeetingGroupId, setSelectedMeetingGroupId] = useState("");
  const [selectedMeetingFolderId, setSelectedMeetingFolderId] = useState("");
  const [selectedMeetingGroupFolderId, setSelectedMeetingGroupFolderId] = useState("");

  const attendeeList = useMemo(() => parseAttendees(attendeesText), [attendeesText]);

  const linkedAttendedCount = meetingPeople.filter((person) => person.status === "attended").length;
  const linkedApologyCount = meetingPeople.filter((person) => person.status === "apology").length;
  const linkedAbsentCount = meetingPeople.filter((person) => person.status === "absent").length;

  const meetingActionPeople = useMemo(() => {
    return meetingPeople
      .filter((meetingPerson) => meetingPerson.status !== "not_required")
      .map((meetingPerson) => {
        const person = Array.isArray(meetingPerson.people)
          ? meetingPerson.people[0]
          : meetingPerson.people;

        if (!meetingPerson.person_id || !person?.display_name) return null;

        return {
          id: meetingPerson.person_id,
          display_name: person.display_name,
          email: person.email || null,
          avatar_url: person.avatar_url || null,
        };
      })
      .filter(Boolean) as any[];
  }, [meetingPeople]);

  const showActionPoints = isMeetingDayOrAfter(meeting?.meeting_date);
  const meetingMode = String(meeting?.type || "").trim().toLowerCase();
  const shouldShowOnlineMeetingTools = meetingMode === "online" || meetingMode === "hybrid";

  const meetingGroupFolderOptions = useMemo(
    () => [
      ...folderOptions.map((folder) => ({
        value: `folder:${folder.id}`,
        label: folder.name,
        description: "Folder",
      })),
      ...groupOptions.map((group) => ({
        value: `group:${group.id}`,
        label: group.name,
        description: "Group",
      })),
    ],
    [folderOptions, groupOptions]
  );

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

    const agendaPayload = parseAgendaPayload(meetingData.agenda);

    setMeeting(meetingData);
    setEditDraft(meetingData);
    setGoogleMeetUrlDraft(meetingData.google_meet_url || "");
    setAttendeesText(
      Array.isArray(meetingData.attendees)
        ? meetingData.attendees.join(", ")
        : ""
    );
    setApologies(agendaPayload.apologies ?? []);
    setAgendaSections(agendaPayload.sections);
    setActions(actionData ?? []);
  };


  useEffect(() => {
    if (!meetingId) return;

    const savedTranscript = localStorage.getItem(`actsix_meeting_transcript_${meetingId}`) || "";
    setTranscriptText(savedTranscript);

    const savedGeneratedMinutes = localStorage.getItem(`actsix_meeting_generated_minutes_${meetingId}`) || "";
    const savedGeneratedActionPoints = localStorage.getItem(`actsix_meeting_generated_actions_${meetingId}`) || "[]";

    setGeneratedMinutes(savedGeneratedMinutes);

    try {
      setGeneratedActionPoints(JSON.parse(savedGeneratedActionPoints));
    } catch {
      setGeneratedActionPoints([]);
    }

  }, [meetingId]);

  useEffect(() => {
    load();
  }, [user, meetingId]);

  const saveMeetingDetails = async () => {
    if (!meeting) return;

    const { error } = await supabase
      .from("meetings")
      .update({
        title: editDraft.title || "",
        meeting_date: editDraft.meeting_date || null,
        meeting_time: editDraft.meeting_time || null,
        location: editDraft.location || "",
        type: editDraft.type || "General",
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Meeting details updated");
    setEditOpen(false);
    load();
  };

  const saveGoogleMeetUrl = async () => {
    if (!meeting) return;

    const cleanUrl = googleMeetUrlDraft.trim();

    const { error } = await (supabase as any)
      .from("meetings")
      .update({
        google_meet_url: cleanUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setMeeting({ ...meeting, google_meet_url: cleanUrl || null });
    setGoogleMeetUrlDraft(cleanUrl);
    toast.success(cleanUrl ? "Google Meet link saved" : "Google Meet link removed");
  };

  const openGoogleMeet = () => {
    const url = (meeting?.google_meet_url || googleMeetUrlDraft || "").trim();

    if (!url) {
      toast.error("No Google Meet link saved yet.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyGoogleMeetUrl = async () => {
    const url = (meeting?.google_meet_url || googleMeetUrlDraft || "").trim();

    if (!url) {
      toast.error("No Google Meet link saved yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Google Meet link copied");
    } catch {
      toast.error("Could not copy Google Meet link.");
    }
  };


  const saveTranscript = (value: string) => {
    setTranscriptText(value);

    if (meetingId) {
      localStorage.setItem(`actsix_meeting_transcript_${meetingId}`, value);
    }
  };

  const saveGeneratedMinutes = (value: string) => {
    setGeneratedMinutes(value);

    if (meetingId) {
      localStorage.setItem(`actsix_meeting_generated_minutes_${meetingId}`, value);
    }
  };

  const saveGeneratedActionPoints = (items: string[]) => {
    setGeneratedActionPoints(items);

    if (meetingId) {
      localStorage.setItem(`actsix_meeting_generated_actions_${meetingId}`, JSON.stringify(items));
    }
  };

  const processTranscriptIntoMinutes = async () => {
    if (!transcriptText.trim()) {
      toast.error("There is no transcript to process yet.");
      return;
    }

    setProcessingTranscript(true);

    try {
      const response = await fetch("http://localhost:5055/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcriptText,
          meeting_title: meeting?.title || "Staff Meeting",
        }),
      });

      if (!response.ok) {
        throw new Error("Transcript processing failed.");
      }

      const result = await response.json();

      saveGeneratedMinutes(result.minutes || "");
      saveGeneratedActionPoints(result.action_points || []);

      toast.success(
        result.source === "ollama"
          ? "Minutes generated with local AI"
          : "Minutes generated with fallback processor"
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not generate minutes from transcript.");
    } finally {
      setProcessingTranscript(false);
    }
  };

  const copyGeneratedMinutesToMinutes = () => {
    if (!meeting || !generatedMinutes.trim()) return;

    setMeeting({
      ...meeting,
      notes: meeting.notes?.trim()
        ? `${meeting.notes.trim()}\n\n${generatedMinutes.trim()}`
        : generatedMinutes.trim(),
    });

    toast.success("Generated notes copied into minutes");
  };

  const transcribeAudio = async () => {
    if (!transcriptFile) {
      toast.error("Please choose an audio file first.");
      return;
    }

    setTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("file", transcriptFile);

      const response = await fetch("http://localhost:5055/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription server did not respond successfully.");
      }

      const result = await response.json();
      saveTranscript(result.text || "");
      toast.success("Transcript created");
    } catch (error) {
      console.error(error);
      toast.error("Could not transcribe audio. Make sure the local transcriber server is running.");
    } finally {
      setTranscribing(false);
    }
  };

  const copyTranscriptToMinutes = () => {
    if (!meeting || !transcriptText.trim()) return;

    const transcriptMinutes = `TRANSCRIPT NOTES

${transcriptText.trim()}`;

    setMeeting({
      ...meeting,
      notes: meeting.notes?.trim()
        ? `${meeting.notes.trim()}\n\n${transcriptMinutes}`
        : transcriptMinutes,
    });

    toast.success("Transcript copied into minutes");
  };

  const saveMinutes = async () => {
    if (!meeting) return;

    const latestMinutes = getMinutesDocumentText(minutesRef.current) || meeting.notes || "";

    const { error } = await supabase
      .from("meetings")
      .update({
        notes: latestMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setMeeting({ ...meeting, notes: latestMinutes });
    toast.success("Minutes saved");
  };

  const saveAgenda = async () => {
    if (!meeting) return;

    const cleaned = cleanAgendaSections(agendaDraft);
    const generatedMinutes = generateMinutesFromAgenda(cleaned);

    const { error } = await supabase
      .from("meetings")
      .update({
        agenda: serializeAgenda(cleaned, apologies),
        notes: generatedMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setAgendaSections(cleaned);
    setMeeting({ ...meeting, agenda: serializeAgenda(cleaned, apologies), notes: generatedMinutes });
    toast.success("Agenda saved and minutes filled");
    setAgendaOpen(false);
  };

  const savePeople = async () => {
    if (!meeting) return;

    const attendees = parseAttendees(attendeesDraft);
    const apologiesList = parseAttendees(apologiesDraft);

    const { error } = await supabase
      .from("meetings")
      .update({
        attendees,
        agenda: serializeAgenda(agendaSections, apologiesList),
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setAttendeesText(attendees.join(", "));
    setApologies(apologiesList);
    toast.success("Attendees and apologies updated");
    setPeopleOpen(false);
  };

  const deleteMeeting = async () => {
    if (!meeting) return;

    const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Meeting deleted");
    navigate(getRecurringSeriesIdFromAgenda(meeting?.agenda) ? `/meetings/recurring/${getRecurringSeriesIdFromAgenda(meeting?.agenda)}` : "/meetings");
  };

  const loadMeetingPeopleSources = async () => {
    if (!user || !meetingId || !currentPerson?.workspace_id) return;

    const [scopeResult, peopleResult, groupsResult, foldersResult] = await Promise.all([
      (supabase as any).rpc("get_meeting_people_scope", {
        p_meeting_id: meetingId,
      }),

      (supabase as any)
        .from("people")
        .select("id, display_name, email, avatar_url")
        .eq("workspace_id", currentPerson.workspace_id)
        .order("display_name", { ascending: true }),

      (supabase as any)
        .from("people_groups")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      (supabase as any)
        .from("people_group_folders")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
    ]);

    const firstError =
      scopeResult.error ||
      peopleResult.error ||
      groupsResult.error ||
      foldersResult.error;

    if (firstError) {
      toast.error(firstError.message);
      return;
    }

    const scopeRows = scopeResult.data || [];

    setMeetingPeople(
      scopeRows
        .filter((row: any) => row.row_kind === "person")
        .map((row: any) => ({
          id: row.id,
          person_id: row.person_id,
          status: row.status,
          people: {
            id: row.person_id,
            display_name: row.display_name,
            email: row.email,
          },
        }))
    );

    setMeetingGroupSources(
      scopeRows
        .filter((row: any) => row.row_kind === "group_source")
        .map((row: any) => ({
          id: row.id,
          group_id: row.source_id,
          people_groups: {
            id: row.source_id,
            name: row.source_name,
          },
        }))
    );

    setMeetingFolderSources(
      scopeRows
        .filter((row: any) => row.row_kind === "folder_source")
        .map((row: any) => ({
          id: row.id,
          folder_id: row.source_id,
          people_group_folders: {
            id: row.source_id,
            name: row.source_name,
          },
        }))
    );

    setPeopleOptions(peopleResult.data || []);
    setGroupOptions(groupsResult.data || []);
    setFolderOptions(foldersResult.data || []);
  };

  const addMeetingPersonSource = async () => {
    if (!meetingId || !selectedMeetingPersonId) return;

    const { error } = await (supabase as any).rpc("add_meeting_individual_person", {
      p_meeting_id: meetingId,
      p_person_id: selectedMeetingPersonId,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedMeetingPersonId("");
    toast.success("Person added to meeting");
    loadMeetingPeopleSources();
  };

  const addMeetingGroupSource = async () => {
    if (!meetingId || !selectedMeetingGroupId) return;

    const { error } = await (supabase as any).rpc("add_meeting_group_source", {
      p_meeting_id: meetingId,
      p_group_id: selectedMeetingGroupId,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedMeetingGroupId("");
    toast.success("Group added to meeting");
    loadMeetingPeopleSources();
  };

  const addMeetingFolderSource = async () => {
    if (!meetingId || !selectedMeetingFolderId) return;

    const { error } = await (supabase as any).rpc("add_meeting_folder_source", {
      p_meeting_id: meetingId,
      p_folder_id: selectedMeetingFolderId,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedMeetingFolderId("");
    toast.success("Folder added to meeting");
    loadMeetingPeopleSources();
  };

  const addMeetingGroupOrFolderSource = async () => {
    if (!meetingId || !selectedMeetingGroupFolderId) return;

    const [sourceType, sourceId] = selectedMeetingGroupFolderId.split(":");

    if (!sourceType || !sourceId) return;

    const rpcName =
      sourceType === "folder"
        ? "add_meeting_folder_source"
        : "add_meeting_group_source";

    const rpcArgs =
      sourceType === "folder"
        ? { p_meeting_id: meetingId, p_folder_id: sourceId }
        : { p_meeting_id: meetingId, p_group_id: sourceId };

    const { error } = await (supabase as any).rpc(rpcName, rpcArgs);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedMeetingGroupFolderId("");
    toast.success(sourceType === "folder" ? "Folder added to meeting" : "Group added to meeting");
    await loadMeetingPeopleSources();
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

    const selectedActionPerson = meetingActionPeople.find(
      (person) => person.id === selectedActionPersonId
    );
    const newActionId = crypto.randomUUID();

    const { error } = await supabase.from("meeting_actions").insert({
      id: newActionId,
      meeting_id: meeting.id,
      user_id: user.id,
      title: actionTitle.trim(),
      assignee: selectedActionPerson?.display_name || assignee.trim(),
      assigned_person_id: selectedActionPersonId || null,
      due: due || null,
      linked_project: "",
      status: "Open",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (selectedActionPersonId) {
      await createNotificationForPerson({
        personId: selectedActionPersonId,
        title: "Meeting action point assigned",
        message: `You have been assigned: ${actionTitle.trim()}`,
        type: "assignment",
        entityType: "meeting_action",
        entityId: meeting.id,
      });
    }

    setActionTitle("");
    setAssignee("");
    setSelectedActionPersonId("");
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

  const updateMeetingPersonStatus = async (personId: string, status: string) => {
    if (!meetingId) return;

    const { error } = await (supabase as any).rpc("update_meeting_person_status", {
      p_meeting_id: meetingId,
      p_person_id: personId,
      p_status: status,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadMeetingPeopleSources();
  };

  const removeMeetingPersonFromMeeting = async (personId: string) => {
    if (!meetingId) return;

    const { error } = await (supabase as any).rpc("remove_meeting_person", {
      p_meeting_id: meetingId,
      p_person_id: personId,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (selectedActionPersonId === personId) {
      setSelectedActionPersonId("");
      setAssignee("");
    }

    toast.success("Person removed from meeting");
    await loadMeetingPeopleSources();
  };

  const openEditModal = () => {
    setEditDraft(meeting ?? EMPTY_MEETING);
    setEditOpen(true);
  };

  const openAgendaModal = () => {
    setAgendaDraft(agendaSections.length ? agendaSections : [makeAgendaSection()]);
    setAgendaOpen(true);
  };

  const openPeopleModal = () => {
    setAttendeesDraft(attendeesText);
    setApologiesDraft(apologies.join(", "));
    setPeopleOpen(true);
  };

  useEffect(() => {
    loadMeetingPeopleSources();
  }, [meetingId, user?.id, currentPerson?.workspace_id]);

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
        subtitle="Agenda, minutes, attendees, apologies, and action points."
      />

      <style>{`
        .minutes-document:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
        }

        .minutes-section-heading {
          margin-top: 1rem;
          margin-bottom: 0.35rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: hsl(var(--foreground));
        }

        .minutes-section-heading:first-child {
          margin-top: 0;
        }

        .minutes-agenda-point {
          margin-top: 0.75rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .minutes-blank-line {
          min-height: 0.35rem;
          line-height: 0.35rem;
        }

        .minutes-document div {
          min-height: 1.4em;
        }
      `}</style>

      <div className="px-8 pb-12 max-w-7xl space-y-5">
<Card className="p-5 border-border/70 bg-card shadow-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-extrabold tracking-tight truncate">
                  {meeting.title || "Untitled Meeting"}
                </h2>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(meeting.meeting_date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4" />
                  {meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : "No time"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {meeting.location || "No location"}
                </span>
                <span className="chip bg-background/70">
                  {meeting.type || "General"}
                </span>
              </div>
            </div>

            <div className="relative flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMeetingMenuOpen((current) => !current)}
                aria-label="Meeting options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>

              {meetingMenuOpen && (
                <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition hover:bg-muted"
                    onClick={() => {
                      setMeetingMenuOpen(false);
                      openEditModal();
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Meeting
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-3 border-t border-border/70 px-4 py-3 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                    onClick={() => {
                      setMeetingMenuOpen(false);
                      deleteMeeting();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Meeting
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UsersRound className="h-4 w-4" />
                <span className="label-eyebrow">Attendees</span>
              </div>
              <div className="mt-2 text-2xl font-extrabold">{linkedAttendedCount || attendeeList.length}</div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserRoundX className="h-4 w-4" />
                <span className="label-eyebrow">Apologies</span>
              </div>
              <div className="mt-2 text-2xl font-extrabold">{linkedApologyCount || apologies.length}</div>
            </div>


            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ListChecks className="h-4 w-4" />
                <span className="label-eyebrow">Actions</span>
              </div>
              <div className="mt-2 text-2xl font-extrabold">{actions.length}</div>
            </div>
          </div>
        </Card>

        {shouldShowOnlineMeetingTools && (
        <Card className="border-border/70 bg-card p-5 shadow-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                  <Video className="h-5 w-5" />
                </div>

                <div>
                  <p className="label-eyebrow">Online Meeting</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Google Meet
                  </h2>
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Add a Google Meet link for this meeting so the online meeting workflow stays connected to the agenda, minutes, and action points.
              </p>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <Input
                  value={googleMeetUrlDraft}
                  onChange={(event) => setGoogleMeetUrlDraft(event.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="border-border/70 bg-background"
                />

                <Button
                  type="button"
                  className="actsix-btn-primary rounded-xl md:w-auto"
                  onClick={saveGoogleMeetUrl}
                >
                  <Save className="h-4 w-4" />
                  Save Link
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={copyGoogleMeetUrl}
                disabled={!(meeting?.google_meet_url || googleMeetUrlDraft).trim()}
              >
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={openGoogleMeet}
                disabled={!(meeting?.google_meet_url || googleMeetUrlDraft).trim()}
              >
                <ExternalLink className="h-4 w-4" />
                Open Meet
              </Button>
            </div>
          </div>
        </Card>
        )}

        <div className="flex flex-wrap items-center justify-start gap-3">
          <Button className="actsix-btn-soft rounded-xl" onClick={openAgendaModal}>
            <FileText className="h-4 w-4" />
            Edit Agenda
          </Button>

        <Button
          type="button"
          variant="outline"
          className="rounded-full px-6 py-6"
          onClick={() => setMeetingPeopleOpen(true)}
        >
          <UsersRound className="h-4 w-4 mr-2" />
          Edit People
        </Button>

          <Button variant="outline" className="rounded-xl" onClick={() => setMinutesOpen((current) => !current)}>
            <Save className="h-4 w-4 mr-2" />
            {minutesOpen ? "Hide Minutes" : "Edit Minutes"}
          </Button>
        </div>



        {showActionPoints && transcriptOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
            <Card className="w-full max-w-5xl max-h-[86vh] overflow-auto border-border/70 bg-card shadow-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">Meeting Transcription</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    Upload Recording
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload an audio recording and transcribe it locally using the ACTSIX transcriber server.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setTranscriptOpen(false)}
                  >
                    Close
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={processTranscriptIntoMinutes}
                    disabled={!transcriptText.trim() || processingTranscript}
                  >
                    {processingTranscript ? "Generating..." : "Generate Minutes"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={copyGeneratedMinutesToMinutes}
                    disabled={!generatedMinutes.trim()}
                  >
                    Copy Generated Notes
                  </Button>

                  <Button
                    type="button"
                    className="actsix-btn-primary rounded-xl"
                    onClick={transcribeAudio}
                    disabled={!transcriptFile || transcribing}
                  >
                    {transcribing ? "Transcribing..." : "Transcribe"}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-xl border border-border/70 bg-background p-4">
                  <label className="label-eyebrow">Audio File</label>

                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(event) => setTranscriptFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-brand-teal/10 file:px-3 file:py-2 file:text-sm file:font-bold file:text-brand-teal hover:file:bg-brand-teal/15"
                  />

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Supported files depend on your local ffmpeg setup. MP3, WAV, M4A, and MP4 are good starting points.
                  </p>
                </div>

                <div className="rounded-xl border border-border/70 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-start gap-3">
                    <label className="label-eyebrow">Transcript</label>

                    {transcriptText.trim() && (
                      <button
                        type="button"
                        className="text-xs font-bold text-muted-foreground hover:text-brand-teal"
                        onClick={() => saveTranscript("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <textarea
                    value={transcriptText}
                    onChange={(event) => saveTranscript(event.target.value)}
                    placeholder="Transcript will appear here..."
                    className="mt-3 min-h-[260px] w-full resize-y rounded-xl border border-border/70 bg-card p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
                <div className="flex flex-wrap items-center justify-start gap-3">
                  <label className="label-eyebrow">Generated Meeting Notes</label>

                  {generatedMinutes.trim() && (
                    <button
                      type="button"
                      className="text-xs font-bold text-muted-foreground hover:text-brand-teal"
                      onClick={() => {
                        saveGeneratedMinutes("");
                        saveGeneratedActionPoints([]);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <textarea
                  value={generatedMinutes}
                  onChange={(event) => saveGeneratedMinutes(event.target.value)}
                  placeholder="Generated minutes and action points will appear here..."
                  className="mt-3 min-h-[260px] w-full resize-y rounded-xl border border-border/70 bg-card p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                {generatedActionPoints.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
                    <p className="label-eyebrow">Extracted Action Points</p>

                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      {generatedActionPoints.map((point, index) => (
                        <li key={`${point}-${index}`} className="leading-6">
                          • {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        <Card className="p-5 border-border/70 bg-card shadow-card">

          <div className="mb-5 rounded-xl border border-border/70 bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="label-eyebrow">Meeting Day Tools</p>
                <div className="mt-1 text-sm text-muted-foreground">
                  Transcription and action points are available from the day of the meeting.
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setTranscriptOpen(true)}
              >
                Open Transcription
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-2.5 py-1 font-bold">
                {transcriptText.trim() ? "Transcript saved" : "No transcript yet"}
              </span>

              <span className="rounded-full border border-border bg-card px-2.5 py-1 font-bold">
                {meeting.action_points?.length || 0} action points
              </span>
            </div>
          </div>

          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="label-eyebrow">Minutes</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">Meeting Minutes</h2>
            </div>
            <Badge variant="outline" className="rounded-full text-muted-foreground">
              Auto-filled from agenda
            </Badge>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="label-eyebrow">Minutes</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Meeting minutes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep the page clean by opening the full minutes editor only when needed.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-fit rounded-xl"
              onClick={() => setMinutesOpen((current) => !current)}
            >
              {minutesOpen ? "Hide Minutes" : "Open Minutes"}
            </Button>
          </div>

          {minutesOpen ? (
          <div
            ref={minutesRef}
            contentEditable
            suppressContentEditableWarning
            className="minutes-document min-h-[360px] rounded-xl border border-border/70 bg-background px-4 py-4 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-placeholder="Meeting notes, decisions, and minutes..."
            dangerouslySetInnerHTML={{ __html: renderMinutesHtml(meeting.notes || "") }}
            onBlur={(event) => {
              setMeeting({
                ...meeting,
                notes: getMinutesDocumentText(event.currentTarget),
              });
            }}
          />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/70 p-5 text-sm text-muted-foreground">
              Minutes are collapsed. Click <span className="font-semibold text-foreground">Open Minutes</span> to edit the full document.
            </div>
          )}
        </Card>

        <Dialog open={meetingPeopleOpen} onOpenChange={setMeetingPeopleOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col overflow-hidden rounded-2xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Edit People</DialogTitle>
            <DialogDescription>
              Add individuals, groups, or folders to define who belongs in this meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            <Card className="border-0 bg-transparent p-0 shadow-none">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="label-eyebrow">Meeting People</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">People scope</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add individuals, groups, or folders to define who belongs in this meeting.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setMeetingPeopleOpen(false);
                  setPeopleOpen(true);
                }}
              >
                <UsersRound className="h-4 w-4 mr-2" />
                Attendance / Apologies
              </Button>

              <Badge variant="secondary" className="w-fit rounded-full">
                {meetingPeople.length} people
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <label className="label-eyebrow">Add individual</label>
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1">
                  <PeopleSearchSelect
                    people={peopleOptions}
                    selectedPersonId={selectedMeetingPersonId}
                    onSelect={setSelectedMeetingPersonId}
                    placeholder="Search by name, email, or phone..."
                    emptyText="No matching People profiles found."
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={addMeetingPersonSource}
                  disabled={!selectedMeetingPersonId}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <label className="label-eyebrow">Add group or folder</label>
              <div className="mt-2 flex gap-2">
                <div className="min-w-0 flex-1">
                  <MeetingSourceCombobox
                    value={selectedMeetingGroupFolderId}
                    onChange={setSelectedMeetingGroupFolderId}
                    options={meetingGroupFolderOptions}
                    placeholder="Search groups and folders..."
                    searchPlaceholder="Search groups or folders..."
                    emptyText="No groups or folders found."
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={addMeetingGroupOrFolderSource}
                  disabled={!selectedMeetingGroupFolderId}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="label-eyebrow">Sources</p>

              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {meetingGroupSources.length === 0 && meetingFolderSources.length === 0 && (
                  <p>No group or folder sources yet.</p>
                )}

                {meetingGroupSources.map((source) => (
                  <div key={`group-${source.id}`} className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    Group: {source.people_groups?.name || "Unnamed group"}
                  </div>
                ))}

                {meetingFolderSources.map((source) => (
                  <div key={`folder-${source.id}`} className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    Folder: {source.people_group_folders?.name || "Unnamed folder"}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="label-eyebrow">Meeting people</p>

              <div className="mt-3 max-h-52 space-y-2 overflow-auto text-sm">
                {meetingPeople.length === 0 && (
                  <p className="text-muted-foreground">No people added to this meeting yet.</p>
                )}

                {meetingPeople.map((meetingPerson) => {
                  const person = Array.isArray(meetingPerson.people)
                    ? meetingPerson.people[0]
                    : meetingPerson.people;

                  return (
                    <div key={meetingPerson.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{person?.display_name || "Unknown person"}</p>
                        {person?.email && (
                          <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {meetingPerson.status}
                        </Badge>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Remove from meeting"
                          onClick={() => removeMeetingPersonFromMeeting(meetingPerson.person_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setMeetingPeopleOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        {showActionPoints ? (
          <Card className="p-5 border-border/70 bg-card shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="label-eyebrow">Action Points</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">Follow-up Tasks</h2>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {actions.length}
              </Badge>
            </div>

            <form onSubmit={addAction} className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_320px_150px_auto]">
              <Input
                value={actionTitle}
                onChange={(event) => setActionTitle(event.target.value)}
                placeholder="Action point..."
                className="border-border/70 bg-background"
              />

              <PeopleSearchSelect
                people={meetingActionPeople}
                selectedPersonId={selectedActionPersonId}
                onSelect={(personId) => {
                  setSelectedActionPersonId(personId);
                  const person = meetingActionPeople.find((option) => option.id === personId);
                  setAssignee(person?.display_name || "");
                }}
                placeholder="Search meeting people..."
                emptyText="No matching meeting people found."
                zIndexClass="z-20"
                dropdownZIndexClass="z-30"
              />

              <Input
                type="date"
                value={due}
                onChange={(event) => setDue(event.target.value)}
                className="border-border/70 bg-background"
              />

              <Button type="submit" className="actsix-btn-primary rounded-xl">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            <div className="space-y-2">
              {actions.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No action points yet. Add follow-up tasks during or after the meeting.
                </div>
              )}

              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{action.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {action.assignee || "Unassigned"}
                      {action.due ? ` · Due ${action.due}` : ""}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAction(action.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-border/70 bg-muted/20 shadow-soft">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-brand-teal" />
              Transcription and Action Points will appear on the day of the meeting.
            </div>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Edit Meeting</DialogTitle>
            <DialogDescription>
              Change the core meeting information without crowding the main page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-eyebrow">Meeting title</label>
              <Input
                value={editDraft.title || ""}
                onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                className="mt-2 border-border/70 bg-background"
              />
            </div>

            <div>
              <label className="label-eyebrow">Date</label>
              <Input
                type="date"
                value={editDraft.meeting_date || ""}
                onChange={(event) => setEditDraft({ ...editDraft, meeting_date: event.target.value || null })}
                className="mt-2 border-border/70 bg-background"
              />
            </div>

            <div>
              <label className="label-eyebrow">Time</label>
              <Input
                type="time"
                value={editDraft.meeting_time || ""}
                onChange={(event) => setEditDraft({ ...editDraft, meeting_time: event.target.value || null })}
                className="mt-2 border-border/70 bg-background"
              />
            </div>

            <div>
              <label className="label-eyebrow">Location</label>
              <Input
                value={editDraft.location || ""}
                onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })}
                className="mt-2 border-border/70 bg-background"
              />
            </div>

            <div>
              <label className="label-eyebrow">Type</label>
              <Input
                value={editDraft.type || "General"}
                onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value })}
                className="mt-2 border-border/70 bg-background"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className="actsix-btn-primary rounded-xl" onClick={saveMeetingDetails}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={peopleOpen} onOpenChange={setPeopleOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col overflow-hidden rounded-2xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Attendance / Apologies</DialogTitle>
            <DialogDescription>
              Mark attendance from the People already connected to this meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
            {meetingPeople.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                No people have been added to this meeting yet. Add individuals, groups, or folders in the Meeting People section first.
              </div>
            )}

            {meetingPeople.map((meetingPerson) => {
              const person = Array.isArray(meetingPerson.people)
                ? meetingPerson.people[0]
                : meetingPerson.people;

              const statusOptions = [
                { value: "invited", label: "Invited" },
                { value: "attended", label: "Attended" },
                { value: "apology", label: "Apology" },
                { value: "absent", label: "Absent" },
                { value: "not_required", label: "Not required" },
              ];

              return (
                <div
                  key={meetingPerson.id}
                  className="rounded-2xl border border-border/70 bg-background p-3"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold tracking-tight">
                        {person?.display_name || "Unknown person"}
                      </p>
                      {person?.email && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {person.email}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {statusOptions.map((option) => {
                        const active = meetingPerson.status === option.value;

                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant={active ? "default" : "outline"}
                            size="sm"
                            className={active ? "actsix-btn-primary rounded-xl px-3" : "rounded-xl px-3"}
                            onClick={() =>
                              updateMeetingPersonStatus(meetingPerson.person_id, option.value)
                            }
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setPeopleOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={agendaOpen} onOpenChange={setAgendaOpen}>
        <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto rounded-2xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Edit Agenda</DialogTitle>
            <DialogDescription>
              Build the agenda here. Saving will auto-fill the Minutes section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {agendaDraft.map((section, sectionIndex) => (
              <Card key={section.id} className="p-4 border-border/70 bg-muted/10 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
                    {sectionIndex + 1}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={section.heading}
                        onChange={(event) =>
                          setAgendaDraft((sections) =>
                            sections.map((item) =>
                              item.id === section.id ? { ...item, heading: event.target.value } : item
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
                        onClick={() =>
                          setAgendaDraft((sections) =>
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
                              setAgendaDraft((sections) =>
                                sections.map((item) =>
                                  item.id === section.id
                                    ? {
                                        ...item,
                                        points: item.points.map((agendaPoint) =>
                                          agendaPoint.id === point.id
                                            ? { ...agendaPoint, text: event.target.value }
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
                            onClick={() =>
                              setAgendaDraft((sections) =>
                                sections.map((item) =>
                                  item.id === section.id
                                    ? {
                                        ...item,
                                        points:
                                          item.points.length > 1
                                            ? item.points.filter((agendaPoint) => agendaPoint.id !== point.id)
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
                        setAgendaDraft((sections) =>
                          sections.map((item) =>
                            item.id === section.id
                              ? { ...item, points: [...item.points, makeAgendaPoint()] }
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setAgendaDraft((sections) => [...sections, makeAgendaSection()])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
            <Button className="actsix-btn-primary rounded-xl" onClick={saveAgenda}>
              Save Agenda and Fill Minutes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeetingDetail;
