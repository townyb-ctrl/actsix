import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Clock3, Copy, MapPin, MoreHorizontal, Pencil, Plus, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createNotificationForPerson } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  getAgendaSeriesMeta,
  getRecurringSeriesIdFromAgenda,
  isSectionEmpty,
  type AgendaSeriesMeta,
  makeAgendaSection,
  parseAgendaPayload,
  serializeAgenda,
  type AgendaSection,
} from "@/features/meetings/lib/meetingAgenda";
import { hasMinutesContent } from "@/features/meetings/lib/meetingMinutes";
import type {
  ActionPointProposal,
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

const MeetingDetailPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [generatingMinutes, setGeneratingMinutes] = useState(false);
  const [generatedMinutes, setGeneratedMinutes] = useState("");
  const [actionProposals, setActionProposals] = useState<ActionPointProposal[]>([]);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [editDraft, setEditDraft] = useState<MeetingEditDraft>(EMPTY_MEETING);
  const [actions, setActions] = useState<MeetingAction[]>([]);
  const [expectedAttendees, setExpectedAttendees] = useState<string[]>([]);
  const [apologies, setApologies] = useState<string[]>([]);
  const [agendaSeriesMeta, setAgendaSeriesMeta] = useState<AgendaSeriesMeta>({});
  const [agendaSections, setAgendaSections] = useState<AgendaSection[]>([
    makeAgendaSection(),
  ]);
  const [agendaDraft, setAgendaDraft] = useState<AgendaSection[]>([
    makeAgendaSection(),
  ]);
  const [actionTitle, setActionTitle] = useState("");
  const [actionFormOpen, setActionFormOpen] = useState(false);
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
  const meetingMenuRef = useRef<HTMLDivElement | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Holds the minutes we *would* have written, when the meeting already has
  // minutes worth protecting. Non-null means the refill confirm is showing.
  const [pendingMinutesRefill, setPendingMinutesRefill] = useState<string | null>(null);
  const [minutesSavedAt, setMinutesSavedAt] = useState<Date | null>(null);
  const [minutesSaving, setMinutesSaving] = useState(false);

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
    setAgendaSeriesMeta(getAgendaSeriesMeta(meetingData.agenda));

    setMeeting(meetingData as Meeting);
    setEditDraft(meetingData);
    setChairpersonId(meetingData.chairperson_id || "");
    setMinuteTakerId(meetingData.minute_taker_id || "");
    setGoogleMeetUrlDraft(meetingData.google_meet_url || "");
    setExpectedAttendees(
      Array.isArray(meetingData.attendees) ? meetingData.attendees.filter(Boolean) : []
    );
    setApologies(agendaPayload.apologies ?? []);
    setAgendaSections(agendaPayload.sections);
    setActions((actionData ?? []) as MeetingAction[]);
    setTranscriptText(meetingData.transcript || "");
  };

  useEffect(() => {
    load();
  }, [user, meetingId]);

  // A recording in progress must not survive a route change - stop the mic
  // and the timer instead of leaking both.
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setAudioBlob(new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        setTranscriptFile(null);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch (error) {
      console.error(error);
      toast.error("Could not access the microphone. Check your browser's mic permission for this site.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);

    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const transcribeAudio = async () => {
    const audioSource = audioBlob || transcriptFile;

    if (!audioSource || !meetingId) {
      toast.error("Record or choose an audio file first.");
      return;
    }

    setTranscribing(true);

    try {
      const formData = new FormData();
      formData.append("meetingId", meetingId);
      formData.append("file", audioSource, transcriptFile?.name || `recording-${Date.now()}.webm`);

      const { data, error } = await supabase.functions.invoke("meeting-ai", { body: formData });
      if (error) throw error;

      setTranscriptText(data.transcript || "");
      setMeeting((prev) =>
        prev ? { ...prev, transcript: data.transcript || "", recording_path: data.recordingPath || prev.recording_path } : prev
      );
      toast.success("Transcript created");
    } catch (error) {
      console.error(error);
      toast.error(friendlyErrorMessage(error, "Could not transcribe audio."));
    } finally {
      setTranscribing(false);
    }
  };

  const generateMinutes = async () => {
    if (!transcriptText.trim() || !meetingId) {
      toast.error("There is no transcript to process yet.");
      return;
    }

    setGeneratingMinutes(true);

    try {
      const { data, error } = await supabase.functions.invoke("meeting-ai", {
        body: {
          action: "summarize",
          meetingId,
          transcript: transcriptText,
          meetingTitle: meeting?.title || "Meeting",
          people: meetingActionPeople.map((person) => ({ id: person.id, name: person.display_name })),
        },
      });
      if (error) throw error;

      setGeneratedMinutes(data.minutes || "");
      setActionProposals(
        (data.actionPoints || []).map((point: Record<string, string>) => ({
          id: crypto.randomUUID(),
          title: point.title || "",
          assigneePersonId: point.assignee_person_id || "",
          assigneeName: point.assignee_name || "",
          due: point.due || "",
        }))
      );
      toast.success("Minutes generated");
    } catch (error) {
      console.error(error);
      toast.error(friendlyErrorMessage(error, "Could not generate minutes from transcript."));
    } finally {
      setGeneratingMinutes(false);
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

    toast.success("Generated minutes merged into meeting minutes");
  };

  const updateActionProposal = (id: string, patch: Partial<ActionPointProposal>) => {
    setActionProposals((proposals) => proposals.map((proposal) => (proposal.id === id ? { ...proposal, ...patch } : proposal)));
  };

  const dismissActionProposal = (id: string) => {
    setActionProposals((proposals) => proposals.filter((proposal) => proposal.id !== id));
  };

  const confirmActionProposal = async (id: string) => {
    const proposal = actionProposals.find((item) => item.id === id);
    if (!proposal) return;

    const added = await insertMeetingAction(proposal.title, proposal.assigneePersonId, proposal.assigneeName, proposal.due);
    if (!added) return;

    setActionProposals((proposals) => proposals.filter((item) => item.id !== id));
    toast.success("Action point added");
    loadActions();
  };

  const confirmAllActionProposals = async () => {
    const proposals = actionProposals.filter((proposal) => proposal.title.trim());
    let addedCount = 0;

    for (const proposal of proposals) {
      const added = await insertMeetingAction(proposal.title, proposal.assigneePersonId, proposal.assigneeName, proposal.due);
      if (added) addedCount += 1;
    }

    setActionProposals([]);
    if (addedCount) toast.success(`${addedCount} action point${addedCount === 1 ? "" : "s"} added`);
    loadActions();
  };

  const saveMinutes = async (html: string) => {
    if (!meeting) return;

    const latestMinutes = html || meeting.notes || "";

    setMinutesSaving(true);

    const { error } = await supabase
      .from("meetings")
      .update({
        notes: latestMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    setMinutesSaving(false);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setMeeting({ ...meeting, notes: latestMinutes });
    setMinutesSavedAt(new Date());
  };

  /**
   * Saving the agenda used to write the generated minutes skeleton over
   * `notes` unconditionally, which silently destroyed minutes someone had
   * already written — fix a typo in the agenda after the meeting and the whole
   * record was gone. The agenda now always saves; refilling the minutes only
   * happens on its own, and only with permission once there is work at risk.
   */
  const saveAgenda = async () => {
    if (!meeting) return;

    const cleaned = cleanAgendaSections(agendaDraft);
    // cleanAgendaSections prunes any section left blank (no heading, no
    // points, no tag/subtitle) - silently, from its point of view. Count
    // what it dropped so the person saving finds out, instead of noticing
    // a section is just gone the next time they open the editor.
    const droppedCount = agendaDraft.filter(isSectionEmpty).length;
    const serialized = serializeAgenda(cleaned, apologies, agendaSeriesMeta);
    const generated = generateMinutesFromAgenda(cleaned);
    const minutesAtRisk = hasMinutesContent(meeting.notes);

    const { error } = await supabase
      .from("meetings")
      .update({
        agenda: serialized,
        ...(minutesAtRisk ? {} : { notes: generated }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", meeting.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setAgendaSections(cleaned);
    setMeeting({
      ...meeting,
      agenda: serialized,
      ...(minutesAtRisk ? {} : { notes: generated }),
    });
    setAgendaOpen(false);

    const droppedNote =
      droppedCount > 0 ? ` (${droppedCount} empty section${droppedCount === 1 ? "" : "s"} removed)` : "";

    if (minutesAtRisk) {
      toast.success(`Agenda saved. Your minutes were left as they are.${droppedNote}`);
      setPendingMinutesRefill(generated);
      return;
    }

    toast.success(`Agenda saved and minutes filled${droppedNote}`);
  };

  const confirmMinutesRefill = async () => {
    if (!meeting || pendingMinutesRefill === null) return;

    const generated = pendingMinutesRefill;
    setPendingMinutesRefill(null);

    const { error } = await supabase
      .from("meetings")
      .update({ notes: generated, updated_at: new Date().toISOString() })
      .eq("id", meeting.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setMeeting({ ...meeting, notes: generated });
    setMinutesSavedAt(new Date());
    toast.success("Minutes refilled from the agenda");
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

  /** Shared by the manual add form and the AI action-point review list. */
  const insertMeetingAction = async (
    title: string,
    assignedPersonId: string,
    assigneeName: string,
    dueDate: string
  ): Promise<boolean> => {
    if (!title.trim() || !user || !meeting) return false;

    const { error } = await supabase.from("meeting_actions").insert({
      id: crypto.randomUUID(),
      meeting_id: meeting.id,
      user_id: user.id,
      title: title.trim(),
      assignee: assigneeName.trim(),
      assigned_person_id: assignedPersonId || null,
      due: dueDate || null,
      linked_project: "",
      status: "Open",
    });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return false;
    }

    if (assignedPersonId) {
      await createNotificationForPerson({
        personId: assignedPersonId,
        currentUserId: user.id,
        actorPersonId: currentPerson?.id || null,
        title: "Meeting action point assigned",
        message: `You have been assigned: ${title.trim()}`,
        type: "assignment",
        entityType: "meeting_action",
        entityId: meeting.id,
      });
    }

    return true;
  };

  const addAction = async (event: React.FormEvent) => {
    event.preventDefault();

    const selectedActionPerson = meetingActionPeople.find(
      (person) => person.id === selectedActionPersonId
    );

    const added = await insertMeetingAction(
      actionTitle,
      selectedActionPersonId,
      selectedActionPerson?.display_name || assignee.trim(),
      due
    );
    if (!added) return;

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

  useEffect(() => {
    if (!meetingMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!meetingMenuRef.current?.contains(event.target as Node)) {
        setMeetingMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [meetingMenuOpen]);

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

      <div className="actsix-page-body actsix-page-stack">
        <section className="actsix-panel-soft overflow-visible">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-brand-teal" />
                  {formatDate(meeting.meeting_date)}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock3 className="h-3.5 w-3.5 text-brand-teal" />
                  {meeting.meeting_time ? meeting.meeting_time.slice(0, 5) : "No time"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
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
                    className="actsix-btn-primary h-9 rounded-lg"
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

              <div className="relative" ref={meetingMenuRef}>
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
                        setDeleteConfirmOpen(true);
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
                      className="h-11 rounded-md px-2 text-xs sm:h-6 sm:text-[11px]"
                      onClick={() => updateMeetingPersonStatus(currentUserMeetingPerson.person_id, "attended")}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant={currentUserMeetingStatus === "unavailable" ? "default" : "outline"}
                      size="sm"
                      className="h-11 rounded-md px-2 text-xs sm:h-6 sm:text-[11px]"
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
              onOpenTranscript={() => setTranscriptOpen(true)}
              onOpenAgenda={openAgendaModal}
              saving={minutesSaving}
              savedAt={minutesSavedAt}
            />
          </div>

          {/* RIGHT COLUMN: People and Action Points, both always visible -
              stacked, not tabbed. A tab hides whichever isn't selected;
              this sidebar's whole job is keeping both reachable without
              a click (see detail-page-layout-pattern). */}
          <div className="flex flex-col gap-4">
            <Card className="actsix-panel overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-background/55 px-4 py-3">
                <h2 className="pt-0.5 text-base font-extrabold tracking-tight">Meeting People</h2>
                <MeetingPeopleHeaderActions
                  meetingPeopleCount={meetingPeople.length}
                  inviteRecipientsCount={inviteRecipients.length}
                  onInviteOpen={openInviteModal}
                  onOpenPeopleDialog={() => setPeopleOpen(true)}
                  onOpenMeetingPeopleDialog={() => setMeetingPeopleOpen(true)}
                />
              </div>

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
                expectedAttendees={expectedAttendees}
                showHeaderActions={false}
              />
            </Card>

            <Card className="actsix-panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/55 px-4 py-3">
                <h2 className="text-base font-extrabold tracking-tight">Action Points</h2>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold uppercase">
                    {actions.length} {actions.length === 1 ? "item" : "items"}
                  </Badge>
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Add action point"
                    className="actsix-btn-primary h-7 w-7 rounded-lg"
                    onClick={() => setActionFormOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <MeetingActionsPanel
                actions={actions}
                meetingActionPeople={meetingActionPeople}
                formOpen={actionFormOpen}
                onFormOpenChange={setActionFormOpen}
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
            </Card>
          </div>
        </div>
      </div>

      <MeetingTranscriptionModal
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        isRecording={isRecording}
        recordingSeconds={recordingSeconds}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        hasAudioSource={Boolean(audioBlob || transcriptFile)}
        audioSourceLabel={audioBlob ? "Recording" : transcriptFile?.name || ""}
        onFileChange={(file) => {
          setTranscriptFile(file);
          setAudioBlob(null);
        }}
        transcribing={transcribing}
        onTranscribe={transcribeAudio}
        transcriptText={transcriptText}
        onTranscriptChange={setTranscriptText}
        generatingMinutes={generatingMinutes}
        onGenerateMinutes={generateMinutes}
        generatedMinutes={generatedMinutes}
        onCopyGeneratedNotes={copyGeneratedMinutesToMinutes}
        actionProposals={actionProposals}
        meetingActionPeople={meetingActionPeople}
        onUpdateProposal={updateActionProposal}
        onDismissProposal={dismissActionProposal}
        onConfirmProposal={confirmActionProposal}
        onConfirmAllProposals={confirmAllActionProposals}
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
        minutesAtRisk={hasMinutesContent(meeting?.notes)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete this meeting?"
        description={`"${meeting?.title ?? ""}" will be removed along with its minutes${
          actions.length > 0
            ? ` and ${actions.length} action point${actions.length === 1 ? "" : "s"}`
            : ""
        }. This cannot be undone.`}
        confirmLabel="Delete Meeting"
        onConfirm={deleteMeeting}
      />

      <ConfirmDialog
        open={pendingMinutesRefill !== null}
        onOpenChange={(open) => !open && setPendingMinutesRefill(null)}
        title="Replace the minutes you've written?"
        description="The agenda is already saved. Refilling replaces everything currently in the Minutes section with a fresh, empty outline from the agenda. Your existing minutes cannot be recovered."
        confirmLabel="Replace Minutes"
        onConfirm={confirmMinutesRefill}
      />
    </div>
  );
};

export default MeetingDetailPage;
