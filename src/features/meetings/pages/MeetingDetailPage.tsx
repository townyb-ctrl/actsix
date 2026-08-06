import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Clock3, Copy, MapPin, MoreHorizontal, Pencil, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createNotificationForPerson } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MeetingPeopleHeaderActions,
  MeetingPeopleSection,
  type MeetingPerson,
} from "@/features/meetings/components/MeetingPeopleSection";
import { MeetingTranscriptionModal } from "@/features/meetings/components/MeetingTranscriptionModal";
import { MeetingEditModal, type MeetingEditDraft } from "@/features/meetings/components/MeetingEditModal";
import { MeetingAgendaModal } from "@/features/meetings/components/MeetingAgendaModal";
import { MeetingAttendanceModal } from "@/features/meetings/components/MeetingAttendanceModal";
import { MeetingPeopleSourcesModal } from "@/features/meetings/components/MeetingPeopleSourcesModal";
import { MeetingActionsPanel } from "@/features/meetings/components/MeetingActionsPanel";
import { MeetingMinutesEditor } from "@/features/meetings/components/MeetingMinutesEditor";
import {
  cleanAgendaSections,
  formatDate,
  generateMinutesFromAgenda,
  getRecurringSeriesIdFromAgenda,
  makeAgendaSection,
  parseAgendaPayload,
  parseAttendees,
  serializeAgenda,
  type AgendaSection,
} from "@/features/meetings/lib/meetingAgenda";
import type {
  FolderOption,
  GroupOption,
  Meeting,
  MeetingAction,
  MeetingFolderSource,
  MeetingGroupSource,
  MeetingPersonProfile,
  PersonOption,
} from "@/features/meetings/lib/meetingTypes";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";

const EMPTY_MEETING: MeetingEditDraft = {
  title: "",
  meeting_date: null,
  meeting_time: null,
  location: "",
};

const TRANSCRIBER_ENABLED = import.meta.env.VITE_ACTSIX_TRANSCRIBER_ENABLED === "true";

const MeetingDetailPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [generatedMinutes, setGeneratedMinutes] = useState("");
  const [generatedActionPoints, setGeneratedActionPoints] = useState<string[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [editDraft, setEditDraft] = useState<MeetingEditDraft>(EMPTY_MEETING);
  const [actions, setActions] = useState<MeetingAction[]>([]);
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
  const [meetingPeopleOpen, setMeetingPeopleOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [chairpersonId, setChairpersonId] = useState("");
  const [minuteTakerId, setMinuteTakerId] = useState("");
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"people" | "actions">("people");

  const [meetingPeople, setMeetingPeople] = useState<MeetingPerson[]>([]);
  const [peopleOptions, setPeopleOptions] = useState<PersonOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [meetingGroupSources, setMeetingGroupSources] = useState<MeetingGroupSource[]>([]);
  const [meetingFolderSources, setMeetingFolderSources] = useState<MeetingFolderSource[]>([]);
  const [selectedMeetingPersonIds, setSelectedMeetingPersonIds] = useState<string[]>([]);
  const [selectedMeetingGroupId, setSelectedMeetingGroupId] = useState("");
  const [selectedMeetingFolderId, setSelectedMeetingFolderId] = useState("");
  const [selectedMeetingGroupFolderId, setSelectedMeetingGroupFolderId] = useState("");

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
      .filter(Boolean) as MeetingPersonProfile[];
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
    ) || null;
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
      toast.error(friendlyErrorMessage(firstError));
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
      toast.error(friendlyErrorMessage(meetingError));
      return;
    }

    const { data: actionData, error: actionError } = await supabase
      .from("meeting_actions")
      .select("*")
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: false });

    if (actionError) {
      toast.error(friendlyErrorMessage(actionError));
      return;
    }

    const agendaPayload = parseAgendaPayload(meetingData.agenda);

    setMeeting(meetingData as Meeting);
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
    setActions((actionData ?? []) as MeetingAction[]);
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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

  const saveMinutes = async (html: string) => {
    if (!meeting) return;

    const latestMinutes = html || meeting.notes || "";

    const { error } = await supabase
      .from("meetings")
      .update({
        notes: latestMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setMeeting({ ...meeting, notes: latestMinutes });
  };

  const saveAgenda = async () => {
    if (!meeting) return;

    const cleaned = cleanAgendaSections(agendaDraft);
    const generated = generateMinutesFromAgenda(cleaned);

    const { error } = await supabase
      .from("meetings")
      .update({
        agenda: serializeAgenda(cleaned, apologies),
        notes: generated,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setAgendaSections(cleaned);
    setMeeting({ ...meeting, agenda: serializeAgenda(cleaned, apologies), notes: generated });
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success("Meeting deleted");
    const seriesId = getRecurringSeriesIdFromAgenda(meeting?.agenda);
    navigate(seriesId ? `/meetings/recurring/${seriesId}` : "/meetings");
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
      toast.error(friendlyErrorMessage(firstError));
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
      toast.error(friendlyErrorMessage(firstError));
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setActions((data ?? []) as MeetingAction[]);
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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

  useEffect(() => {
    loadMeetingPeopleSources();
  }, [meetingId, user?.id, currentPerson?.workspace_id]);

  if (!meeting) {
    return (
      <div>
        <PageHeader eyebrow="Meetings" title="Meeting" subtitle="Loading meeting..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Meetings"
        title={meeting.title || "Meeting"}
        subtitle="Agenda, minutes, attendees, apologies, and action points."
      />

      <div className="w-full space-y-5 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <section className="actsix-panel-soft overflow-visible">
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
                  <div className="actsix-panel absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl">
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* LEFT COLUMN: Minutes + Action Points */}
          <div className="space-y-4">
            <MeetingMinutesEditor
              notes={meeting.notes}
              onSave={saveMinutes}
              transcriberEnabled={TRANSCRIBER_ENABLED}
              onOpenTranscript={() => setTranscriptOpen(true)}
              onOpenAgenda={openAgendaModal}
            />
          </div>

          {/* RIGHT COLUMN: People + Action Points */}
          <Card className="actsix-panel overflow-hidden lg:min-h-[calc(100vh-18rem)]">
            <div className="border-b border-border/70 bg-background/55 px-4 pt-3">
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
              <MeetingActionsPanel
                actions={actions}
                meetingActionPeople={meetingActionPeople}
                actionTitle={actionTitle}
                onActionTitleChange={setActionTitle}
                selectedActionPersonId={selectedActionPersonId}
                onSelectActionPerson={(personId) => {
                  setSelectedActionPersonId(personId);
                  const person = meetingActionPeople.find((option) => option.id === personId);
                  setAssignee(person?.display_name || "");
                }}
                due={due}
                onDueChange={setDue}
                onSubmit={addAction}
                onRemoveAction={removeAction}
              />
            )}
          </Card>
        </div>
      </div>

      <MeetingTranscriptionModal
        open={TRANSCRIBER_ENABLED && transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        transcriptFile={transcriptFile}
        onFileChange={setTranscriptFile}
        transcribing={transcribing}
        onTranscribe={transcribeAudio}
        transcriptText={transcriptText}
        onTranscriptChange={saveTranscript}
        generatedMinutes={generatedMinutes}
        onGeneratedMinutesChange={saveGeneratedMinutes}
        generatedActionPoints={generatedActionPoints}
        onClearGenerated={() => {
          saveGeneratedMinutes("");
          saveGeneratedActionPoints([]);
        }}
        processingTranscript={processingTranscript}
        onProcessTranscript={processTranscriptIntoMinutes}
        onCopyGeneratedNotes={copyGeneratedMinutesToMinutes}
      />

      <MeetingPeopleSourcesModal
        open={meetingPeopleOpen}
        onOpenChange={setMeetingPeopleOpen}
        meetingActionPeopleCount={meetingActionPeople.length}
        chairpersonId={chairpersonId}
        onChairpersonChange={(personId) => {
          setChairpersonId(personId);
          updateMeetingLeadership("chairperson_id", personId);
        }}
        minuteTakerId={minuteTakerId}
        onMinuteTakerChange={(personId) => {
          setMinuteTakerId(personId);
          updateMeetingLeadership("minute_taker_id", personId);
        }}
        meetingLeaderOptions={meetingLeaderOptions}
        meetingPeopleCount={meetingPeople.length}
        onOpenAttendance={() => {
          setMeetingPeopleOpen(false);
          setPeopleOpen(true);
        }}
        peopleOptions={peopleOptions}
        selectedMeetingPersonIds={selectedMeetingPersonIds}
        onSelectedMeetingPersonIdsChange={setSelectedMeetingPersonIds}
        onAddMeetingPeopleSources={addMeetingPeopleSources}
        selectedMeetingGroupFolderId={selectedMeetingGroupFolderId}
        onSelectedMeetingGroupFolderIdChange={setSelectedMeetingGroupFolderId}
        meetingGroupFolderOptions={meetingGroupFolderOptions}
        onAddMeetingGroupOrFolderSource={addMeetingGroupOrFolderSource}
        meetingGroupSources={meetingGroupSources}
        meetingFolderSources={meetingFolderSources}
      />

      <MeetingEditModal open={editOpen} onOpenChange={setEditOpen} draft={editDraft} onChange={setEditDraft} onSave={saveMeetingDetails} />

      <MeetingAttendanceModal
        open={peopleOpen}
        onOpenChange={setPeopleOpen}
        meetingPeople={meetingPeople}
        onUpdateStatus={updateMeetingPersonStatus}
      />

      <MeetingAgendaModal
        open={agendaOpen}
        onOpenChange={setAgendaOpen}
        draft={agendaDraft}
        onChange={setAgendaDraft}
        onSave={saveAgenda}
      />
    </div>
  );
};

export default MeetingDetailPage;
