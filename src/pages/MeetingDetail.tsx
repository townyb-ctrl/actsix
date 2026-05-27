import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bold, CalendarDays, Check, CheckCircle2, ChevronsUpDown, Clock3, Copy, ExternalLink, FileText, Heading1, Heading2, Italic, ListChecks, MapPin, Mic, MoreHorizontal, Pencil, Pilcrow, Plus, Search, Trash2, UserRoundX, UsersRound, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createNotificationForPerson } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PeopleSearchSelect } from "@/components/people/PeopleSearchSelect";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  MeetingPeopleHeaderActions,
  MeetingPeopleSection,
} from "@/components/meeting/MeetingPeopleSection";
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
  notes: "",
};

const TRANSCRIBER_ENABLED = import.meta.env.VITE_ACTSIX_TRANSCRIBER_ENABLED === "true";

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
        .map((point, pointIndex) => `${sectionNumber}.${pointIndex + 1} ${point.text}\nNotes:\nDecisions:`)
        .join("\n\n");

      return points ? `${sectionNumber}. ${title}\n${points}` : `${sectionNumber}. ${title}`;
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

  if (/<\/?[a-z][\s\S]*>/i.test(notes)) {
    return sanitizeMinutesHtml(notes);
  }

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

const sanitizeMinutesHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");

