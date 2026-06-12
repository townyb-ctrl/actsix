import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DollarSign,
  Edit3,
  MapPin,
  Plane,
  Plus,
  Search,
  Tent,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type EventStatus = "Planning" | "Open" | "Final Prep" | "Complete";
type EventType = "Camp" | "Mission Trip" | "Retreat" | "Outreach" | "Conference";
type RegistrationStatus = "Interested" | "Registered" | "Confirmed" | "Cancelled";

type EventPerson = {
  id: string;
  display_name: string;
  email?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
};

type EventRegistration = {
  id: string;
  personId: string;
  status: RegistrationStatus;
  amountDue: number;
  amountPaid: number;
  medicalFormReceived: boolean;
  consentFormReceived: boolean;
  transportNeeded: boolean;
  emergencyContact: string;
  notes: string;
  person?: EventPerson | null;
};

type EventCollaborator = {
  id: string;
  personId: string;
  role: string;
  person?: EventPerson | null;
};

type EventLogisticsItem = {
  id: string;
  label: string;
  status: "Open" | "In Progress" | "Done";
  notes: string;
  assigneePersonId?: string | null;
  assignee?: EventPerson | null;
};

type EventExpense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  spentAt: string;
  paidByPersonId?: string | null;
  paidBy?: EventPerson | null;
  notes: string;
};

type EventItem = {
  id: string;
  workspaceId: string;
  title: string;
  type: EventType;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  location: string;
  owner: string;
  budget: number;
  received: number;
  costPerPerson: number;
  capacity: number;
  registered: number;
  notes: string;
  checklist: Array<{ id: string; label: string; done: boolean }>;
  team: Array<{ role: string; name: string }>;
  logistics: EventLogisticsItem[];
  registrations: EventRegistration[];
  collaborators: EventCollaborator[];
  expenses: EventExpense[];
};

type EventForm = Pick<
  EventItem,
  "title" | "type" | "status" | "startsAt" | "endsAt" | "location" | "owner" | "budget" | "received" | "costPerPerson" | "capacity" | "registered" | "notes"
>;

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): EventForm => ({
  title: "",
  type: "Camp",
  status: "Planning",
  startsAt: todayIso(),
  endsAt: todayIso(),
  location: "",
  owner: "",
  budget: 0,
  received: 0,
  costPerPerson: 0,
  capacity: 0,
  registered: 0,
  notes: "",
});

const statusStyles: Record<EventStatus, string> = {
  Planning: "border-brand-amber/25 bg-brand-amber/10 text-brand-amber",
  Open: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
  "Final Prep": "border-primary/20 bg-primary/10 text-primary",
  Complete: "border-brand-sage/25 bg-brand-sage/10 text-brand-sage",
};

const registrationStatusStyles: Record<RegistrationStatus, string> = {
  Interested: "border-brand-amber/25 bg-brand-amber/10 text-brand-amber",
  Registered: "border-brand-teal/25 bg-brand-teal/10 text-brand-teal",
  Confirmed: "border-brand-sage/25 bg-brand-sage/10 text-brand-sage",
  Cancelled: "border-destructive/25 bg-destructive/10 text-destructive",
};

const money = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const percent = (value: number, total: number) => {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
};