const getMinutesDocumentHtml = (element: HTMLDivElement | null) => {
  if (!element) return "";

  return sanitizeMinutesHtml(element.innerHTML).trim();
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownId = useRef(`meeting-source-${Math.random().toString(36).slice(2)}`);

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

  const announceOpen = () => {
    document.dispatchEvent(
      new CustomEvent("actsix-dropdown-open", { detail: dropdownId.current })
    );
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleOtherDropdownOpen = (event: Event) => {
      const customEvent = event as CustomEvent<string>;

      if (customEvent.detail !== dropdownId.current) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("actsix-dropdown-open", handleOtherDropdownOpen as EventListener);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("actsix-dropdown-open", handleOtherDropdownOpen as EventListener);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${open ? "z-[300]" : "z-[20]"}`}>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 text-left text-sm shadow-soft transition hover:border-brand-teal/40 hover:bg-card focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
        onClick={() => {
          if (!open) {
            announceOpen();
            setOpen(true);
            return;
          }

          setOpen(false);
        }}
      >
        <span className={selectedOption ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-2 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
          <div className="border-b border-border/70 bg-card p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onFocus={announceOpen}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 rounded-2xl border-border/70 bg-background pl-9 pr-3 text-sm focus-visible:ring-brand-teal/40"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto bg-card">
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
  const [minutesToolbarOpen, setMinutesToolbarOpen] = useState(false);
  const [meetingPeopleOpen, setMeetingPeopleOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [chairpersonId, setChairpersonId] = useState("");
  const [minuteTakerId, setMinuteTakerId] = useState("");
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"people" | "actions">("people");

  const [meetingPeople, setMeetingPeople] = useState<any[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<any[]>([]);
  const [groupOptions, setGroupOptions] = useState<any[]>([]);
  const [folderOptions, setFolderOptions] = useState<any[]>([]);
  const [meetingGroupSources, setMeetingGroupSources] = useState<any[]>([]);
  const [meetingFolderSources, setMeetingFolderSources] = useState<any[]>([]);
  const [selectedMeetingPersonIds, setSelectedMeetingPersonIds] = useState<string[]>([]);
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

  const chairpersonName =
    meetingActionPeople.find((person) => person.id === chairpersonId)?.display_name ||
    "Not assigned";

  const minuteTakerName =
    meetingActionPeople.find((person) => person.id === minuteTakerId)?.display_name ||
    "Not assigned";

  const meetingLeaderOptions = useMemo(
    () =>
      meetingActionPeople.map((person) => ({
        value: person.id,
        label: person.display_name,
        description: person.email || "Meeting person",
      })),
    [meetingActionPeople]
  );

  const inviteRecipients = useMemo(() => {
    return meetingPeople
      .map((meetingPerson) => {
        const person = Array.isArray(meetingPerson.people)
          ? meetingPerson.people[0]
          : meetingPerson.people;

        if (!meetingPerson.person_id || !person?.display_name) return null;

        return {
          meetingPersonId: meetingPerson.id,
          personId: meetingPerson.person_id,
          displayName: person.display_name,
          email: person.email || "",
        };
      })
      .filter(Boolean) as {
        meetingPersonId: string;
        personId: string;
        displayName: string;
        email: string;
      }[];
  }, [meetingPeople]);

  const currentUserMeetingPerson = useMemo(() => {
    if (!currentPerson?.id) return null;

    return meetingPeople.find(
      (meetingPerson) => meetingPerson.person_id === currentPerson.id
    );
  }, [meetingPeople, currentPerson?.id]);

  const currentUserMeetingStatus = currentUserMeetingPerson?.status || "invited";

  const buildInviteMessage = () => {
    const meetingName = meeting?.title || "this";
    const meetingDate = meeting?.meeting_date
      ? formatDate(meeting.meeting_date)
      : "the scheduled date";
    const meetingTime = meeting?.meeting_time || "the scheduled time";

    return `Hey {{username}}, you have been invited to a ${meetingName} meeting. On ${meetingDate} at ${meetingTime}. Please respond with your availability.`;
  };

const openInviteModal = () => {
  setInviteMessage(buildInviteMessage());
  setInviteOpen(true);
};

const sendMeetingInvites = async () => {
  if (!meeting?.id || inviteRecipients.length === 0) return;

  const results = await Promise.all(
    inviteRecipients.map((recipient) =>
      (supabase as any)
        .from("meeting_people")
        .update({ status: "invite_sent" })
        .eq("meeting_id", meeting.id)
        .eq("person_id", recipient.personId)
    )
  );

  const firstError = results.find((result) => result.error)?.error;

  if (firstError) {
    toast.error(firstError.message);
    return;
  }

  toast.success("Meeting invites marked as sent");
  setInviteOpen(false);
  await loadMeetingPeopleSources();
};


  const hasOnlineMeetingTools = Boolean((meeting?.google_meet_url || googleMeetUrlDraft).trim());
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
    setChairpersonId(meetingData.chairperson_id || "");
    setMinuteTakerId(meetingData.minute_taker_id || "");
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

    const latestMinutes = getMinutesDocumentHtml(minutesRef.current) || meeting.notes || "";

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

  const runMinutesCommand = (command: string, value?: string) => {
    minutesRef.current?.focus();
    document.execCommand(command, false, value);
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
    const peopleById = new Map(
      (peopleResult.data || []).map((person: any) => [person.id, person])
    );

    setMeetingPeople(
      scopeRows
        .filter((row: any) => row.row_kind === "person")
        .map((row: any) => {
          const matchedPerson = peopleById.get(row.person_id) as any;

          return {
            id: row.id,
            person_id: row.person_id,
            status: row.status,
            people: {
              id: row.person_id,
              display_name: row.display_name,
              email: row.email,
              avatar_url: matchedPerson?.avatar_url || row.avatar_url || null,
            },
          };
        })
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

  const addMeetingPeopleSources = async () => {
    if (!meetingId || selectedMeetingPersonIds.length === 0) return;

    const results = await Promise.all(
      selectedMeetingPersonIds.map((personId) =>
        (supabase as any).rpc("add_meeting_individual_person", {
          p_meeting_id: meetingId,
          p_person_id: personId,
        })
      )
    );

    const firstError = results.find((result) => result.error)?.error;

    if (firstError) {
      toast.error(firstError.message);
      return;
    }

    const addedCount = selectedMeetingPersonIds.length;
    setSelectedMeetingPersonIds([]);
    toast.success(
      addedCount === 1
        ? "Person added to meeting"
        : `${addedCount} people added to meeting`
    );
    await loadMeetingPeopleSources();
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
        currentUserId: user.id,
        actorPersonId: currentPerson?.id || null,
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

  const updateMeetingLeadership = async (
    field: "chairperson_id" | "minute_taker_id",
    personId: string
  ) => {
    if (!meeting?.id) return;

    const { error } = await (supabase as any)
      .from("meetings")
      .update({
        [field]: personId || null,
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setMeeting({
      ...meeting,
      [field]: personId || null,
    });

    toast.success(field === "chairperson_id" ? "Chairperson updated" : "Minute taker updated");
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
          margin-top: 0.75rem;
          margin-bottom: 0.15rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: hsl(var(--foreground));
        }

        .minutes-section-heading:first-child {
          margin-top: 0;
        }

        .minutes-agenda-point {
          margin-top: 0.45rem;
          margin-bottom: 0.1rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .minutes-document .minutes-blank-line {
          min-height: 0.15rem;
          line-height: 0.15rem;
        }

        .minutes-document div {
          min-height: 1.4em;
        }

        .minutes-document h1 {
          margin: 0.35rem 0 0.2rem;
          font-size: 1.25rem;
          line-height: 1.4;
          font-weight: 800;
          color: hsl(var(--foreground));
        }

        .minutes-document h2 {
          margin: 0.3rem 0 0.15rem;
          font-size: 1.05rem;
          line-height: 1.45;
          font-weight: 800;
          color: hsl(var(--foreground));
        }

        .minutes-document b,
        .minutes-document strong {
          font-weight: 800;
          color: hsl(var(--foreground));
        }

        .minutes-document i,
        .minutes-document em {
          font-style: italic;
        }
      `}</style>

      <div className="w-full space-y-6 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-brand-teal" />
                  {formatDate(meeting.meeting_date)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-brand-teal" />
                  {meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : "No time"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-brand-teal" />
                  {meeting.location || "No location"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {hasOnlineMeetingTools && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
                    onClick={openGoogleMeet}
                    disabled={!(meeting?.google_meet_url || googleMeetUrlDraft).trim()}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Open Meet
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={copyGoogleMeetUrl}
                    disabled={!(meeting?.google_meet_url || googleMeetUrlDraft).trim()}
                    aria-label="Copy Google Meet link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              )}

              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setMeetingMenuOpen((current) => !current)}
                  aria-label="Meeting options"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>

                {meetingMenuOpen && (
                  <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
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
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/70 px-4 py-2 text-xs">
            <div className="inline-flex min-w-0 items-center gap-2">
              <span className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Chairperson:
              </span>
              <span className="truncate font-heading font-bold uppercase tracking-[0.16em] text-foreground">
                {chairpersonName}
              </span>
            </div>

            <div className="inline-flex min-w-0 items-center gap-2">
              <span className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Minutes:
              </span>
              <span className="truncate font-heading font-bold uppercase tracking-[0.16em] text-foreground">
                {minuteTakerName}
              </span>
            </div>

            <div className="ml-auto min-w-0">
              {currentUserMeetingPerson ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    You:
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant={currentUserMeetingStatus === "attended" ? "default" : "outline"}
                      size="sm"
                      className="h-6 rounded-md px-2 text-[11px]"
                      onClick={() => updateMeetingPersonStatus(currentUserMeetingPerson.person_id, "attended")}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant={currentUserMeetingStatus === "unavailable" ? "default" : "outline"}
                      size="sm"
                      className="h-6 rounded-md px-2 text-[11px]"
                      onClick={() => updateMeetingPersonStatus(currentUserMeetingPerson.person_id, "unavailable")}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2">
                  <span className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    People
                  </span>
                  <span className="font-semibold text-foreground">{meetingPeople.length} linked</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* LEFT COLUMN: Minutes + Action Points */}
          <div className="space-y-5">
            {/* Minutes Card */}
            <Card className="overflow-hidden border-border/70 bg-card shadow-card">
              <div className="border-b border-border/70 bg-muted/20 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-extrabold tracking-tight">Meeting Minutes</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
                      onClick={() => setMinutesToolbarOpen((open) => !open)}
                    >
                      {minutesToolbarOpen ? "Hide Format" : "Format"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
                      onClick={openAgendaModal}
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      Edit Agenda
                    </Button>
                    {TRANSCRIBER_ENABLED && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
                        onClick={() => setTranscriptOpen(true)}
                      >
                        <Mic className="h-4 w-4 mr-1.5" />
                        Transcription
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                {minutesToolbarOpen && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
                    title="Bold"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runMinutesCommand("bold")}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
                    title="Italic"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runMinutesCommand("italic")}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>

                  <div className="mx-1 h-5 w-px bg-border" />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
                    title="Heading 1"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runMinutesCommand("formatBlock", "h1")}
                  >
                    <Heading1 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
                    title="Heading 2"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runMinutesCommand("formatBlock", "h2")}
                  >
                    <Heading2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
                    title="Body text"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runMinutesCommand("formatBlock", "div")}
                  >
                    <Pilcrow className="h-4 w-4" />
                  </Button>

                  <select
                    className="ml-1 h-8 rounded-lg border border-border/70 bg-background px-2 text-xs font-semibold text-muted-foreground outline-none focus:border-brand-teal/40 focus:ring-2 focus:ring-brand-teal/15"
                    defaultValue=""
                    aria-label="Select minutes font"
                    onChange={(event) => {
                      if (!event.target.value) return;
                      runMinutesCommand("fontName", event.target.value);
                    }}
                  >
                    <option value="" disabled>
                      Font
                    </option>
                    <option value="Manrope">Manrope</option>
                    <option value="Inter Tight">Inter Tight</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Arial">Arial</option>
                    <option value="Courier New">Courier New</option>
                  </select>
                </div>
                )}

                <div
                  ref={minutesRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="minutes-document min-h-[26.25rem] h-[calc(100vh-25rem)] max-h-[58rem] overflow-y-auto cursor-text rounded-2xl border border-border/70 bg-background/70 p-5 text-sm leading-7 text-foreground outline-none transition focus:border-brand-teal/35 focus:bg-background focus:ring-2 focus:ring-brand-teal/15"
                  data-placeholder="Click here to add meeting notes, decisions, and minutes..."
                  dangerouslySetInnerHTML={{ __html: renderMinutesHtml(meeting.notes || "") }}
                  onKeyDown={(event) => {
                    const isModifier = event.metaKey || event.ctrlKey;
                    const key = event.key.toLowerCase();

                    if (isModifier && key === "z") {
                      event.preventDefault();
                      document.execCommand(event.shiftKey ? "redo" : "undo");
                    }

                    if (isModifier && key === "y") {
                      event.preventDefault();
                      document.execCommand("redo");
                    }
                  }}
                  onBlur={() => saveMinutes()}
                />
              </div>
            </Card>

          </div>

          {/* RIGHT COLUMN: People + Action Points */}
          <Card className="overflow-hidden border-border/70 bg-card shadow-card lg:min-h-[calc(100vh-18rem)]">
            <div className="border-b border-border/70 bg-card px-4 pt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-end gap-5">
                  <button
                    type="button"
                    className={`border-b-2 pb-2 text-sm font-extrabold transition ${
                      rightPanelTab === "people"
                        ? "border-brand-teal text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setRightPanelTab("people")}
                  >
                    Meeting People
                  </button>
                  <button
                    type="button"
                    className={`border-b-2 pb-2 text-sm font-extrabold transition ${
                      rightPanelTab === "actions"
                        ? "border-brand-teal text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setRightPanelTab("actions")}
                  >
                    Meeting Actions
                  </button>
                </div>

                {rightPanelTab === "people" && (
                  <div className="-mt-0.5 shrink-0 pb-2">
                    <MeetingPeopleHeaderActions
                      meetingPeopleCount={meetingPeople.length}
                      inviteRecipientsCount={inviteRecipients.length}
                      onInviteOpen={openInviteModal}
                      onOpenPeopleDialog={() => setPeopleOpen(true)}
                      onOpenMeetingPeopleDialog={() => setMeetingPeopleOpen(true)}
                    />
                  </div>
                )}
              </div>
            </div>

            {rightPanelTab === "people" ? (
              <MeetingPeopleSection
                meetingPeople={meetingPeople}
                currentUserMeetingPerson={currentUserMeetingPerson}
                currentUserMeetingStatus={currentUserMeetingStatus}
                inviteRecipients={inviteRecipients}
                inviteOpen={inviteOpen}
                inviteMessage={inviteMessage}
                chairpersonId={chairpersonId}
                minuteTakerId={minuteTakerId}
                onInviteOpen={openInviteModal}
                onInviteClose={() => setInviteOpen(false)}
                onInviteMessageChange={setInviteMessage}
                onSendInvites={sendMeetingInvites}
                onOpenPeopleDialog={() => setPeopleOpen(true)}
                onOpenMeetingPeopleDialog={() => setMeetingPeopleOpen(true)}
                onUpdateStatus={updateMeetingPersonStatus}
                onRemoveMeetingPerson={removeMeetingPersonFromMeeting}
                showHeaderActions={false}
              />
            ) : (
              <div>
                <div className="space-y-3 px-4 py-3">
                  <form onSubmit={addAction} className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-3">
                    <Input
                      value={actionTitle}
                      onChange={(event) => setActionTitle(event.target.value)}
                      placeholder="Action point..."
                      className="border-border/70 bg-card"
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

                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Input
                        type="date"
                        value={due}
                        onChange={(event) => setDue(event.target.value)}
                        className="border-border/70 bg-card"
                      />

                      <Button type="submit" className="actsix-btn-primary rounded-xl px-3">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>

                  <div className="max-h-[calc(100vh-32rem)] min-h-[18rem] space-y-2 overflow-y-auto pr-1">
                    {actions.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground">
                        No action points yet.
                      </div>
                    )}

                    {actions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3 transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold tracking-tight">{action.title}</div>
                          <div className="mt-1 text-xs font-medium text-muted-foreground">
                            {action.assignee || "Unassigned"}
                            {action.due ? ` · Due ${action.due}` : ""}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAction(action.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {TRANSCRIBER_ENABLED && transcriptOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-4xl max-h-[86vh] overflow-auto border-border/70 bg-card shadow-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <p className="label-eyebrow">Meeting Transcription</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  Upload Recording
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload an audio recording and transcribe it locally using the ACTSIX transcriber server.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setTranscriptOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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

                  <Button
                    type="button"
                    className="actsix-btn-primary rounded-xl mt-4 w-full"
                    onClick={transcribeAudio}
                    disabled={!transcriptFile || transcribing}
                  >
                    {transcribing ? "Transcribing..." : "Transcribe"}
                  </Button>
                </div>

                <div className="rounded-xl border border-border/70 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-start gap-3 mb-3">
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
                    className="w-full min-h-[240px] resize-y rounded-xl border border-border/70 bg-card p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background p-4">
                <div className="flex flex-wrap items-center justify-start gap-3 mb-3">
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
                  className="w-full min-h-[240px] resize-y rounded-xl border border-border/70 bg-card p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

              <div className="flex gap-2 justify-end pt-2">
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
              </div>
            </div>
          </Card>
        </div>
      )}

      <Dialog open={meetingPeopleOpen} onOpenChange={setMeetingPeopleOpen}>
        <DialogContent className="flex h-[88vh] max-w-6xl flex-col overflow-hidden rounded-2xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Edit People</DialogTitle>
            <DialogDescription>
              Add individuals, groups, or folders to define who belongs in this meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-6 pr-2">
<Card className="mb-4 border-border/70 bg-background/70 p-4 shadow-soft">
        <div className="mb-4">
          <p className="label-eyebrow">Meeting Leadership</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">
            Chairperson and minute taker
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select from the people already connected to this meeting.
          </p>
        </div>

        {meetingActionPeople.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Add people to this meeting before assigning a chairperson or minute taker.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <label className="label-eyebrow">Chairperson</label>
              <div className="mt-2">
                <MeetingSourceCombobox
                  value={chairpersonId}
                  onChange={(personId) => {
                    setChairpersonId(personId);
                    updateMeetingLeadership("chairperson_id", personId);
                  }}
                  options={meetingLeaderOptions}
                  placeholder="Select chairperson..."
                  searchPlaceholder="Search meeting people..."
                  emptyText="No meeting people found."
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <label className="label-eyebrow">Minute taker</label>
              <div className="mt-2">
                <MeetingSourceCombobox
                  value={minuteTakerId}
                  onChange={(personId) => {
                    setMinuteTakerId(personId);
                    updateMeetingLeadership("minute_taker_id", personId);
                  }}
                  options={meetingLeaderOptions}
                  placeholder="Select minute taker..."
                  searchPlaceholder="Search meeting people..."
                  emptyText="No meeting people found."
                />
              </div>
            </div>
          </div>
        )}
      </Card>

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
                  <PeopleMultiSearchSelect
                    people={peopleOptions}
                    selectedPersonIds={selectedMeetingPersonIds}
                    onChange={setSelectedMeetingPersonIds}
                    placeholder="Search by name, email, or phone..."
                    emptyText="No matching People profiles found."
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={addMeetingPeopleSources}
                  disabled={selectedMeetingPersonIds.length === 0}
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
            
                {(meetingGroupSources.length > 0 || meetingFolderSources.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Connected source pills">
                    {meetingGroupSources.map((source) => (
                      <Badge
                        key={`group-pill-${source.id}`}
                        variant="outline"
                        className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        Group: {source.people_groups?.name || "Unnamed group"}
                      </Badge>
                    ))}

                    {meetingFolderSources.map((source) => (
                      <Badge
                        key={`folder-pill-${source.id}`}
                        variant="outline"
                        className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        Folder: {source.people_group_folders?.name || "Unnamed folder"}
                      </Badge>
                    ))}
                  </div>
                )}
</div>
          </div>

          
        </Card>
          </div>
        </DialogContent>
      </Dialog>

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