export default function EventManagement() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace, role } = useCurrentWorkspace();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EventStatus>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [people, setPeople] = useState<EventPerson[]>([]);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [collaboratorOpen, setCollaboratorOpen] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [participantStatus, setParticipantStatus] = useState<RegistrationStatus>("Registered");
  const [participantAmountDue, setParticipantAmountDue] = useState(0);
  const [collaboratorRole, setCollaboratorRole] = useState("Collaborator");
  const [logisticsLabel, setLogisticsLabel] = useState("");
  const [logisticsAssigneeId, setLogisticsAssigneeId] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("General");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [expensePaidById, setExpensePaidById] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManageEvents = ["admin", "editor", "group_leader"].includes(role || "");

  const loadEvents = async () => {
    if (!workspace?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      eventResult,
      checklistResult,
      teamResult,
      logisticsResult,
      registrationResult,
      collaboratorResult,
      expenseResult,
      peopleResult,
    ] = await Promise.all([
      (supabase as any)
        .from("events")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("starts_at", { ascending: true }),
      (supabase as any)
        .from("event_checklist_items")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("sort_order", { ascending: true }),
      (supabase as any)
        .from("event_team_roles")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("sort_order", { ascending: true }),
      (supabase as any)
        .from("event_logistics_items")
        .select("*, assignee:people(id, display_name, email, phone_number, avatar_url)")
        .eq("workspace_id", workspace.id)
        .order("sort_order", { ascending: true }),
      (supabase as any)
        .from("event_registrations")
        .select("*, people(id, display_name, email, phone_number, avatar_url)")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("event_collaborators")
        .select("*, people(id, display_name, email, phone_number, avatar_url)")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("event_expenses")
        .select("*, paid_by:people(id, display_name, email, phone_number, avatar_url)")
        .eq("workspace_id", workspace.id)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("people")
        .select("id, display_name, email, phone_number, avatar_url")
        .eq("workspace_id", workspace.id)
        .order("display_name", { ascending: true }),
    ]);

    setLoading(false);

    const migrationMissing =
      eventResult.error?.code === "42P01" ||
      checklistResult.error?.code === "42P01" ||
      teamResult.error?.code === "42P01" ||
      logisticsResult.error?.code === "42P01" ||
      registrationResult.error?.code === "42P01" ||
      collaboratorResult.error?.code === "42P01" ||
      expenseResult.error?.code === "42P01";

    if (migrationMissing) {
      toast.error("Apply the event management migration in Supabase, then reload Events.");
      setEvents([]);
      return;
    }

    if (eventResult.error) toast.error(eventResult.error.message);
    if (checklistResult.error) toast.error(checklistResult.error.message);
    if (teamResult.error) toast.error(teamResult.error.message);
    if (logisticsResult.error) toast.error(logisticsResult.error.message);
    if (registrationResult.error) toast.error(registrationResult.error.message);
    if (collaboratorResult.error) toast.error(collaboratorResult.error.message);
    if (expenseResult.error) toast.error(expenseResult.error.message);
    if (peopleResult.error) toast.error(peopleResult.error.message);

    const checklistByEvent = (checklistResult.data || []).reduce<Record<string, EventItem["checklist"]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({ id: item.id, label: item.label, done: item.done });
      return acc;
    }, {});

    const teamByEvent = (teamResult.data || []).reduce<Record<string, EventItem["team"]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({ role: item.role, name: item.name });
      return acc;
    }, {});

    const logisticsByEvent = (logisticsResult.data || []).reduce<Record<string, EventLogisticsItem[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        label: item.label,
        status: item.status || "Open",
        notes: item.notes || "",
        assigneePersonId: item.assignee_person_id,
        assignee: item.assignee,
      });
      return acc;
    }, {});

    const registrationsByEvent = (registrationResult.data || []).reduce<Record<string, EventRegistration[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        personId: item.person_id,
        status: item.status,
        amountDue: Number(item.amount_due || 0),
        amountPaid: Number(item.amount_paid || 0),
        medicalFormReceived: item.medical_form_received,
        consentFormReceived: item.consent_form_received,
        transportNeeded: item.transport_needed,
        emergencyContact: item.emergency_contact,
        notes: item.notes,
        person: item.people,
      });
      return acc;
    }, {});

    const collaboratorsByEvent = (collaboratorResult.data || []).reduce<Record<string, EventCollaborator[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        personId: item.person_id,
        role: item.role,
        person: item.people,
      });
      return acc;
    }, {});

    const expensesByEvent = (expenseResult.data || []).reduce<Record<string, EventExpense[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        title: item.title,
        category: item.category,
        amount: Number(item.amount || 0),
        spentAt: item.spent_at,
        paidByPersonId: item.paid_by_person_id,
        paidBy: item.paid_by,
        notes: item.notes || "",
      });
      return acc;
    }, {});

    const nextEvents: EventItem[] = (eventResult.data || []).map((event: any) => ({
      id: event.id,
      workspaceId: event.workspace_id,
      title: event.title,
      type: event.type,
      status: event.status,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: event.location,
      owner: event.owner,
      budget: Number(event.budget || 0),
      received: Number(event.received || 0),
      costPerPerson: Number(event.cost_per_person || 0),
      capacity: Number(event.capacity || 0),
      registered: Number(event.registered || 0),
      notes: event.notes,
      checklist: checklistByEvent[event.id] || [],
      team: teamByEvent[event.id] || [],
      logistics: logisticsByEvent[event.id] || [],
      registrations: registrationsByEvent[event.id] || [],
      collaborators: collaboratorsByEvent[event.id] || [],
      expenses: expensesByEvent[event.id] || [],
    }));

    setPeople(peopleResult.data || []);
    setEvents(nextEvents);
    setSelectedId((current) =>
      eventId && nextEvents.some((event) => event.id === eventId)
        ? eventId
        : current && nextEvents.some((event) => event.id === current)
          ? current
          : nextEvents[0]?.id || ""
    );
  };

  useEffect(() => {
    loadEvents();
  }, [workspace?.id, eventId]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        [event.title, event.type, event.location, event.owner, event.notes]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = statusFilter === "All" || event.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [events, query, statusFilter]);

  const selectedEvent = events.find((event) => event.id === (eventId || selectedId)) || filteredEvents[0] || events[0];

  const stats = useMemo(() => {
    const active = events.filter((event) => event.status !== "Complete").length;
    const registrations = events.reduce((sum, event) => sum + event.registrations.length, 0);
    const budget = events.reduce((sum, event) => sum + event.budget, 0);
    const received = events.reduce((sum, event) => sum + event.received, 0);
    return { active, registrations, budget, received };
  }, [events]);

  const availableParticipantPeople = useMemo(() => {
    const existingIds = new Set(selectedEvent?.registrations.map((registration) => registration.personId) || []);
    return people.filter((person) => !existingIds.has(person.id));
  }, [people, selectedEvent?.registrations]);

  const availableCollaboratorPeople = useMemo(() => {
    const existingIds = new Set(selectedEvent?.collaborators.map((collaborator) => collaborator.personId) || []);
    return people.filter((person) => !existingIds.has(person.id));
  }, [people, selectedEvent?.collaborators]);

  const collaboratorPeople = useMemo(() => {
    return selectedEvent?.collaborators.map((collaborator) => collaborator.person).filter(Boolean) as EventPerson[] || [];
  }, [selectedEvent?.collaborators]);

  const selectedEventSpent = selectedEvent?.expenses.reduce((sum, expense) => sum + expense.amount, 0) || 0;
  const selectedEventExpectedParticipantRevenue = selectedEvent
    ? selectedEvent.costPerPerson * selectedEvent.registrations.length
    : 0;
  const selectedEventBudgetRemaining = selectedEvent ? selectedEvent.budget - selectedEventSpent : 0;
  const selectedEventOutstandingBalance = selectedEvent
    ? selectedEvent.registrations.reduce(
        (sum, registration) => sum + Math.max(0, registration.amountDue - registration.amountPaid),
        0
      )
    : 0;
  const selectedEventConfirmedCount =
    selectedEvent?.registrations.filter((registration) => registration.status === "Confirmed").length || 0;
  const selectedEventMissingForms =
    selectedEvent?.registrations.filter(
      (registration) => !registration.medicalFormReceived || !registration.consentFormReceived
    ).length || 0;

  const openNewEvent = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const editEvent = (event: EventItem) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      type: event.type,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      owner: event.owner,
      budget: event.budget,
      received: event.received,
      costPerPerson: event.costPerPerson,
      capacity: event.capacity,
      registered: event.registered,
      notes: event.notes,
    });
    setFormOpen(true);
  };

  const saveEvent = async () => {
    if (!workspace?.id || !user?.id) return;
    if (!canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Give the event a title first.");
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      starts_at: form.startsAt,
      ends_at: form.endsAt,
      location: form.location.trim(),
      owner: form.owner.trim(),
      budget: Number(form.budget) || 0,
      received: Number(form.received) || 0,
      cost_per_person: Number(form.costPerPerson) || 0,
      capacity: Number(form.capacity) || 0,
      registered: Number(form.registered) || 0,
      notes: form.notes.trim(),
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await (supabase as any)
        .from("events")
        .update(payload)
        .eq("id", editingId)
        .eq("workspace_id", workspace.id);

      setSaving(false);

      if (error) {
        toast.error(error.message);
        return;
      }

      await loadEvents();
      toast.success("Event updated");
      setEditingId(null);
      setFormOpen(false);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("events")
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        ...payload,
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      if (error.code === "42P01" || error.message.includes("events")) {
        toast.error("Apply the event management migration in Supabase, then save again.");
        return;
      }
      toast.error(error.message);
      return;
    }

    const createdEventId = data?.id;
    if (createdEventId) {
      await Promise.all([
        (supabase as any).from("event_checklist_items").insert(
          ["Confirm dates and venue", "Assign planning owner", "Create communication plan"].map((label, index) => ({
            workspace_id: workspace.id,
            event_id: createdEventId,
            label,
            sort_order: index,
          }))
        ),
        form.owner.trim()
          ? (supabase as any).from("event_team_roles").insert({
              workspace_id: workspace.id,
              event_id: createdEventId,
              role: "Event Lead",
              name: form.owner.trim(),
              sort_order: 0,
            })
          : Promise.resolve({ error: null }),
        (supabase as any).from("event_logistics_items").insert(
          ["Venue", "Transport", "Food", "Communication"].map((label, index) => ({
            workspace_id: workspace.id,
            event_id: createdEventId,
            label,
            sort_order: index,
          }))
        ),
      ]);
      setSelectedId(createdEventId);
    }

    setSaving(false);
    await loadEvents();
    if (createdEventId) {
      setSelectedId(createdEventId);
      setFormOpen(false);
      navigate(`/events/${createdEventId}`);
    }
    toast.success("Event added");
  };

  const deleteEvent = async (eventId: string) => {
    if (!workspace?.id || !canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const { error } = await (supabase as any)
      .from("events")
      .delete()
      .eq("id", eventId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
    if (eventId) navigate("/events");
    toast.success("Event removed");
  };

  const addParticipants = async () => {
    if (!workspace?.id || !selectedEvent || selectedParticipantIds.length === 0) return;
    if (!canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const { error } = await (supabase as any).from("event_registrations").insert(
      selectedParticipantIds.map((personId) => ({
        workspace_id: workspace.id,
        event_id: selectedEvent.id,
        person_id: personId,
        status: participantStatus,
        amount_due: Number(participantAmountDue) || 0,
      }))
    );

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedParticipantIds([]);
    setParticipantAmountDue(0);
    setParticipantOpen(false);
    await loadEvents();
    toast.success("Participant added");
  };

  const addCollaborators = async () => {
    if (!workspace?.id || !selectedEvent || selectedCollaboratorIds.length === 0) return;
    if (!canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const { error } = await (supabase as any).from("event_collaborators").insert(
      selectedCollaboratorIds.map((personId) => ({
        workspace_id: workspace.id,
        event_id: selectedEvent.id,
        person_id: personId,
        role: collaboratorRole.trim() || "Collaborator",
      }))
    );

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedCollaboratorIds([]);
    setCollaboratorRole("Collaborator");
    setCollaboratorOpen(false);
    await loadEvents();
    toast.success("Collaborator added");
  };

  const removeRegistration = async (registrationId: string) => {
    if (!workspace?.id || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_registrations")
      .delete()
      .eq("id", registrationId)
      .eq("workspace_id", workspace.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadEvents();
  };

  const removeCollaborator = async (collaboratorId: string) => {
    if (!workspace?.id || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_collaborators")
      .delete()
      .eq("id", collaboratorId)
      .eq("workspace_id", workspace.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadEvents();
  };

  const updateRegistration = async (registrationId: string, updates: Record<string, string | number | boolean>) => {
    if (!workspace?.id || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_registrations")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", registrationId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
  };

  const addLogisticsItem = async () => {
    if (!workspace?.id || !selectedEvent || !logisticsLabel.trim()) return;
    if (!canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const { error } = await (supabase as any).from("event_logistics_items").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      label: logisticsLabel.trim(),
      assignee_person_id: logisticsAssigneeId || null,
      sort_order: selectedEvent.logistics.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setLogisticsLabel("");
    setLogisticsAssigneeId("");
    await loadEvents();
  };

  const updateLogisticsItem = async (itemId: string, updates: Record<string, string | null>) => {
    if (!workspace?.id || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_logistics_items")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
  };

  const deleteLogisticsItem = async (itemId: string) => {
    if (!workspace?.id || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_logistics_items")
      .delete()
      .eq("id", itemId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
  };

  const addExpense = async () => {
    if (!workspace?.id || !selectedEvent || !expenseTitle.trim()) return;
    if (!canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const { error } = await (supabase as any).from("event_expenses").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      title: expenseTitle.trim(),
      category: expenseCategory.trim() || "General",
      amount: Number(expenseAmount) || 0,
      paid_by_person_id: expensePaidById || null,
      notes: expenseNotes.trim(),
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setExpenseTitle("");
    setExpenseCategory("General");
    setExpenseAmount(0);
    setExpensePaidById("");
    setExpenseNotes("");
    await loadEvents();
    toast.success("Expense added");
  };

  const deleteExpense = async (expenseId: string) => {
    if (!workspace?.id || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_expenses")
      .delete()
      .eq("id", expenseId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
  };

  const toggleChecklist = async (eventId: string, itemId: string) => {
    if (!workspace?.id || !canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const event = events.find((item) => item.id === eventId);
    const checklistItem = event?.checklist.find((item) => item.id === itemId);
    if (!checklistItem) return;

    setEvents((current) =>
      current.map((item) =>
        item.id === eventId
          ? {
              ...item,
              checklist: item.checklist.map((check) =>
                check.id === itemId ? { ...check, done: !check.done } : check
              ),
            }
          : item
      )
    );

    const { error } = await (supabase as any)
      .from("event_checklist_items")
      .update({ done: !checklistItem.done, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      await loadEvents();
    }
  };

  const readiness = selectedEvent
    ? percent(selectedEvent.checklist.filter((item) => item.done).length, selectedEvent.checklist.length)
    : 0;

  const statusOptions: Array<"All" | EventStatus> = ["All", "Planning", "Open", "Final Prep", "Complete"];

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title={eventId && selectedEvent ? selectedEvent.title : "Events Management"}
        subtitle={
          eventId && selectedEvent
            ? `${selectedEvent.type} · ${selectedEvent.startsAt} to ${selectedEvent.endsAt}`
            : "Plan church camps, mission trips, retreats, outreaches, and major ministry events."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!eventId && (
              <div className="actsix-search-field sm:w-48 lg:w-56">
                <Search className="actsix-search-icon" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search events..."
                  className="actsix-search-input"
                />
              </div>
            )}
            <Button
              type="button"
              className="actsix-btn-primary h-8 rounded-full px-3 text-xs"
              onClick={openNewEvent}
              disabled={!canManageEvents}
            >
              <Plus className="h-3.5 w-3.5" />
              New Event
            </Button>
          </div>
        }
      />

      <div className="actsix-page-body actsix-page-stack pb-12">
        <div className="actsix-filter-pills">
          {statusOptions.map((status) => {
            const active = statusFilter === status;
            const count = status === "All" ? events.length : events.filter((event) => event.status === status).length;

            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "actsix-filter-pill",
                  active
                    ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                    : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:bg-brand-teal/5 hover:text-brand-teal"
                )}
              >
                {status}
                <span className={cn("actsix-filter-pill-count", active ? "bg-brand-teal/15" : "bg-muted")}>{count}</span>
              </button>
            );
          })}
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Tent} label="Active Events" value={stats.active} />
          <Metric icon={Users} label="Registrations" value={stats.registrations} />
          <Metric icon={DollarSign} label="Received" value={money(stats.received)} />
          <Metric icon={ClipboardCheck} label="Budget" value={money(stats.budget)} />
        </section>

        <section className={cn("grid gap-4", eventId ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]")}>
          <div className={cn("space-y-2", eventId && "hidden")}>
            {loading && (
              <Card className="actsix-loading-state p-4 text-sm font-semibold" role="status">
                Loading events...
              </Card>
            )}

            {!loading && filteredEvents.length === 0 && (
              <Card className="actsix-panel-soft p-4 text-sm font-semibold text-muted-foreground">
                {events.length === 0
                  ? "No events yet. Create a camp, mission trip, retreat, outreach, or conference."
                  : "No events match this view."}
              </Card>
            )}

            {!loading && filteredEvents.map((event) => {
              const active = selectedEvent?.id === event.id;
              const eventReadiness = percent(event.checklist.filter((item) => item.done).length, event.checklist.length);
              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className={cn(
                    "block w-full rounded-xl border p-3 text-left transition",
                    active
                      ? "border-brand-teal/35 bg-brand-teal/5"
                      : "border-border/70 bg-card hover:border-brand-teal/25 hover:bg-brand-teal/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-extrabold">{event.title}</h2>
                      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location || "Location needed"}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("rounded-full text-[10px] font-bold", statusStyles[event.status])}>
                      {event.status}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {event.startsAt}
                    </span>
                    <span>{event.registrations.length}/{event.capacity || 0} registered</span>
                    <span>{eventReadiness}% ready</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="space-y-4">
            {selectedEvent && (
              <Card className="actsix-panel overflow-hidden border-border/60">
                <div className="border-b border-border/70 p-3 sm:p-4">
                  {eventId && (
                    <Button asChild variant="ghost" className="mb-3 h-8 px-0 text-muted-foreground hover:bg-transparent hover:text-brand-teal">
                      <Link to="/events">Back to events</Link>
                    </Button>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-extrabold">{selectedEvent.title}</h2>
                        <Badge variant="outline" className={cn("rounded-full text-[10px] font-bold", statusStyles[selectedEvent.status])}>
                          {selectedEvent.status}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-muted-foreground">{selectedEvent.notes}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => editEvent(selectedEvent)}
                        disabled={!canManageEvents}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => deleteEvent(selectedEvent.id)}
                        disabled={!canManageEvents}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Info icon={CalendarDays} label="Dates" value={`${selectedEvent.startsAt} to ${selectedEvent.endsAt}`} />
                    <Info icon={MapPin} label="Location" value={selectedEvent.location || "Not set"} />
                    <Info icon={Users} label="Registration" value={`${selectedEvent.registrations.length}/${selectedEvent.capacity || 0}`} />
                    <Info icon={DollarSign} label="Cost / Person" value={money(selectedEvent.costPerPerson)} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex -space-x-2">
                        {selectedEvent.collaborators.slice(0, 6).map((collaborator) => (
                          <PersonAvatar
                            key={collaborator.id}
                            name={collaborator.person?.display_name}
                            avatarUrl={collaborator.person?.avatar_url}
                            size="xs"
                            className="border border-background ring-1 ring-border"
                          />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">
                        {selectedEvent.collaborators.length === 0
                          ? "No collaborators yet"
                          : `${selectedEvent.collaborators.length} collaborator${selectedEvent.collaborators.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 rounded-full px-2 text-xs"
                      onClick={() => setCollaboratorOpen(true)}
                      disabled={!canManageEvents}
                    >
                      <Plus className="h-3 w-3" />
                      Add Collaborator
                    </Button>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs font-bold">
                      <span>Readiness</span>
                      <span>{readiness}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-teal" style={{ width: `${readiness}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[0.85fr_0.85fr_1.3fr]">
                  <section className="border-b border-border/70 p-3 lg:border-b-0 lg:border-r">
                    <p className="label-eyebrow">Planning Checklist</p>
                    <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {selectedEvent.checklist.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleChecklist(selectedEvent.id, item.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition hover:bg-brand-teal/5"
                        >
                          <CheckCircle2 className={cn("h-4 w-4", item.done ? "text-brand-teal" : "text-muted-foreground/50")} />
                          <span className={cn(item.done && "text-muted-foreground line-through")}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="border-b border-border/70 p-3 lg:border-b-0 lg:border-r">
                    <p className="label-eyebrow">Team</p>
                    <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {selectedEvent.team.map((member) => (
                        <div key={`${member.role}-${member.name}`} className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-sm">
                          <span className="font-bold">{member.role}</span>
                          <span className="truncate text-muted-foreground">{member.name}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="label-eyebrow">Logistics</p>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {selectedEvent.logistics.filter((item) => item.status === "Done").length}/{selectedEvent.logistics.length} done
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <Input
                        value={logisticsLabel}
                        onChange={(event) => setLogisticsLabel(event.target.value)}
                        placeholder="Add logistics item..."
                        className="h-8 rounded-xl bg-background text-xs"
                        disabled={!canManageEvents}
                      />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <select
                          value={logisticsAssigneeId}
                          onChange={(event) => setLogisticsAssigneeId(event.target.value)}
                          className="h-8 rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none"
                          disabled={!canManageEvents}
                        >
                          <option value="">No assignee</option>
                          {collaboratorPeople.map((person) => (
                            <option key={person.id} value={person.id}>{person.display_name}</option>
                          ))}
                        </select>
                        <Button type="button" className="actsix-btn-primary h-8 rounded-xl text-xs" onClick={addLogisticsItem} disabled={!canManageEvents || !logisticsLabel.trim()}>
                          Add
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {selectedEvent.logistics.map((item) => (
                        <div key={item.id} className="rounded-lg bg-background/60 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-brand-teal" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">{item.label}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive"
                              onClick={() => deleteLogisticsItem(item.id)}
                              disabled={!canManageEvents}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                            <select
                              value={item.status}
                              onChange={(event) => updateLogisticsItem(item.id, { status: event.target.value })}
                              className="h-7 rounded-full border border-border/70 bg-card px-2 text-[11px] font-bold outline-none"
                              disabled={!canManageEvents}
                            >
                              <option>Open</option>
                              <option>In Progress</option>
                              <option>Done</option>
                            </select>
                            <select
                              value={item.assigneePersonId || ""}
                              onChange={(event) => updateLogisticsItem(item.id, { assignee_person_id: event.target.value || null })}
                              className="h-7 rounded-full border border-border/70 bg-card px-2 text-[11px] font-bold outline-none"
                              disabled={!canManageEvents}
                            >
                              <option value="">No assignee</option>
                              {collaboratorPeople.map((person) => (
                                <option key={person.id} value={person.id}>{person.display_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-0 border-t border-border/70 xl:grid-cols-[0.95fr_1.25fr_0.8fr]">
                <section className="p-3 xl:border-r xl:border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="label-eyebrow">Budget & Spending</p>
                      <h3 className="mt-1 text-base font-extrabold">
                        {money(selectedEventSpent)} spent of {money(selectedEvent.budget)}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn("rounded-full border px-2 py-1 text-[11px] font-bold", selectedEventBudgetRemaining >= 0 ? "border-brand-sage/25 bg-brand-sage/10 text-brand-sage" : "border-destructive/25 bg-destructive/10 text-destructive")}>
                        Remaining {money(selectedEventBudgetRemaining)}
                      </span>
                      <span className="rounded-full border border-brand-teal/25 bg-brand-teal/10 px-2 py-1 text-[11px] font-bold text-brand-teal">
                        Participant potential {money(selectedEventExpectedParticipantRevenue)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Input value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} placeholder="Expense title" className="h-8 rounded-xl bg-background text-xs" disabled={!canManageEvents} />
                    <Input value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} placeholder="Category" className="h-8 rounded-xl bg-background text-xs" disabled={!canManageEvents} />
                    <Input type="number" value={expenseAmount} onChange={(event) => setExpenseAmount(Number(event.target.value))} placeholder="Amount" className="h-8 rounded-xl bg-background text-xs" disabled={!canManageEvents} />
                    <select value={expensePaidById} onChange={(event) => setExpensePaidById(event.target.value)} className="h-8 rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none" disabled={!canManageEvents}>
                      <option value="">Paid by</option>
                      {collaboratorPeople.map((person) => (
                        <option key={person.id} value={person.id}>{person.display_name}</option>
                      ))}
                    </select>
                    <Button type="button" className="actsix-btn-primary h-8 rounded-xl text-xs" onClick={addExpense} disabled={!canManageEvents || !expenseTitle.trim()}>
                      Add
                    </Button>
                  </div>
                  <Input value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} placeholder="Expense notes..." className="mt-2 h-8 rounded-xl bg-background text-xs" disabled={!canManageEvents} />

                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                    {selectedEvent.expenses.length === 0 && (
                      <div className="actsix-empty-state min-h-20 text-left text-sm">
                        Add expenses to track event spending against the overall budget.
                      </div>
                    )}
                    {selectedEvent.expenses.map((expense) => (
                      <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/55 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{expense.title}</p>
                          <p className="truncate text-xs font-medium text-muted-foreground">
                            {expense.category} · {expense.spentAt}{expense.paidBy?.display_name ? ` · Paid by ${expense.paidBy.display_name}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold">{money(expense.amount)}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={() => deleteExpense(expense.id)} disabled={!canManageEvents}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border-t border-border/70 p-3 xl:border-t-0 xl:border-r">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="label-eyebrow">Participants</p>
                      <h3 className="mt-1 text-base font-extrabold">
                        {selectedEvent.registrations.length} registered
                      </h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => setParticipantOpen(true)}
                      disabled={!canManageEvents}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Participants
                    </Button>
                  </div>

                  <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                    {selectedEvent.registrations.length === 0 && (
                      <div className="actsix-empty-state min-h-20 text-left text-sm">
                        Add participants from People to track registration status, payment, forms, and transport.
                      </div>
                    )}

                    {selectedEvent.registrations.map((registration) => {
                      const balance = Math.max(0, registration.amountDue - registration.amountPaid);
                      return (
                        <div key={registration.id} className="grid gap-2 rounded-xl border border-border/60 bg-background/55 p-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <PersonAvatar
                              name={registration.person?.display_name}
                              avatarUrl={registration.person?.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold">
                                {registration.person?.display_name || "Unknown participant"}
                              </p>
                              <p className="truncate text-xs font-medium text-muted-foreground">
                                {registration.person?.email || registration.person?.phone_number || "No contact detail"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={registration.status}
                              onChange={(event) => updateRegistration(registration.id, { status: event.target.value })}
                              className={cn(
                                "h-7 rounded-full border px-2 text-[11px] font-bold outline-none",
                                registrationStatusStyles[registration.status]
                              )}
                              disabled={!canManageEvents}
                            >
                              <option>Interested</option>
                              <option>Registered</option>
                              <option>Confirmed</option>
                              <option>Cancelled</option>
                            </select>
                            <span className="rounded-full border border-border/60 bg-card/70 px-2 py-1 text-[11px] font-bold text-muted-foreground">
                              Paid {money(registration.amountPaid)}
                            </span>
                            <span className={cn("rounded-full border px-2 py-1 text-[11px] font-bold", balance > 0 ? "border-brand-amber/25 bg-brand-amber/10 text-brand-amber" : "border-brand-sage/25 bg-brand-sage/10 text-brand-sage")}>
                              Balance {money(balance)}
                            </span>
                            <button
                              type="button"
                              className={cn(
                                "rounded-full border px-2 py-1 text-[11px] font-bold",
                                registration.medicalFormReceived ? "border-brand-sage/25 bg-brand-sage/10 text-brand-sage" : "border-border/60 bg-card/70 text-muted-foreground"
                              )}
                              onClick={() => updateRegistration(registration.id, { medical_form_received: !registration.medicalFormReceived })}
                              disabled={!canManageEvents}
                            >
                              Medical
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "rounded-full border px-2 py-1 text-[11px] font-bold",
                                registration.consentFormReceived ? "border-brand-sage/25 bg-brand-sage/10 text-brand-sage" : "border-border/60 bg-card/70 text-muted-foreground"
                              )}
                              onClick={() => updateRegistration(registration.id, { consent_form_received: !registration.consentFormReceived })}
                              disabled={!canManageEvents}
                            >
                              Consent
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "rounded-full border px-2 py-1 text-[11px] font-bold",
                                registration.transportNeeded ? "border-brand-teal/25 bg-brand-teal/10 text-brand-teal" : "border-border/60 bg-card/70 text-muted-foreground"
                              )}
                              onClick={() => updateRegistration(registration.id, { transport_needed: !registration.transportNeeded })}
                              disabled={!canManageEvents}
                            >
                              Transport
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                              onClick={() => removeRegistration(registration.id)}
                              disabled={!canManageEvents}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="border-t border-border/70 p-3 xl:border-t-0">
                  <p className="label-eyebrow">Collaborators</p>
                  <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1">
                    {selectedEvent.collaborators.length === 0 && (
                      <div className="actsix-empty-state min-h-20 text-left text-sm sm:col-span-2 xl:col-span-3">
                        Add event collaborators so the planning team is visible.
                      </div>
                    )}
                    {selectedEvent.collaborators.map((collaborator) => (
                      <div key={collaborator.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/55 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <PersonAvatar
                            name={collaborator.person?.display_name}
                            avatarUrl={collaborator.person?.avatar_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold">{collaborator.person?.display_name || "Unknown person"}</p>
                            <p className="truncate text-xs font-bold text-muted-foreground">{collaborator.role}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => removeCollaborator(collaborator.id)}
                          disabled={!canManageEvents}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
                </div>
              </Card>
            )}
          </div>
        </section>
      </div>

      <ResponsiveModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
        title={editingId ? "Edit Event" : "Add Event"}
        description="Set the core details for a camp, mission trip, retreat, outreach, or major church event."
        className="max-h-[92svh] max-w-4xl overflow-y-auto rounded-xl"
        bodyClassName="space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 xl:col-span-2">
            <span className="text-xs font-bold text-muted-foreground">Event Name</span>
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Event name"
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Event Type</span>
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as EventType }))}
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none"
            >
              <option>Camp</option>
              <option>Mission Trip</option>
              <option>Retreat</option>
              <option>Outreach</option>
              <option>Conference</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EventStatus }))}
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none"
            >
              <option>Planning</option>
              <option>Open</option>
              <option>Final Prep</option>
              <option>Complete</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Start Date</span>
            <Input
              type="date"
              value={form.startsAt}
              onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">End Date</span>
            <Input
              type="date"
              value={form.endsAt}
              onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Location</span>
            <Input
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="Location"
              className="h-9 rounded-xl bg-background"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Owner / Team</span>
            <Input
              value={form.owner}
              onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
              placeholder="Owner/team"
              className="h-9 rounded-xl bg-background"
            />
          </label>

          <div className="rounded-xl border border-border/60 bg-background/45 p-3 md:col-span-2 xl:col-span-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              Capacity & Money
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Capacity</span>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(event) => setForm((current) => ({ ...current, capacity: Number(event.target.value) }))}
                  placeholder="Total spots"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Manual Registered</span>
                <Input
                  type="number"
                  value={form.registered}
                  onChange={(event) => setForm((current) => ({ ...current, registered: Number(event.target.value) }))}
                  placeholder="Legacy count"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Overall Budget</span>
                <Input
                  type="number"
                  value={form.budget}
                  onChange={(event) => setForm((current) => ({ ...current, budget: Number(event.target.value) }))}
                  placeholder="Total budget"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Cost Per Person</span>
                <Input
                  type="number"
                  value={form.costPerPerson}
                  onChange={(event) => setForm((current) => ({ ...current, costPerPerson: Number(event.target.value) }))}
                  placeholder="Participant cost"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Funds Received</span>
                <Input
                  type="number"
                  value={form.received}
                  onChange={(event) => setForm((current) => ({ ...current, received: Number(event.target.value) }))}
                  placeholder="Money received"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
            </div>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-muted-foreground">Planning Notes</span>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Planning notes, risks, and next decisions..."
            className="min-h-24 rounded-xl bg-background"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="outline"
            className="actsix-btn-outline h-9 rounded-xl"
            onClick={() => setFormOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="actsix-btn-primary h-9 rounded-xl"
            onClick={saveEvent}
            disabled={saving || !canManageEvents}
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add event"}
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={participantOpen}
        onOpenChange={setParticipantOpen}
        title="Add Participants"
        description="Add People profiles as event participants and set their initial registration status."
        className="max-h-[92svh] max-w-2xl overflow-y-auto rounded-xl"
        bodyClassName="space-y-3"
      >
        <PeopleMultiSearchSelect
          people={availableParticipantPeople}
          selectedPersonIds={selectedParticipantIds}
          onChange={setSelectedParticipantIds}
          placeholder="Search People to register..."
          emptyText="No available People profiles found."
          showAllOnFocus
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Status</span>
            <select
              value={participantStatus}
              onChange={(event) => setParticipantStatus(event.target.value as RegistrationStatus)}
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none"
            >
              <option>Interested</option>
              <option>Registered</option>
              <option>Confirmed</option>
              <option>Cancelled</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-muted-foreground">Amount Due</span>
            <Input
              type="number"
              value={participantAmountDue}
              onChange={(event) => setParticipantAmountDue(Number(event.target.value))}
              className="h-9 rounded-xl bg-background"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl" onClick={() => setParticipantOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="actsix-btn-primary h-9 rounded-xl"
            onClick={addParticipants}
            disabled={!canManageEvents || selectedParticipantIds.length === 0}
          >
            Add Participants
          </Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={collaboratorOpen}
        onOpenChange={setCollaboratorOpen}
        title="Add Collaborators"
        description="Add People profiles who help plan or lead this event."
        className="max-h-[92svh] max-w-2xl overflow-y-auto rounded-xl"
        bodyClassName="space-y-3"
      >
        <PeopleMultiSearchSelect
          people={availableCollaboratorPeople}
          selectedPersonIds={selectedCollaboratorIds}
          onChange={setSelectedCollaboratorIds}
          placeholder="Search People to add as collaborators..."
          emptyText="No available People profiles found."
          showAllOnFocus
        />
        <label className="space-y-1">
          <span className="text-xs font-bold text-muted-foreground">Role</span>
          <Input
            value={collaboratorRole}
            onChange={(event) => setCollaboratorRole(event.target.value)}
            placeholder="Collaborator"
            className="h-9 rounded-xl bg-background"
          />
        </label>
        <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
          <Button type="button" variant="outline" className="actsix-btn-outline h-9 rounded-xl" onClick={() => setCollaboratorOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="actsix-btn-primary h-9 rounded-xl"
            onClick={addCollaborators}
            disabled={!canManageEvents || selectedCollaboratorIds.length === 0}
          >
            Add Collaborators
          </Button>
        </div>
      </ResponsiveModal>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Tent; label: string; value: string | number }) {
  return (
    <Card className="actsix-panel-soft flex items-center gap-3 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="label-eyebrow truncate">{label}</p>
        <p className="mt-0.5 truncate text-lg font-extrabold">{value}</p>
      </div>
    </Card>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-extrabold">{value}</p>
    </div>
  );
}
