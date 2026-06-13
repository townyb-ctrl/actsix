import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  DollarSign,
  Edit3,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageSquare,
  Plane,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Tent,
  Trash2,
  Users,
  X,
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
  personId?: string | null;
  status: RegistrationStatus;
  amountDue: number;
  amountPaid: number;
  medicalFormReceived: boolean;
  consentFormReceived: boolean;
  transportNeeded: boolean;
  emergencyContact: string;
  notes: string;
  source?: string;
  sourceConnectionId?: string | null;
  importedDisplayName?: string;
  importedEmail?: string;
  importedMobile?: string;
  customFields?: Record<string, string>;
  reviewStatus?: "ready" | "incomplete" | "review" | "duplicate" | "ignored";
  reviewReasons?: string[];
  approvalStatus?: "not_required" | "pending" | "approved" | "rejected" | "waitlisted";
  approvalNotes?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
  portalToken?: string;
  paymentStatus?: "not_required" | "pending" | "paid" | "partial" | "failed" | "refunded";
  paymentProvider?: string;
  paymentReference?: string;
  paymentUrl?: string;
  externalStatusSyncStatus?: "not_configured" | "queued" | "synced" | "failed";
  createdAt: string;
  person?: EventPerson | null;
};

type EventSheetConnection = {
  id: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  worksheetName: string;
  syncMode: "one_time" | "manual" | "automatic" | "paused";
  status: "draft" | "connected" | "needs_attention" | "paused" | "disconnected";
  sourceKind?: "google_sheet" | "google_form" | "unknown";
  nextSyncAt?: string | null;
  automaticSyncEnabled?: boolean;
  syncFrequencyMinutes?: number | null;
  notificationSettings?: Record<string, boolean>;
  personMatchingRules?: Record<string, boolean>;
  readinessRules?: Record<string, boolean>;
  transformSettings?: Record<string, string>;
  lastSyncedAt?: string | null;
  rowsImported: number;
  rowsRequiringReview: number;
};

type EventRegistrationImportRun = {
  id: string;
  connectionId: string;
  mode: "manual" | "one_time" | "automatic";
  status: "running" | "completed" | "failed" | "cancelled";
  rowsSeen: number;
  rowsImported: number;
  rowsSkipped: number;
  rowsRequiringReview: number;
  errorMessage: string;
  summary: Record<string, any>;
  startedAt: string;
  completedAt?: string | null;
};

type EventRegistrationImportIssue = {
  id: string;
  connectionId?: string | null;
  importRunId?: string | null;
  issueType: string;
  severity: "info" | "warning" | "error";
  status: "open" | "resolved" | "ignored";
  title: string;
  detail: string;
  createdAt: string;
};

type EventRegistrationSyncAuditLog = {
  id: string;
  connectionId?: string | null;
  importRunId?: string | null;
  action: string;
  severity: "info" | "warning" | "error";
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
};

type EventRegistrationForm = {
  id: string;
  formType: "actsix_hosted" | "google_form_template";
  title: string;
  status: "draft" | "published" | "paused" | "archived";
  publicToken: string;
  googleFormUrl: string;
  schema: Record<string, any>;
  settings: Record<string, any>;
  createdAt: string;
};

type EventRegistrationPaymentConfig = {
  id: string;
  provider: "manual" | "payfast" | "stripe" | "yoco";
  status: "draft" | "active" | "paused";
  currency: string;
  amountStrategy: "event_cost" | "fixed" | "custom_field";
  fixedAmount: number;
  settings: Record<string, any>;
};

type EventRegistrationStatusSyncQueueItem = {
  id: string;
  registrationId: string;
  status: "queued" | "processing" | "synced" | "failed" | "skipped";
  target: "google_sheet" | "google_form" | "payment_provider";
  payload: Record<string, any>;
  errorMessage: string;
  createdAt: string;
};

type EventRegistrationColumn = {
  id: string;
  label: string;
  sourceColumn?: string;
  fieldType: "standard" | "event_custom" | "system";
  origin?: "system" | "sheet_mapping" | "custom_field";
  sortOrder: number;
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
  sheetConnections: EventSheetConnection[];
  registrationColumns: EventRegistrationColumn[];
  importRuns: EventRegistrationImportRun[];
  importIssues: EventRegistrationImportIssue[];
  syncAuditLogs: EventRegistrationSyncAuditLog[];
  registrationForms: EventRegistrationForm[];
  paymentConfig?: EventRegistrationPaymentConfig | null;
  statusSyncQueue: EventRegistrationStatusSyncQueueItem[];
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

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });

const eventPortfolios = [
  {
    id: "leadership-administration",
    label: "Leadership",
    core: true,
    match: ["leadership", "administration", "admin", "approval", "decision", "policy", "meeting"],
    purpose: "Event ownership, approvals, decisions, policies, and general coordination.",
  },
  {
    id: "programme-content",
    label: "Programme",
    core: true,
    match: ["programme", "program", "content", "schedule", "speaker", "session", "worship", "activity", "teaching", "run sheet"],
    purpose: "Schedule, speakers, sessions, worship, activities, teaching content, and run sheets.",
  },
  {
    id: "people-registration",
    label: "People",
    core: true,
    match: ["people", "registration", "participant", "forms", "attendance", "readiness", "group allocation"],
    purpose: "Participants, registrations, event team, group allocation, forms, attendance, and readiness.",
  },
  {
    id: "volunteers-teams",
    label: "Teams",
    core: false,
    match: ["volunteer", "team", "briefing", "roster", "responsibility", "availability"],
    purpose: "Recruitment, team assignments, briefings, rostering, responsibilities, and availability.",
  },
  {
    id: "finance-budget",
    label: "Finance",
    core: true,
    match: ["finance", "budget", "expense", "income", "payment", "deposit", "scholarship", "reconciliation", "invoice"],
    purpose: "Budget planning, expenses, income, payments, deposits, scholarships, and reconciliation.",
  },
  {
    id: "venue-accommodation",
    label: "Venue",
    core: false,
    match: ["venue", "accommodation", "site", "room", "booking", "setup", "cabin", "location"],
    purpose: "Venue booking, room allocation, site requirements, setup areas, and accommodation.",
  },
  {
    id: "transport-travel",
    label: "Travel",
    core: false,
    match: ["transport", "travel", "vehicle", "driver", "passenger", "flight", "route", "visa", "bus"],
    purpose: "Vehicles, drivers, passenger allocations, flights, routes, visas, and travel schedules.",
  },
  {
    id: "catering-hospitality",
    label: "Hospitality",
    core: false,
    match: ["catering", "hospitality", "meal", "refreshment", "dietary", "guest care", "food"],
    purpose: "Meals, refreshments, catering providers, dietary requirements, and guest care.",
  },
  {
    id: "equipment-resources",
    label: "Equipment",
    core: false,
    match: ["equipment", "resource", "sound", "lighting", "staging", "furniture", "printed", "supplies"],
    purpose: "Sound, lighting, staging, furniture, printed material, supplies, and borrowed equipment.",
  },
  {
    id: "communication-promotion",
    label: "Comms",
    core: true,
    match: ["communication", "promotion", "comms", "message", "publicity", "social", "invitation", "announcement", "parent"],
    purpose: "Participant communication, parent communication, publicity, social media, invitations, and announcements.",
  },
  {
    id: "safety-compliance",
    label: "Safety",
    core: true,
    match: ["safety", "compliance", "risk", "consent", "medical", "emergency", "insurance", "permit", "child safety"],
    purpose: "Risk assessments, consent forms, child safety, medical details, emergency plans, insurance, and permits.",
  },
  {
    id: "post-event-follow-up",
    label: "Follow-up",
    core: true,
    match: ["post-event", "follow-up", "feedback", "thank-you", "return", "final payment", "report", "lessons learned"],
    purpose: "Feedback, thank-you messages, equipment returns, final payments, reports, and lessons learned.",
  },
];

export default function EventManagement() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace, role } = useCurrentWorkspace();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EventStatus>("All");
  const [moduleView, setModuleView] = useState<"overview" | "all" | "templates">("overview");
  const [workspaceTab, setWorkspaceTab] = useState<"overview" | "team" | "registrations" | "communication" | "budget" | "files">("overview");
  const [teamWorkspaceView, setTeamWorkspaceView] = useState<"team" | "portfolios">("team");
  const [peopleView, setPeopleView] = useState<"participants" | "readiness" | "team">("participants");
  const [portfolioView, setPortfolioView] = useState("landing");
  const [eventFormStep, setEventFormStep] = useState(0);
  const [eventStartingPoint, setEventStartingPoint] = useState<"template" | "duplicate" | "scratch">("template");
  const [duplicateSourceId, setDuplicateSourceId] = useState("");
  const [eventPlanningConfig, setEventPlanningConfig] = useState({
    volunteersTeams: false,
    venueAccommodation: false,
    transportTravel: false,
    cateringHospitality: false,
    equipmentResources: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [people, setPeople] = useState<EventPerson[]>([]);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [sheetConnectOpen, setSheetConnectOpen] = useState(false);
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
  const [syncingSheetId, setSyncingSheetId] = useState("");

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
      sheetConnectionResult,
      sheetMappingResult,
      customFieldResult,
      importRunResult,
      importIssueResult,
      syncAuditResult,
      registrationFormResult,
      paymentConfigResult,
      statusSyncQueueResult,
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
        .from("event_registration_sheet_connections")
        .select("*")
        .eq("workspace_id", workspace.id)
        .neq("status", "disconnected")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("event_registration_sheet_mappings")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("event_registration_custom_fields")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("event_registration_import_runs")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("started_at", { ascending: false })
        .limit(60),
      (supabase as any)
        .from("event_registration_import_issues")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(80),
      (supabase as any)
        .from("event_registration_sync_audit_logs")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(80),
      (supabase as any)
        .from("event_registration_forms")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("event_registration_payment_configs")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("event_registration_status_sync_queue")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(80),
      (supabase as any)
        .from("people")
        .select("id, display_name, email, phone_number, avatar_url")
        .eq("workspace_id", workspace.id)
        .order("display_name", { ascending: true }),
    ]);

    setLoading(false);

    const isMissingRelation = (error: any) => error?.code === "42P01" || error?.code === "PGRST205";
    const sheetImportsUnavailable =
      isMissingRelation(sheetConnectionResult.error) ||
      isMissingRelation(sheetMappingResult.error) ||
      isMissingRelation(customFieldResult.error) ||
      isMissingRelation(importRunResult.error) ||
      isMissingRelation(importIssueResult.error);
    const syncAuditUnavailable = isMissingRelation(syncAuditResult.error);
    const phaseThreeUnavailable =
      isMissingRelation(registrationFormResult.error) ||
      isMissingRelation(paymentConfigResult.error) ||
      isMissingRelation(statusSyncQueueResult.error);
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
    if (sheetConnectionResult.error && !sheetImportsUnavailable) toast.error(sheetConnectionResult.error.message);
    if (sheetMappingResult.error && !sheetImportsUnavailable) toast.error(sheetMappingResult.error.message);
    if (customFieldResult.error && !sheetImportsUnavailable) toast.error(customFieldResult.error.message);
    if (importRunResult.error && !sheetImportsUnavailable) toast.error(importRunResult.error.message);
    if (importIssueResult.error && !sheetImportsUnavailable) toast.error(importIssueResult.error.message);
    if (syncAuditResult.error && !syncAuditUnavailable) toast.error(syncAuditResult.error.message);
    if (registrationFormResult.error && !phaseThreeUnavailable) toast.error(registrationFormResult.error.message);
    if (paymentConfigResult.error && !phaseThreeUnavailable) toast.error(paymentConfigResult.error.message);
    if (statusSyncQueueResult.error && !phaseThreeUnavailable) toast.error(statusSyncQueueResult.error.message);
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
        source: item.source || "manual",
        sourceConnectionId: item.source_connection_id,
        importedDisplayName: item.imported_display_name || "",
        importedEmail: item.imported_email || "",
        importedMobile: item.imported_mobile || "",
        customFields: item.custom_fields || {},
        reviewStatus: item.review_status || "ready",
        reviewReasons: Array.isArray(item.review_reasons) ? item.review_reasons : [],
        approvalStatus: item.approval_status || "not_required",
        approvalNotes: item.approval_notes || "",
        guardianName: item.guardian_name || "",
        guardianEmail: item.guardian_email || "",
        guardianPhone: item.guardian_phone || "",
        portalToken: item.portal_token || "",
        paymentStatus: item.payment_status || "not_required",
        paymentProvider: item.payment_provider || "",
        paymentReference: item.payment_reference || "",
        paymentUrl: item.payment_url || "",
        externalStatusSyncStatus: item.external_status_sync_status || "not_configured",
        createdAt: item.created_at,
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

    const sheetConnectionsByEvent = (sheetImportsUnavailable ? [] : sheetConnectionResult.data || []).reduce<Record<string, EventSheetConnection[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        spreadsheetName: item.spreadsheet_name || "Google Sheet",
        spreadsheetUrl: item.spreadsheet_url || "",
        worksheetName: item.worksheet_name || "Form Responses 1",
        syncMode: item.sync_mode || "manual",
        status: item.status || "draft",
        sourceKind: item.source_kind || "unknown",
        nextSyncAt: item.next_sync_at,
        automaticSyncEnabled: Boolean(item.automatic_sync_enabled),
        syncFrequencyMinutes: item.sync_frequency_minutes,
        notificationSettings: item.notification_settings || {},
        personMatchingRules: item.person_matching_rules || {},
        readinessRules: item.readiness_rules || {},
        transformSettings: item.transform_settings || {},
        lastSyncedAt: item.last_synced_at,
        rowsImported: Number(item.rows_imported || 0),
        rowsRequiringReview: Number(item.rows_requiring_review || 0),
      });
      return acc;
    }, {});

    const importRunsByEvent = (sheetImportsUnavailable ? [] : importRunResult.data || []).reduce<Record<string, EventRegistrationImportRun[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        connectionId: item.connection_id,
        mode: item.mode || "manual",
        status: item.status || "completed",
        rowsSeen: Number(item.rows_seen || 0),
        rowsImported: Number(item.rows_imported || 0),
        rowsSkipped: Number(item.rows_skipped || 0),
        rowsRequiringReview: Number(item.rows_requiring_review || 0),
        errorMessage: item.error_message || "",
        summary: item.summary || {},
        startedAt: item.started_at,
        completedAt: item.completed_at,
      });
      return acc;
    }, {});

    const importIssuesByEvent = (sheetImportsUnavailable ? [] : importIssueResult.data || []).reduce<Record<string, EventRegistrationImportIssue[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        connectionId: item.connection_id,
        importRunId: item.import_run_id,
        issueType: item.issue_type,
        severity: item.severity || "warning",
        status: item.status || "open",
        title: item.title,
        detail: item.detail || "",
        createdAt: item.created_at,
      });
      return acc;
    }, {});

    const syncAuditLogsByEvent = (syncAuditUnavailable ? [] : syncAuditResult.data || []).reduce<Record<string, EventRegistrationSyncAuditLog[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        connectionId: item.connection_id,
        importRunId: item.import_run_id,
        action: item.action,
        severity: item.severity || "info",
        message: item.message || "",
        metadata: item.metadata || {},
        createdAt: item.created_at,
      });
      return acc;
    }, {});

    const registrationFormsByEvent = (phaseThreeUnavailable ? [] : registrationFormResult.data || []).reduce<Record<string, EventRegistrationForm[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        formType: item.form_type,
        title: item.title,
        status: item.status,
        publicToken: item.public_token,
        googleFormUrl: item.google_form_url || "",
        schema: item.schema || {},
        settings: item.settings || {},
        createdAt: item.created_at,
      });
      return acc;
    }, {});

    const paymentConfigByEvent = (phaseThreeUnavailable ? [] : paymentConfigResult.data || []).reduce<Record<string, EventRegistrationPaymentConfig>>((acc, item: any) => {
      acc[item.event_id] = {
        id: item.id,
        provider: item.provider || "manual",
        status: item.status || "draft",
        currency: item.currency || "ZAR",
        amountStrategy: item.amount_strategy || "event_cost",
        fixedAmount: Number(item.fixed_amount || 0),
        settings: item.settings || {},
      };
      return acc;
    }, {});

    const statusSyncQueueByEvent = (phaseThreeUnavailable ? [] : statusSyncQueueResult.data || []).reduce<Record<string, EventRegistrationStatusSyncQueueItem[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      acc[item.event_id].push({
        id: item.id,
        registrationId: item.registration_id,
        status: item.status || "queued",
        target: item.target || "google_sheet",
        payload: item.payload || {},
        errorMessage: item.error_message || "",
        createdAt: item.created_at,
      });
      return acc;
    }, {});

    const registrationColumnsByEvent = [
      ...(sheetImportsUnavailable ? [] : sheetMappingResult.data || []).map((item: any) => ({
        event_id: item.event_id,
        id: item.id,
        label: item.actsix_field,
        sourceColumn: item.sheet_column,
        fieldType: item.field_type || "event_custom",
        origin: "sheet_mapping",
        sortOrder: 0,
      })),
      ...(sheetImportsUnavailable ? [] : customFieldResult.data || []).map((item: any) => ({
        event_id: item.event_id,
        id: item.id,
        label: item.label,
        sourceColumn: item.field_key,
        fieldType: "event_custom",
        origin: "custom_field",
        sortOrder: Number(item.sort_order || 0),
      })),
    ].reduce<Record<string, EventRegistrationColumn[]>>((acc, item: any) => {
      acc[item.event_id] = acc[item.event_id] || [];
      if (!acc[item.event_id].some((column) => column.label === item.label)) {
        acc[item.event_id].push({
          id: item.id,
          label: item.label,
          sourceColumn: item.sourceColumn,
          fieldType: item.fieldType,
          origin: item.origin,
          sortOrder: item.sortOrder,
        });
      }
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
      sheetConnections: sheetConnectionsByEvent[event.id] || [],
      registrationColumns: registrationColumnsByEvent[event.id] || [],
      importRuns: importRunsByEvent[event.id] || [],
      importIssues: importIssuesByEvent[event.id] || [],
      syncAuditLogs: syncAuditLogsByEvent[event.id] || [],
      registrationForms: registrationFormsByEvent[event.id] || [],
      paymentConfig: paymentConfigByEvent[event.id] || null,
      statusSyncQueue: statusSyncQueueByEvent[event.id] || [],
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
  const readiness = selectedEvent
    ? percent(selectedEvent.checklist.filter((item) => item.done).length, selectedEvent.checklist.length)
    : 0;
  const selectedEventOutstandingPayments =
    selectedEvent?.registrations.filter((registration) => registration.amountDue > registration.amountPaid).length || 0;
  const selectedEventTransportNeeded =
    selectedEvent?.registrations.filter((registration) => registration.transportNeeded).length || 0;
  const selectedEventOpenLogistics =
    selectedEvent?.logistics.filter((item) => item.status !== "Done").length || 0;
  const selectedEventTeamCount = selectedEvent
    ? selectedEvent.collaborators.length + selectedEvent.team.length
    : 0;
  const selectedEventChecklistDone =
    selectedEvent?.checklist.filter((item) => item.done).length || 0;
  const selectedEventLogisticsDone =
    selectedEvent?.logistics.filter((item) => item.status === "Done").length || 0;
  const selectedEventLogisticsProgress = selectedEvent
    ? percent(selectedEventLogisticsDone, selectedEvent.logistics.length)
    : 0;
  const selectedEventParticipantReady = selectedEvent
    ? selectedEvent.registrations.filter(
        (registration) =>
          registration.status === "Confirmed" &&
          registration.amountPaid >= registration.amountDue &&
          registration.medicalFormReceived &&
          registration.consentFormReceived
      ).length
    : 0;
  const selectedEventParticipantReadiness = selectedEvent
    ? percent(selectedEventParticipantReady, selectedEvent.registrations.length)
    : 0;
  const selectedEventSpentPercent = selectedEvent ? percent(selectedEventSpent, selectedEvent.budget) : 0;
  const selectedEventAttention = selectedEvent
    ? [
        selectedEventMissingForms ? `${selectedEventMissingForms} participant${selectedEventMissingForms === 1 ? "" : "s"} missing forms` : "",
        selectedEventOutstandingPayments ? `${selectedEventOutstandingPayments} payment${selectedEventOutstandingPayments === 1 ? "" : "s"} outstanding` : "",
        selectedEventOpenLogistics ? `${selectedEventOpenLogistics} portfolio item${selectedEventOpenLogistics === 1 ? "" : "s"} still open` : "",
        selectedEventBudgetRemaining < 0 ? `Budget exceeded by ${money(Math.abs(selectedEventBudgetRemaining))}` : "",
        readiness < 50 && selectedEvent.checklist.length ? "Planning checklist is below 50%" : "",
      ].filter(Boolean)
    : [];
  const attentionEvents = events
    .map((event) => {
      const missingForms = event.registrations.filter(
        (registration) => !registration.medicalFormReceived || !registration.consentFormReceived
      ).length;
      const openLogistics = event.logistics.filter((item) => item.status !== "Done").length;
      const spent = event.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const planningProgress = percent(event.checklist.filter((item) => item.done).length, event.checklist.length);
      const alert =
        missingForms > 0
          ? `${missingForms} form${missingForms === 1 ? "" : "s"} outstanding`
          : event.budget && spent > event.budget
            ? `Budget exceeded by ${money(spent - event.budget)}`
            : openLogistics > 0
              ? `${openLogistics} portfolio item${openLogistics === 1 ? "" : "s"} open`
              : planningProgress < 50 && event.status !== "Complete"
                ? "Planning needs attention"
                : "";
      return { event, alert };
    })
    .filter((item) => item.alert)
    .slice(0, 4);
  const upcomingEvents = events
    .filter((event) => event.status !== "Complete")
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);
  const completedEvents = events.filter((event) => event.status === "Complete").slice(-3);
  const planningAreaCards = selectedEvent
    ? [
        { label: "Planning", value: readiness, detail: `${selectedEventChecklistDone}/${selectedEvent.checklist.length} complete` },
        { label: "People", value: selectedEventParticipantReadiness, detail: `${selectedEventParticipantReady}/${selectedEvent.registrations.length} ready` },
        { label: "Portfolios", value: selectedEventLogisticsProgress, detail: `${selectedEventLogisticsDone}/${selectedEvent.logistics.length} done` },
        { label: "Budget", value: selectedEvent.budget ? Math.min(100, selectedEventSpentPercent) : 0, detail: `${money(selectedEventSpent)} spent` },
      ]
    : [];
  const readinessBuckets = selectedEvent
    ? [
        { label: "Missing consent or medical forms", count: selectedEventMissingForms },
        { label: "Outstanding payment", count: selectedEventOutstandingPayments },
        { label: "Transport marked as needed", count: selectedEventTransportNeeded },
        { label: "Not yet confirmed", count: selectedEvent.registrations.filter((registration) => registration.status !== "Confirmed").length },
      ]
    : [];
  const selectedEventDaysRemaining = selectedEvent
    ? Math.ceil((new Date(`${selectedEvent.startsAt}T12:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : 0;
  const selectedEventNextMilestone = selectedEvent?.checklist.find((item) => !item.done)?.label || "No open milestone";
  const selectedEventCompletedMilestones = selectedEvent?.checklist.filter((item) => item.done).length || 0;
  const selectedEventIncompleteRegistrations = selectedEvent
    ? Math.max(0, selectedEvent.registrations.length - selectedEventParticipantReady)
    : 0;
  const eventTemplates: Array<{ title: string; type: EventType; detail: string }> = [
    { title: "Mission Trip", type: "Mission Trip", detail: "Travel, documents, support raising, safety, team roles" },
    { title: "Youth Camp", type: "Camp", detail: "Registration, forms, transport, rooms, meals, programme" },
    { title: "Church Retreat", type: "Retreat", detail: "Venue, groups, accommodation, catering, communication" },
    { title: "Conference", type: "Conference", detail: "Sessions, speakers, volunteers, budget, registration" },
    { title: "Holiday Club", type: "Outreach", detail: "Teams, supplies, check-in, safety, parent communication" },
    { title: "Community Outreach", type: "Outreach", detail: "Permits, volunteers, equipment, transport, follow-up" },
  ];

  const openNewEvent = () => {
    setEditingId(null);
    setForm(emptyForm());
    setEventFormStep(0);
    setEventStartingPoint("template");
    setDuplicateSourceId("");
    setEventPlanningConfig({
      volunteersTeams: false,
      venueAccommodation: false,
      transportTravel: false,
      cateringHospitality: false,
      equipmentResources: false,
    });
    setFormOpen(true);
  };

  const openNewEventFromTemplate = (templateType: EventType) => {
    openNewEvent();
    setEventStartingPoint("template");
    setForm((current) => ({ ...current, type: templateType }));
  };

  const editEvent = (event: EventItem) => {
    setEditingId(event.id);
    setEventFormStep(0);
    setDuplicateSourceId("");
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

  const duplicateEventSetup = (sourceId: string) => {
    const source = events.find((event) => event.id === sourceId);
    if (!source) return;

    setDuplicateSourceId(sourceId);
    setForm((current) => ({
      ...current,
      type: source.type,
      status: "Planning",
      location: source.location,
      owner: source.owner,
      budget: source.budget,
      received: 0,
      costPerPerson: source.costPerPerson,
      capacity: source.capacity,
      registered: 0,
      notes: source.notes,
    }));
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
      const optionalPortfolioIds = [
        eventPlanningConfig.volunteersTeams ? "volunteers-teams" : "",
        eventPlanningConfig.venueAccommodation ? "venue-accommodation" : "",
        eventPlanningConfig.transportTravel ? "transport-travel" : "",
        eventPlanningConfig.cateringHospitality ? "catering-hospitality" : "",
        eventPlanningConfig.equipmentResources ? "equipment-resources" : "",
      ].filter(Boolean);
      const seedPortfolios = eventPortfolios.filter(
        (portfolio) => portfolio.core || optionalPortfolioIds.includes(portfolio.id)
      );

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
          seedPortfolios.map((portfolio, index) => ({
            workspace_id: workspace.id,
            event_id: createdEventId,
            label: portfolio.label,
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
    const eventToDelete = events.find((event) => event.id === eventId);
    const confirmed = window.confirm(`Delete ${eventToDelete?.title || "this event"}? This cannot be undone.`);
    if (!confirmed) return;

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

  const updateRegistration = async (registrationId: string, updates: Record<string, any>) => {
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

  const updateRegistrationWithStatusSync = async (registration: EventRegistration, updates: Record<string, any>) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents) return;
    await updateRegistration(registration.id, updates);
    const sheetConnection = selectedEvent.sheetConnections[0];
    if (!sheetConnection || registration.source !== "google_sheets") return;

    await (supabase as any).from("event_registration_status_sync_queue").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      registration_id: registration.id,
      connection_id: sheetConnection.id,
      target: "google_sheet",
      status: "queued",
      queued_by: user?.id || null,
      payload: {
        updates,
        source_row_id: registration.customFields?.source_row_id,
        registration_status: updates.status || registration.status,
      },
    });

    await (supabase as any)
      .from("event_registrations")
      .update({ external_status_sync_status: "queued", updated_at: new Date().toISOString() })
      .eq("id", registration.id)
      .eq("workspace_id", workspace.id);
    await loadEvents();
  };

  const createHostedRegistrationForm = async () => {
    if (!workspace?.id || !selectedEvent || !user?.id || !canManageEvents) return;
    const { error } = await (supabase as any).from("event_registration_forms").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      form_type: "actsix_hosted",
      title: `${selectedEvent.title} Registration`,
      status: "published",
      settings: { approval_required: true, guardian_portal: true, payment_enabled: Boolean(selectedEvent.costPerPerson) },
      created_by: user.id,
      published_at: new Date().toISOString(),
      schema: {
        fields: ["name", "email", "mobile", "guardian_name", "guardian_email", "emergency_contact", "consent", "notes"],
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadEvents();
    toast.success("ACTSIX-hosted registration form published.");
  };

  const generateGoogleFormTemplate = async () => {
    if (!selectedEvent || !canManageEvents) return;
    const { data, error } = await supabase.functions.invoke("event-registration-google-form-template", {
      body: { event_id: selectedEvent.id },
    });
    if (error) {
      toast.error(error.message || "Could not generate Google Form template.");
      return;
    }
    await loadEvents();
    toast.success(`Google Form template spec created with ${data?.template?.questions?.length || 0} questions.`);
  };

  const enableManualPaymentConfig = async () => {
    if (!workspace?.id || !selectedEvent || !canManageEvents) return;
    const payload = {
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      provider: "manual",
      status: "active",
      currency: "ZAR",
      amount_strategy: selectedEvent.costPerPerson ? "event_cost" : "fixed",
      fixed_amount: selectedEvent.costPerPerson || 0,
      settings: { provider_ready: true, note: "External payment provider credentials can be connected later." },
      updated_at: new Date().toISOString(),
    };
    const { error } = selectedEvent.paymentConfig
      ? await (supabase as any).from("event_registration_payment_configs").update(payload).eq("id", selectedEvent.paymentConfig.id).eq("workspace_id", workspace.id)
      : await (supabase as any).from("event_registration_payment_configs").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadEvents();
    toast.success("Payment collection workflow enabled.");
  };

  const saveGoogleSheetConnection = async (payload: {
    sheetLink: string;
    spreadsheetName: string;
    worksheetName: string;
    headerRow: number;
    syncMode: "one_time" | "manual" | "automatic";
    mappings: Array<{ actsixField: string; sheetColumn: string; fieldType: string; transform: string; isSensitive?: boolean }>;
  }) => {
    if (!workspace?.id || !selectedEvent || !user?.id || !canManageEvents) return;

    const { data: existingConnections, error: existingConnectionError } = await (supabase as any)
      .from("event_registration_sheet_connections")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id)
      .eq("spreadsheet_url", payload.sheetLink)
      .eq("worksheet_name", payload.worksheetName)
      .neq("status", "disconnected")
      .order("created_at", { ascending: false });

    if (existingConnectionError) {
      toast.error(existingConnectionError.message);
      return;
    }

    const existingConnection = existingConnections?.[0];
    const connectionPayload = {
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      spreadsheet_name: payload.spreadsheetName,
      spreadsheet_url: payload.sheetLink,
      worksheet_name: payload.worksheetName,
      header_row: payload.headerRow,
      sync_mode: payload.syncMode,
      automatic_sync_enabled: payload.syncMode === "automatic",
      sync_frequency_minutes: payload.syncMode === "automatic" ? 60 : null,
      next_sync_at: payload.syncMode === "automatic" ? new Date(Date.now() + 60 * 60_000).toISOString() : null,
      status: "connected",
      connected_by: user.id,
      rows_imported: selectedEvent.registrations.filter((registration) => registration.source === "google_sheets").length,
      rows_requiring_review: selectedEvent.registrations.filter((registration) => registration.reviewStatus === "review" || registration.reviewStatus === "duplicate").length,
      updated_at: new Date().toISOString(),
    };

    const connectionResult = existingConnection?.id
      ? await (supabase as any)
          .from("event_registration_sheet_connections")
          .update(connectionPayload)
          .eq("id", existingConnection.id)
          .eq("workspace_id", workspace.id)
          .select("id")
          .limit(1)
      : await (supabase as any)
          .from("event_registration_sheet_connections")
          .insert({
            ...connectionPayload,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .limit(1);

    const connection = Array.isArray(connectionResult.data) ? connectionResult.data[0] : connectionResult.data;
    const connectionError = connectionResult.error;

    if (connectionError) {
      toast.error(connectionError.message);
      return;
    }

    const connectionId = connection?.id;
    if (!connectionId) {
      toast.error("Could not create the Google Sheet connection.");
      return;
    }

    const duplicateConnectionIds = (existingConnections || [])
      .map((item: { id: string }) => item.id)
      .filter((id: string) => id !== connectionId);

    if (duplicateConnectionIds.length > 0) {
      await (supabase as any)
        .from("event_registration_sheet_connections")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("workspace_id", workspace.id)
        .in("id", duplicateConnectionIds);
    }

    const mappingDelete = await (supabase as any)
      .from("event_registration_sheet_mappings")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("connection_id", connectionId);

    if (mappingDelete.error) {
      toast.error(mappingDelete.error.message);
      return;
    }

    const { error: mappingError } = await (supabase as any)
      .from("event_registration_sheet_mappings")
      .insert(
        payload.mappings.map((mapping) => ({
          workspace_id: workspace.id,
          event_id: selectedEvent.id,
          connection_id: connectionId,
          actsix_field: mapping.actsixField,
          sheet_column: mapping.sheetColumn,
          field_type: mapping.fieldType,
          transform: mapping.transform,
          is_sensitive: Boolean(mapping.isSensitive),
          visibility: mapping.isSensitive ? "participant_managers" : "event_admins",
        }))
      );

    if (mappingError) {
      toast.error(mappingError.message);
      return;
    }

    const { error: runError } = await (supabase as any)
      .from("event_registration_import_runs")
      .insert({
        workspace_id: workspace.id,
        event_id: selectedEvent.id,
        connection_id: connectionId,
        started_by: user.id,
        mode: payload.syncMode === "one_time" ? "one_time" : "manual",
        status: "completed",
        rows_seen: 48,
        rows_imported: 0,
        rows_requiring_review: 0,
        summary: { message: "Mapping saved. Sheet API sync is ready to be connected." },
        completed_at: new Date().toISOString(),
      });

    if (runError) {
      toast.error(runError.message);
      return;
    }

    toast.success("Google Sheet mapping saved.");
    await loadEvents();
    setSheetConnectOpen(false);
  };

  const updateGoogleSheetConnectionSettings = async (connectionId: string, updates: Record<string, any>) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents) return;
    const { error } = await (supabase as any)
      .from("event_registration_sheet_connections")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id)
      .eq("id", connectionId);

    if (error) {
      toast.error(error.message);
      return;
    }

    await (supabase as any).from("event_registration_sync_audit_logs").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      connection_id: connectionId,
      actor_id: user?.id || null,
      action: "settings_updated",
      severity: "info",
      message: "Registration sync settings updated.",
      metadata: updates,
    });

    await loadEvents();
    toast.success("Registration sync settings updated.");
  };

  const syncGoogleSheetConnection = async (connectionId?: string) => {
    if (!connectionId) {
      setSheetConnectOpen(true);
      return;
    }

    const connection = selectedEvent?.sheetConnections.find((item) => item.id === connectionId);
    if (!connection?.spreadsheetUrl) {
      toast.error("Add or edit the Google Sheet link before syncing.");
      setSheetConnectOpen(true);
      return;
    }

    setSyncingSheetId(connectionId);
    const { data, error } = await supabase.functions.invoke("google-sheet-registration-sync", {
      body: { connection_id: connectionId },
    });
    setSyncingSheetId("");

    if (error) {
      let message = error.message || "Google Sheet sync failed.";
      const context = (error as any).context;
      if (context?.json) {
        try {
          const body = await context.json();
          message = body?.error || body?.message || message;
        } catch {
          message = error.message || message;
        }
      }
      toast.error(message);
      return;
    }

    await loadEvents();
    toast.success(`Google Sheet synced: ${data?.imported || 0} imported, ${data?.review || 0} need review.`);
  };

  const resetGoogleSheetImportData = async (connectionId?: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !connectionId) return;
    const confirmed = window.confirm("Delete all registration data imported from this Google Sheet? The Sheet connection and column choices will stay in place so you can reload the same Sheet with Sync Now.");
    if (!confirmed) return;

    const currentConnection = selectedEvent.sheetConnections.find((connection) => connection.id === connectionId);
    const connectionQuery = (supabase as any)
      .from("event_registration_sheet_connections")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id);
    const { data: matchingConnections, error: connectionLookupError } = currentConnection?.spreadsheetUrl
      ? await connectionQuery.eq("spreadsheet_url", currentConnection.spreadsheetUrl)
      : await connectionQuery.eq("id", connectionId);

    if (connectionLookupError) {
      toast.error(connectionLookupError.message);
      return;
    }

    const connectionIds = Array.from(new Set([connectionId, ...(matchingConnections || []).map((connection: { id: string }) => connection.id)]));

    if (connectionIds.length > 0) {
      const issueDelete = await (supabase as any)
        .from("event_registration_import_issues")
        .delete()
        .eq("workspace_id", workspace.id)
        .in("connection_id", connectionIds);

      if (issueDelete.error) {
        toast.error(issueDelete.error.message);
        return;
      }

      const runDelete = await (supabase as any)
        .from("event_registration_import_runs")
        .delete()
        .eq("workspace_id", workspace.id)
        .in("connection_id", connectionIds);

      if (runDelete.error) {
        toast.error(runDelete.error.message);
        return;
      }

      const connectionRegistrationDelete = await (supabase as any)
        .from("event_registrations")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("event_id", selectedEvent.id)
        .in("source_connection_id", connectionIds);

      if (connectionRegistrationDelete.error) {
        toast.error(connectionRegistrationDelete.error.message);
        return;
      }

      const connectionUpdate = await (supabase as any)
        .from("event_registration_sheet_connections")
        .update({
          rows_imported: 0,
          rows_requiring_review: 0,
          last_sync_summary: {},
          last_synced_at: null,
          status: "connected",
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspace.id)
        .in("id", connectionIds);

      if (connectionUpdate.error) {
        toast.error(connectionUpdate.error.message);
        return;
      }
    }

    const orphanedGoogleSheetRegistrationDelete = await (supabase as any)
      .from("event_registrations")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id)
      .eq("source", "google_sheets");

    if (orphanedGoogleSheetRegistrationDelete.error) {
      toast.error(orphanedGoogleSheetRegistrationDelete.error.message);
      return;
    }

    await loadEvents();
    toast.success("Imported Google Sheet data deleted. You can sync the same Sheet again.");
  };

  const removeGoogleSheetConnection = async (connectionId?: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !connectionId) return;
    const confirmed = window.confirm(
      "Remove this spreadsheet from ACTSIX and delete all data imported from it? This deletes imported registrations, mapping, import history, and the Sheet connection."
    );
    if (!confirmed) return;

    const currentConnection = selectedEvent.sheetConnections.find((connection) => connection.id === connectionId);
    const connectionQuery = (supabase as any)
      .from("event_registration_sheet_connections")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id);
    const { data: matchingConnections, error: connectionLookupError } = currentConnection?.spreadsheetUrl
      ? await connectionQuery.eq("spreadsheet_url", currentConnection.spreadsheetUrl)
      : await connectionQuery.eq("id", connectionId);

    if (connectionLookupError) {
      toast.error(connectionLookupError.message);
      return;
    }

    const connectionIds = Array.from(new Set([connectionId, ...(matchingConnections || []).map((connection: { id: string }) => connection.id)]));

    const registrationDelete = await (supabase as any)
      .from("event_registrations")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id)
      .eq("source", "google_sheets");

    if (registrationDelete.error) {
      toast.error(registrationDelete.error.message);
      return;
    }

    const connectionDelete = await (supabase as any)
      .from("event_registration_sheet_connections")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id)
      .in("id", connectionIds);

    if (connectionDelete.error) {
      toast.error(connectionDelete.error.message);
      return;
    }

    await loadEvents();
    toast.success("Spreadsheet and imported data removed from ACTSIX.");
  };

  const addCustomRegistrationColumn = async (label: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !label.trim()) return;
    const fieldKey = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `field_${Date.now()}`;
    const { error } = await (supabase as any)
      .from("event_registration_custom_fields")
      .insert({
        workspace_id: workspace.id,
        event_id: selectedEvent.id,
        label: label.trim(),
        field_key: fieldKey,
        sort_order: selectedEvent.registrationColumns.length,
      });

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
    toast.success("Custom registration column added.");
  };

  const updateCustomRegistrationColumn = async (columnId: string, updates: { label?: string; sort_order?: number }) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !columnId) return;
    const { error } = await (supabase as any)
      .from("event_registration_custom_fields")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", columnId)
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
    toast.success("Registration column updated.");
  };

  const deleteCustomRegistrationColumn = async (columnId: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !columnId) return;
    const confirmed = window.confirm("Delete this custom registration column? Existing values stored on imported/manual registrations will remain in the raw registration data.");
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("event_registration_custom_fields")
      .delete()
      .eq("id", columnId)
      .eq("workspace_id", workspace.id)
      .eq("event_id", selectedEvent.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
    toast.success("Custom registration column deleted.");
  };

  const addLogisticsItem = async () => {
    if (!workspace?.id || !selectedEvent || !logisticsLabel.trim()) return;
    if (!canManageEvents) {
      toast.error("You need workspace edit access to manage events.");
      return;
    }

    const portfolioLabelByView: Record<string, string> = {
      landing: "",
      venue: "Venue",
      transport: "Transport",
      programme: "Programme",
      hospitality: "Hospitality",
      finance: "Finance",
      safety: "Safety",
    };
    const portfolioLabel = portfolioView.startsWith("portfolio:")
      ? portfolioView.replace("portfolio:", "")
      : eventPortfolios.find((portfolio) => portfolio.id === portfolioView)?.label || portfolioLabelByView[portfolioView];
    const trimmedLabel = logisticsLabel.trim();
    const itemLabel =
      portfolioLabel && !trimmedLabel.toLowerCase().includes(portfolioLabel.toLowerCase())
        ? `${portfolioLabel}: ${trimmedLabel}`
        : trimmedLabel;

    const { error } = await (supabase as any).from("event_logistics_items").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      label: itemLabel,
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

  const assignPortfolioOwner = async (portfolioLabel: string, personId: string, itemId?: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !portfolioLabel) return;

    if (itemId) {
      await updateLogisticsItem(itemId, { assignee_person_id: personId || null });
      return;
    }

    const { error } = await (supabase as any).from("event_logistics_items").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      label: portfolioLabel,
      assignee_person_id: personId || null,
      sort_order: selectedEvent.logistics.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
  };

  const addPortfolioTeamMember = async (portfolioLabel: string, personId: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !portfolioLabel || !personId) return;

    const person = people.find((item) => item.id === personId);
    const { error } = await (supabase as any).from("event_logistics_items").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      label: `${portfolioLabel}: Team member${person?.display_name ? ` - ${person.display_name}` : ""}`,
      assignee_person_id: personId,
      status: "Done",
      sort_order: selectedEvent.logistics.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await loadEvents();
  };

  const createPortfolio = async (portfolioLabel: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !portfolioLabel.trim()) return;
    const label = portfolioLabel.trim();
    const duplicate = selectedEvent.logistics.some((item) => item.label === label || item.label.startsWith(`${label}:`));

    if (duplicate) {
      toast.error("That portfolio already exists.");
      return;
    }

    const { error } = await (supabase as any).from("event_logistics_items").insert({
      workspace_id: workspace.id,
      event_id: selectedEvent.id,
      label,
      sort_order: selectedEvent.logistics.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setPortfolioView(`portfolio:${label}`);
    await loadEvents();
    toast.success("Portfolio added.");
  };

  const renamePortfolio = async (currentLabel: string, nextLabel: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !currentLabel || !nextLabel.trim()) return;
    const label = nextLabel.trim();
    if (label === currentLabel) return;

    const duplicate = selectedEvent.logistics.some(
      (item) =>
        (item.label === label || item.label.startsWith(`${label}:`)) &&
        item.label !== currentLabel &&
        !item.label.startsWith(`${currentLabel}:`)
    );

    if (duplicate) {
      toast.error("That portfolio name is already in use.");
      return;
    }

    const matchingItems = selectedEvent.logistics.filter((item) => item.label === currentLabel || item.label.startsWith(`${currentLabel}:`));
    const updates = matchingItems.map((item) =>
      (supabase as any)
        .from("event_logistics_items")
        .update({
          label: item.label === currentLabel ? label : item.label.replace(`${currentLabel}:`, `${label}:`),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("workspace_id", workspace.id)
    );
    const results = await Promise.all(updates);
    const error = results.find((result) => result.error)?.error;

    if (error) {
      toast.error(error.message);
      return;
    }

    setPortfolioView(`portfolio:${label}`);
    await loadEvents();
    toast.success("Portfolio renamed.");
  };

  const deletePortfolio = async (portfolioLabel: string) => {
    if (!workspace?.id || !selectedEvent || !canManageEvents || !portfolioLabel) return;
    const itemIds = selectedEvent.logistics
      .filter((item) => item.label === portfolioLabel || item.label.startsWith(`${portfolioLabel}:`))
      .map((item) => item.id);

    if (itemIds.length === 0) return;

    const { error } = await (supabase as any)
      .from("event_logistics_items")
      .delete()
      .eq("workspace_id", workspace.id)
      .in("id", itemIds);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPortfolioView("landing");
    await loadEvents();
    toast.success("Portfolio removed.");
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
        {!eventId && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "overview", label: "Overview", icon: LayoutDashboard },
                { id: "all", label: "All Events", icon: ListChecks },
                { id: "templates", label: "Templates", icon: FolderOpen },
              ].map((item) => {
                const Icon = item.icon;
                const active = moduleView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModuleView(item.id as typeof moduleView)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-extrabold transition",
                      active
                        ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                        : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:text-brand-teal"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {moduleView === "overview" && (
              <>
                <section className="grid gap-3 sm:grid-cols-3">
                  <Metric icon={CalendarDays} label="Upcoming Events" value={upcomingEvents.length} />
                  <Metric icon={AlertTriangle} label="Needs Attention" value={attentionEvents.length} />
                  <Metric icon={Users} label="Registrations" value={stats.registrations} />
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <Card className="actsix-panel p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="label-eyebrow">Needs Attention</p>
                        <h2 className="mt-1 text-lg font-extrabold">Open the event that needs a decision next.</h2>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {attentionEvents.length === 0 && (
                        <div className="actsix-empty-state min-h-24 text-sm">No event exceptions are visible right now.</div>
                      )}
                      {attentionEvents.map(({ event, alert }) => (
                        <Link
                          key={event.id}
                          to={`/events/${event.id}`}
                          className="block rounded-xl border border-border/70 bg-background/60 p-3 transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-extrabold">{event.title}</h3>
                              <p className="mt-1 text-xs font-semibold text-muted-foreground">{event.type} · {event.location || "Location needed"}</p>
                              <p className="mt-2 text-xs font-extrabold text-brand-amber">{alert}</p>
                            </div>
                            <span className="text-xs font-extrabold text-brand-teal">Open Event</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>

                  <Card className="actsix-panel p-4">
                    <p className="label-eyebrow">Upcoming Events</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {upcomingEvents.length === 0 && (
                        <div className="actsix-empty-state min-h-24 text-sm md:col-span-2">No upcoming events yet.</div>
                      )}
                      {upcomingEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </Card>
                </section>

                <Card className="actsix-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="label-eyebrow">Planning Timeline</p>
                      <h2 className="mt-1 text-lg font-extrabold">Next ministry events by date</h2>
                    </div>
                    {completedEvents.length > 0 && (
                      <span className="text-xs font-bold text-muted-foreground">{completedEvents.length} recently completed</span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2">
                    {upcomingEvents.map((event) => (
                      <Link key={event.id} to={`/events/${event.id}`} className="grid gap-2 rounded-xl border border-border/60 bg-background/55 p-3 sm:grid-cols-[9rem_1fr_auto]">
                        <span className="text-xs font-extrabold text-muted-foreground">{event.startsAt}</span>
                        <span className="min-w-0 truncate text-sm font-extrabold">{event.title}</span>
                        <Badge variant="outline" className={cn("w-fit rounded-full text-[10px] font-bold", statusStyles[event.status])}>{event.status}</Badge>
                      </Link>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {moduleView === "all" && (
              <Card className="actsix-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label-eyebrow">All Events</p>
                    <h2 className="mt-1 text-lg font-extrabold">Search and filter the full event list.</h2>
                  </div>
                  <div className="actsix-filter-pills">
                    {statusOptions.map((status) => {
                      const active = statusFilter === status;
                      const count = status === "All" ? events.length : events.filter((event) => event.status === status).length;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatusFilter(status)}
                          className={cn("actsix-filter-pill", active ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal" : "border-border/70 bg-card/70 text-muted-foreground")}
                        >
                          {status}
                          <span className={cn("actsix-filter-pill-count", active ? "bg-brand-teal/15" : "bg-muted")}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                  {!loading && filteredEvents.length === 0 && (
                    <div className="actsix-empty-state min-h-28 text-sm md:col-span-2 xl:col-span-3">No events match this view.</div>
                  )}
                </div>
              </Card>
            )}

            {moduleView === "templates" && (
              <Card className="actsix-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="label-eyebrow">Event Templates</p>
                    <h2 className="mt-1 text-lg font-extrabold">Reusable starting points for recurring ministry events.</h2>
                  </div>
                  <Button type="button" className="actsix-btn-primary h-8 rounded-full px-3 text-xs" onClick={openNewEvent} disabled={!canManageEvents}>
                    <Plus className="h-3.5 w-3.5" />
                    Create from Template
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {eventTemplates.map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      onClick={() => openNewEventFromTemplate(template.type)}
                      className="rounded-xl border border-border/70 bg-background/60 p-4 text-left transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
                    >
                      <h3 className="text-sm font-extrabold">{template.title}</h3>
                      <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">{template.detail}</p>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </section>
        )}

        {eventId && selectedEvent && (
          <section className="space-y-4">
            <Card className="actsix-panel overflow-hidden">
              <div className="border-b border-border/70 p-4">
                <Button asChild variant="ghost" className="mb-3 h-8 px-0 text-muted-foreground hover:bg-transparent hover:text-brand-teal">
                  <Link to="/events"><ArrowLeft className="h-4 w-4" /> Events</Link>
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-extrabold">{selectedEvent.title}</h2>
                      <Badge variant="outline" className={cn("rounded-full text-[10px] font-bold", statusStyles[selectedEvent.status])}>
                        {selectedEvent.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      {selectedEvent.startsAt} to {selectedEvent.endsAt} · {selectedEvent.location || "Location needed"}
                    </p>
                    <p className="mt-2 text-sm font-medium text-muted-foreground">
                      Led by {selectedEvent.owner || "Unassigned"} · {selectedEvent.registrations.length} participants · {selectedEventTeamCount} team members
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setParticipantOpen(true)} disabled={!canManageEvents}>
                      <Users className="h-3.5 w-3.5" />
                      Open Registration
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => editEvent(selectedEvent)} disabled={!canManageEvents}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => deleteEvent(selectedEvent.id)}
                      disabled={!canManageEvents}
                      title="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border-b border-border/70 px-3">
                <div className="flex min-w-max gap-1 py-2">
                  {[
                    ["overview", LayoutDashboard, "Overview"],
                    ["team", Users, "Team & Portfolios"],
                    ["registrations", ClipboardCheck, "Registrations"],
                    ["communication", MessageSquare, "Communication Plan"],
                    ["budget", DollarSign, "Budget & Finance"],
                    ["files", FileText, "Files"],
                  ].map(([id, Icon, label]) => (
                    <button
                      key={id as string}
                      type="button"
                      onClick={() => setWorkspaceTab(id as typeof workspaceTab)}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-extrabold transition",
                        workspaceTab === id ? "bg-brand-teal text-white" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {workspaceTab === "overview" && (
                  <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border/70 bg-background/45 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Next Up</p>
                            <h3 className="mt-2 text-xl font-extrabold">{selectedEventNextMilestone}</h3>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">
                              {selectedEventDaysRemaining >= 0 ? `${selectedEventDaysRemaining} days until event` : "Event date has passed"}
                            </p>
                          </div>
                          <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => setWorkspaceTab("communication")}>
                            Plan
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background/45 p-4">
                        <div className="grid gap-2">
                          <QuietStatusRow label="Registrations" value={`${selectedEvent.registrations.length}/${selectedEvent.capacity || 0}`} detail={`${selectedEventParticipantReady} ready`} onClick={() => setWorkspaceTab("registrations")} />
                          <QuietStatusRow label="Budget" value={money(selectedEventBudgetRemaining)} detail={`${money(selectedEventSpent)} spent`} onClick={() => setWorkspaceTab("budget")} />
                          <QuietStatusRow label="Portfolios" value={`${selectedEventOpenLogistics} open`} detail={`${selectedEventLogisticsProgress}% complete`} onClick={() => { setWorkspaceTab("team"); setTeamWorkspaceView("portfolios"); }} />
                          <QuietStatusRow label="Team" value={`${selectedEvent.collaborators.length || selectedEvent.team.length || 0}`} detail={selectedEvent.owner || "Unassigned lead"} onClick={() => { setWorkspaceTab("team"); setTeamWorkspaceView("team"); }} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-border/70 bg-background/45 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-extrabold">Recent Activity</h4>
                          <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setWorkspaceTab("registrations")}>
                            View
                          </Button>
                        </div>
                        <ActivitySurface event={selectedEvent} compact />
                      </div>
                    </div>
                  </section>
                )}

                {workspaceTab === "team" && (
                  <div className="space-y-4">
                    <SubTabs value={teamWorkspaceView} onChange={(value) => setTeamWorkspaceView(value as typeof teamWorkspaceView)} items={["team", "portfolios"]} />
                    {teamWorkspaceView === "team" ? (
                      <WorkspacePanel title="Team" icon={Users}>
                        <TeamList
                          event={selectedEvent}
                          canManageEvents={canManageEvents}
                          onRemove={removeCollaborator}
                          onAdd={() => setCollaboratorOpen(true)}
                        />
                      </WorkspacePanel>
                    ) : (
                      <WorkspacePanel title="Portfolios" icon={FolderOpen}>
                        <PortfolioSurface
                          event={selectedEvent}
                          view={portfolioView}
                          onViewChange={(value) => setPortfolioView(value as typeof portfolioView)}
                          canManageEvents={canManageEvents}
                          label={logisticsLabel}
                          setLabel={setLogisticsLabel}
                          assigneeId={logisticsAssigneeId}
                          setAssigneeId={setLogisticsAssigneeId}
                          collaboratorPeople={collaboratorPeople}
                          onAdd={addLogisticsItem}
                          onUpdate={updateLogisticsItem}
                          onDelete={deleteLogisticsItem}
                          onAssignOwner={assignPortfolioOwner}
                          onAddTeamMember={addPortfolioTeamMember}
                          onCreatePortfolio={createPortfolio}
                          onRenamePortfolio={renamePortfolio}
                          onDeletePortfolio={deletePortfolio}
                          budgetProps={{
                            spent: selectedEventSpent,
                            remaining: selectedEventBudgetRemaining,
                            expectedRevenue: selectedEventExpectedParticipantRevenue,
                            expenseTitle,
                            setExpenseTitle,
                            expenseCategory,
                            setExpenseCategory,
                            expenseAmount,
                            setExpenseAmount,
                            expensePaidById,
                            setExpensePaidById,
                            expenseNotes,
                            setExpenseNotes,
                            onAddExpense: addExpense,
                            onDeleteExpense: deleteExpense,
                            onUpdateRegistration: updateRegistration,
                          }}
                        />
                      </WorkspacePanel>
                    )}
                  </div>
                )}

                {workspaceTab === "registrations" && (
                  <div className="space-y-4">
                    <SubTabs value={peopleView} onChange={(value) => setPeopleView(value as typeof peopleView)} items={["participants", "readiness"]} />
                    {peopleView === "readiness" ? (
                      <WorkspacePanel title="Registration Readiness" icon={AlertTriangle}>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {readinessBuckets.map((bucket) => (
                            <div key={bucket.label} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/55 px-3 py-3">
                              <span className="text-sm font-bold">{bucket.label}</span>
                              <span className="text-lg font-extrabold text-brand-teal">{bucket.count}</span>
                            </div>
                          ))}
                        </div>
                      </WorkspacePanel>
                    ) : (
                      <WorkspacePanel title="Registrations" icon={ClipboardCheck}>
                        <ParticipantTable
                          event={selectedEvent}
                          canManageEvents={canManageEvents}
                          onUpdate={updateRegistration}
                          onUpdateWithStatusSync={updateRegistrationWithStatusSync}
                          onRemove={removeRegistration}
                          onAdd={() => setParticipantOpen(true)}
                          onConnectSheet={() => setSheetConnectOpen(true)}
                          onSyncSheet={syncGoogleSheetConnection}
                          onResetSheetData={resetGoogleSheetImportData}
                          onRemoveSheet={removeGoogleSheetConnection}
                          onUpdateSheetSettings={updateGoogleSheetConnectionSettings}
                          onAddCustomColumn={addCustomRegistrationColumn}
                          onUpdateCustomColumn={updateCustomRegistrationColumn}
                          onDeleteCustomColumn={deleteCustomRegistrationColumn}
                          onCreateHostedForm={createHostedRegistrationForm}
                          onGenerateGoogleFormTemplate={generateGoogleFormTemplate}
                          onEnablePayments={enableManualPaymentConfig}
                          syncingSheetId={syncingSheetId}
                        />
                      </WorkspacePanel>
                    )}
                  </div>
                )}

                {workspaceTab === "budget" && (
                  <WorkspacePanel title="Budget & Finance" icon={DollarSign}>
                    <BudgetSurface
                      event={selectedEvent}
                      spent={selectedEventSpent}
                      remaining={selectedEventBudgetRemaining}
                      expectedRevenue={selectedEventExpectedParticipantRevenue}
                      canManageEvents={canManageEvents}
                      expenseTitle={expenseTitle}
                      setExpenseTitle={setExpenseTitle}
                      expenseCategory={expenseCategory}
                      setExpenseCategory={setExpenseCategory}
                      expenseAmount={expenseAmount}
                      setExpenseAmount={setExpenseAmount}
                      expensePaidById={expensePaidById}
                      setExpensePaidById={setExpensePaidById}
                      expenseNotes={expenseNotes}
                      setExpenseNotes={setExpenseNotes}
                      collaboratorPeople={collaboratorPeople}
                      onAddExpense={addExpense}
                      onDeleteExpense={deleteExpense}
                      onUpdateRegistration={updateRegistration}
                    />
                  </WorkspacePanel>
                )}

                {workspaceTab === "communication" && (
                  <WorkspacePanel title="Communication Plan" icon={Send}>
                    <CommunicationSurface event={selectedEvent} collaboratorPeople={collaboratorPeople} canManageEvents={canManageEvents} />
                  </WorkspacePanel>
                )}

                {workspaceTab === "files" && (
                  <WorkspacePanel title="Files" icon={FileText}>
                    <FilesSurface
                      event={selectedEvent}
                      canManageEvents={canManageEvents}
                      onCreateHostedForm={createHostedRegistrationForm}
                      onGenerateGoogleFormTemplate={generateGoogleFormTemplate}
                      onConnectSheet={() => setSheetConnectOpen(true)}
                      onSyncSheet={syncGoogleSheetConnection}
                      syncingSheetId={syncingSheetId}
                    />
                    </WorkspacePanel>
                )}
              </div>
            </Card>
          </section>
        )}

        <div className="hidden">
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
                      <p className="label-eyebrow">Portfolios</p>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {selectedEvent.logistics.filter((item) => item.status === "Done").length}/{selectedEvent.logistics.length} done
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <Input
                        value={logisticsLabel}
                        onChange={(event) => setLogisticsLabel(event.target.value)}
                        placeholder="Add portfolio item..."
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
                          <option value="">No owner</option>
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
                              <option value="">No owner</option>
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
      </div>

      <ResponsiveModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingId(null);
            setEventFormStep(0);
          }
        }}
        title={editingId ? "Edit Event" : "Create Event"}
        description={editingId ? "Update the event setup without leaving the workspace." : "Start with the essentials, then choose the planning shape this event needs."}
        className="max-h-[92svh] max-w-3xl overflow-y-auto rounded-xl"
        bodyClassName="space-y-4"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {["Basics", "Starting Point", "Planning"].map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setEventFormStep(index)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition",
                eventFormStep === index
                  ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                  : "border-border/70 bg-background/60 text-muted-foreground hover:border-brand-teal/25"
              )}
            >
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em]">Step {index + 1}</span>
              <span className="mt-0.5 block text-sm font-extrabold">{step}</span>
            </button>
          ))}
        </div>

        {eventFormStep === 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-bold text-muted-foreground">Event Name</span>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Summer Camp 2026"
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
                <span className="text-xs font-bold text-muted-foreground">Event Leader</span>
                <Input
                  value={form.owner}
                  onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                  placeholder="Owner or lead team"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
            </div>
          </div>
        )}

        {eventFormStep === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { id: "template", title: "Start from template", body: "Use a structure for camps, trips, retreats, outreaches, and conferences." },
                { id: "duplicate", title: "Duplicate previous", body: "Best for recurring annual events with familiar planning needs." },
                { id: "scratch", title: "Start from scratch", body: "Create a quiet workspace with only the defaults enabled." },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setEventStartingPoint(option.id as typeof eventStartingPoint)}
                  className={cn(
                    "min-h-36 rounded-xl border p-4 text-left transition",
                    eventStartingPoint === option.id
                      ? "border-brand-teal/35 bg-brand-teal/10"
                      : "border-border/70 bg-background/60 hover:border-brand-teal/25"
                  )}
                >
                  <span className="text-sm font-extrabold">{option.title}</span>
                  <span className="mt-2 block text-xs font-medium leading-5 text-muted-foreground">{option.body}</span>
                </button>
              ))}
            </div>

            {eventStartingPoint === "duplicate" && (
              <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Choose previous event</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {events.length === 0 && (
                    <div className="actsix-empty-state min-h-20 text-sm sm:col-span-2">
                      No previous events are available to duplicate yet.
                    </div>
                  )}
                  {events.slice(0, 6).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => duplicateEventSetup(event.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        duplicateSourceId === event.id
                          ? "border-brand-teal/35 bg-brand-teal/10"
                          : "border-border/70 bg-card/70 hover:border-brand-teal/25"
                      )}
                    >
                      <p className="truncate text-sm font-extrabold">{event.title}</p>
                      <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                        {event.type} · {event.location || "No location"}
                      </p>
                    </button>
                  ))}
                </div>
                {duplicateSourceId && (
                  <p className="mt-3 text-xs font-bold text-brand-teal">
                    Setup copied. Update the name and dates before creating the new event.
                  </p>
                )}
              </div>
            )}

            {eventStartingPoint === "template" && (
              <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Suggested Template</p>
                <p className="mt-1 text-sm font-bold">{form.type}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  ACTSIX will seed the event with starter checklist and portfolio sections using the current event defaults.
                </p>
              </div>
            )}
          </div>
        )}

        {eventFormStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/10 p-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-teal">Core portfolios enabled</p>
              <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                Leadership, Programme, People, Finance, Comms, Safety, and Follow-up.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["volunteersTeams", "Teams", "Recruitment, team assignments, briefings, rostering, and availability."],
                ["venueAccommodation", "Venue", "Venue booking, room allocation, site requirements, and setup areas."],
                ["transportTravel", "Travel", "Vehicles, drivers, passenger allocations, routes, visas, and travel schedules."],
                ["cateringHospitality", "Hospitality", "Meals, refreshments, catering providers, dietary needs, and guest care."],
                ["equipmentResources", "Equipment", "Sound, lighting, staging, furniture, supplies, and borrowed equipment."],
              ].map(([id, label, help]) => {
                const active = eventPlanningConfig[id as keyof typeof eventPlanningConfig];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setEventPlanningConfig((current) => ({
                        ...current,
                        [id]: !current[id as keyof typeof eventPlanningConfig],
                      }))
                    }
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      active
                        ? "border-brand-teal/35 bg-brand-teal/10"
                        : "border-border/70 bg-background/60 hover:border-brand-teal/25"
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold">{label}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-brand-teal" : "bg-muted-foreground/30")} />
                    </span>
                    <span className="mt-1 block text-xs font-medium leading-5 text-muted-foreground">{help}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-border/60 bg-background/45 p-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Capacity and money</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Capacity</span>
                  <Input type="number" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: Number(event.target.value) }))} className="h-9 rounded-xl bg-background" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Budget</span>
                  <Input type="number" value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: Number(event.target.value) }))} className="h-9 rounded-xl bg-background" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Cost Per Person</span>
                  <Input type="number" value={form.costPerPerson} onChange={(event) => setForm((current) => ({ ...current, costPerPerson: Number(event.target.value) }))} className="h-9 rounded-xl bg-background" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Funds Received</span>
                  <Input type="number" value={form.received} onChange={(event) => setForm((current) => ({ ...current, received: Number(event.target.value) }))} className="h-9 rounded-xl bg-background" />
                </label>
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
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="outline"
            className="actsix-btn-outline h-9 rounded-xl"
            onClick={() => (eventFormStep === 0 ? setFormOpen(false) : setEventFormStep((step) => Math.max(0, step - 1)))}
          >
            {eventFormStep === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {eventFormStep < 2 ? (
              <Button
                type="button"
                className="actsix-btn-primary h-9 rounded-xl"
                onClick={() => setEventFormStep((step) => Math.min(2, step + 1))}
                disabled={!form.title.trim() || (eventFormStep === 1 && eventStartingPoint === "duplicate" && !duplicateSourceId)}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                className="actsix-btn-primary h-9 rounded-xl"
                onClick={saveEvent}
                disabled={saving || !canManageEvents}
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Create event"}
              </Button>
            )}
          </div>
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

      <GoogleSheetConnectionModal
        open={sheetConnectOpen}
        onOpenChange={setSheetConnectOpen}
        event={selectedEvent}
        onSave={saveGoogleSheetConnection}
      />

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

function EventCard({ event }: { event: EventItem }) {
  const done = event.checklist.filter((item) => item.done).length;
  const readiness = percent(done, event.checklist.length);
  const missingForms = event.registrations.filter(
    (registration) => !registration.medicalFormReceived || !registration.consentFormReceived
  ).length;
  const warning = missingForms
    ? `${missingForms} form${missingForms === 1 ? "" : "s"} outstanding`
    : event.expenses.reduce((sum, expense) => sum + expense.amount, 0) > event.budget && event.budget
      ? "Budget needs review"
      : event.logistics.some((item) => item.status !== "Done")
        ? "Portfolios still open"
        : "";

  return (
    <Link
      to={`/events/${event.id}`}
      className="block rounded-xl border border-border/70 bg-background/60 p-3 transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold">{event.title}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {event.type} · {event.startsAt} · {event.location || "Location needed"}
          </p>
        </div>
        <Badge variant="outline" className={cn("rounded-full text-[10px] font-bold", statusStyles[event.status])}>
          {event.status}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
        <span>{event.registrations.length}/{event.capacity || 0} participants</span>
        <span>{readiness}% planned</span>
      </div>
      {warning && <p className="mt-2 truncate text-xs font-extrabold text-brand-amber">{warning}</p>}
    </Link>
  );
}

function HealthTile({
  label,
  value,
  progress,
  invert,
}: {
  label: string;
  value: string | number;
  progress: number;
  invert?: boolean;
}) {
  const displayProgress = invert ? 100 - progress : progress;
  return (
    <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold">{value}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-teal" style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }} />
      </div>
    </div>
  );
}

function QuietStatusRow({
  title,
  label,
  value,
  detail,
  onClick,
}: {
  title?: string;
  label: string;
  value: string | number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="grid gap-1 rounded-lg px-2 py-2 text-left transition hover:bg-card/70 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-extrabold text-foreground">{value}</span>
      <span className="text-xs font-semibold text-muted-foreground sm:text-right">{detail}</span>
    </button>
  );
}

function WorkspacePanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Tent;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-background/45 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-extrabold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function HealthRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-card/70 px-3 py-2">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </div>
  );
}

function RegistrationMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
  tone: "teal" | "sage" | "amber" | "neutral";
}) {
  const toneClass = {
    teal: "border-brand-teal/20 bg-brand-teal/5 text-brand-teal",
    sage: "border-brand-sage/20 bg-brand-sage/10 text-brand-sage",
    amber: "border-brand-amber/25 bg-brand-amber/10 text-brand-amber",
    neutral: "border-border/70 bg-card/80 text-muted-foreground",
  }[tone];

  return (
    <div className="rounded-xl border border-border/60 bg-card/90 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-2xl font-extrabold leading-none tracking-tight">{value}</span>
      </div>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ProgressCard({ label, detail, value }: { label: string; detail: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold">{label}</p>
        <span className="text-sm font-extrabold text-brand-teal">{value}%</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-teal" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SubTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "h-8 rounded-full border px-3 text-xs font-extrabold capitalize transition",
            value === item
              ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
              : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:text-brand-teal"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

const defaultRegistrationColumns: EventRegistrationColumn[] = [
  { id: "participant", label: "Participant", fieldType: "system", origin: "system", sortOrder: 0 },
  { id: "contact", label: "Email / mobile", fieldType: "system", origin: "system", sortOrder: 1 },
  { id: "registration", label: "Registration status", fieldType: "system", origin: "system", sortOrder: 2 },
  { id: "source", label: "Source", fieldType: "system", origin: "system", sortOrder: 3 },
  { id: "linked-person", label: "Linked ACTSIX person", fieldType: "system", origin: "system", sortOrder: 4 },
  { id: "created", label: "Created date", fieldType: "system", origin: "system", sortOrder: 5 },
  { id: "payment", label: "Payment", fieldType: "standard", origin: "system", sortOrder: 6 },
  { id: "forms", label: "Forms", fieldType: "standard", origin: "system", sortOrder: 7 },
  { id: "readiness", label: "Readiness", fieldType: "system", origin: "system", sortOrder: 8 },
  { id: "transport", label: "Transport", fieldType: "standard", origin: "system", sortOrder: 9 },
];

const registrationColumnValue = (
  registration: EventRegistration,
  column: EventRegistrationColumn,
  sourceLabel: (registration: EventRegistration) => string
) => {
  const label = column.label.toLowerCase();
  if (label.includes("first name") || label === "name" || label.includes("full name") || label.includes("participant")) {
    return registration.person?.display_name || registration.importedDisplayName || "";
  }
  if (label.includes("email") || label.includes("mobile") || label.includes("contact")) {
    return registration.person?.email || registration.importedEmail || registration.person?.phone_number || registration.importedMobile || "";
  }
  if (label.includes("surname")) return registration.importedDisplayName?.split(" ").slice(1).join(" ") || "";
  if (label.includes("linked")) return registration.person ? "Linked" : "Unlinked";
  if (label.includes("created")) return registration.createdAt ? formatShortDate(new Date(registration.createdAt)) : "";
  if (label.includes("status") || label.includes("registration")) return registration.status;
  if (label.includes("payment")) return registration.amountDue > registration.amountPaid ? `${money(registration.amountDue - registration.amountPaid)} due` : "Paid";
  if (label.includes("forms")) {
    const missing = [
      !registration.consentFormReceived ? "Consent" : "",
      !registration.medicalFormReceived ? "Medical" : "",
    ].filter(Boolean);
    return missing.length ? `${missing.join(", ")} missing` : "Received";
  }
  if (label.includes("readiness")) {
    const ready =
      registration.status !== "Cancelled" &&
      registration.amountDue <= registration.amountPaid &&
      registration.medicalFormReceived &&
      registration.consentFormReceived;
    return ready ? "Ready" : "Incomplete";
  }
  if (label.includes("source")) return sourceLabel(registration);
  if (label.includes("consent")) return registration.consentFormReceived ? "Received" : "Missing";
  if (label.includes("medical")) return registration.medicalFormReceived ? "Received" : "Missing";
  if (label.includes("transport")) return registration.transportNeeded ? "Needed" : "Not marked";
  if (label.includes("emergency")) return registration.emergencyContact || "";
  return registration.customFields?.[column.label] || registration.customFields?.[column.sourceColumn || ""] || "";
};

function ParticipantTable({
  event,
  canManageEvents,
  onUpdate,
  onUpdateWithStatusSync,
  onRemove,
  onAdd,
  onConnectSheet,
  onSyncSheet,
  onResetSheetData,
  onRemoveSheet,
  onUpdateSheetSettings,
  onAddCustomColumn,
  onUpdateCustomColumn,
  onDeleteCustomColumn,
  onCreateHostedForm,
  onGenerateGoogleFormTemplate,
  onEnablePayments,
  syncingSheetId,
}: {
  event: EventItem;
  canManageEvents: boolean;
  onUpdate: (registrationId: string, updates: Record<string, any>) => void;
  onUpdateWithStatusSync: (registration: EventRegistration, updates: Record<string, any>) => void;
  onRemove: (registrationId: string) => void;
  onAdd: () => void;
  onConnectSheet: () => void;
  onSyncSheet: (connectionId?: string) => void;
  onResetSheetData: (connectionId?: string) => void;
  onRemoveSheet: (connectionId?: string) => void;
  onUpdateSheetSettings: (connectionId: string, updates: Record<string, any>) => void;
  onAddCustomColumn: (label: string) => void;
  onUpdateCustomColumn: (columnId: string, updates: { label?: string; sort_order?: number }) => void;
  onDeleteCustomColumn: (columnId: string) => void;
  onCreateHostedForm: () => void;
  onGenerateGoogleFormTemplate: () => void;
  onEnablePayments: () => void;
  syncingSheetId: string;
}) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [registrationView, setRegistrationView] = useState("All Registrations");
  const [registrationGroup, setRegistrationGroup] = useState("None");
  const [filterColumnId, setFilterColumnId] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [sortColumnId, setSortColumnId] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [customColumnTitle, setCustomColumnTitle] = useState("");
  const [columnToolsOpen, setColumnToolsOpen] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState("");
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const readyCount = event.registrations.filter(
    (registration) =>
      registration.status !== "Cancelled" &&
      registration.amountDue <= registration.amountPaid &&
      registration.medicalFormReceived &&
      registration.consentFormReceived
  ).length;
  const missingPayment = event.registrations.filter((registration) => registration.amountDue > registration.amountPaid).length;
  const missingConsent = event.registrations.filter((registration) => !registration.consentFormReceived).length;
  const missingEmergency = event.registrations.filter((registration) => !registration.emergencyContact).length;
  const reviewCount = event.registrations.filter((registration) => !registration.person).length;
  const importedCount = event.registrations.filter((registration) => registration.source === "google_sheets").length;
  const readyPercent = percent(readyCount, event.registrations.length);
  const sheetConnection = event.sheetConnections[0];
  const allColumns = useMemo(() => {
    const customColumns = event.registrationColumns
      .map((column) => ({ ...column, origin: column.origin || "custom_field" as const }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    return [...defaultRegistrationColumns, ...customColumns].filter(
      (column, index, columns) => columns.findIndex((candidate) => candidate.label.toLowerCase() === column.label.toLowerCase()) === index
    );
  }, [event.registrationColumns]);
  useEffect(() => {
    setColumnOrder((current) => {
      const nextIds = allColumns.map((column) => column.id);
      const kept = current.filter((id) => nextIds.includes(id));
      const added = nextIds.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
    setHiddenColumnIds((current) => current.filter((id) => allColumns.some((column) => column.id === id && column.origin !== "system")));
  }, [allColumns]);
  const orderedColumns = (columnOrder.length ? columnOrder : allColumns.map((column) => column.id))
    .map((id) => allColumns.find((column) => column.id === id))
    .filter(Boolean) as EventRegistrationColumn[];
  const displayColumns = orderedColumns.filter((column) => column.origin === "system" || !hiddenColumnIds.includes(column.id));
  const latestRuns = sheetConnection
    ? event.importRuns.filter((run) => run.connectionId === sheetConnection.id).slice(0, 5)
    : event.importRuns.slice(0, 5);
  const latestIssues = sheetConnection
    ? event.importIssues.filter((issue) => issue.connectionId === sheetConnection.id).slice(0, 4)
    : event.importIssues.slice(0, 4);
  const latestAuditLogs = sheetConnection
    ? event.syncAuditLogs.filter((log) => log.connectionId === sheetConnection.id).slice(0, 5)
    : event.syncAuditLogs.slice(0, 5);
  const hostedForm = event.registrationForms.find((form) => form.formType === "actsix_hosted" && form.status === "published");
  const googleTemplate = event.registrationForms.find((form) => form.formType === "google_form_template");
  const pendingApprovals = event.registrations.filter((registration) => registration.approvalStatus === "pending").length;
  const queuedStatusUpdates = event.statusSyncQueue.filter((item) => item.status === "queued").length;
  const hostedFormUrl = hostedForm
    ? `${window.location.origin}/register/${hostedForm.publicToken}`
    : "";
  const sourceLabel = (registration: EventRegistration) =>
    registration.source === "google_sheets" ? "Google Sheet" : "Manual";
  const isReady = (registration: EventRegistration) =>
    registration.status !== "Cancelled" &&
    registration.amountDue <= registration.amountPaid &&
    registration.medicalFormReceived &&
    registration.consentFormReceived;
  const selectedFilterColumn = allColumns.find((column) => column.id === filterColumnId);
  const viewDefinitions = [
    { label: "All Registrations", group: "None" },
    { label: "Readiness", group: "Readiness" },
    { label: "Payments", group: "Payment" },
    { label: "Medical and Dietary", group: "Readiness" },
    { label: "Transport", group: "None" },
    { label: "Custom View", group: registrationGroup },
  ];
  const activeView = viewDefinitions.find((view) => view.label === registrationView) || viewDefinitions[0];
  const viewColumns =
    registrationView === "Payments"
      ? displayColumns.filter((column) => ["participant", "contact", "registration", "payment", "source"].includes(column.id) || column.label.toLowerCase().includes("payment"))
      : registrationView === "Medical and Dietary"
        ? displayColumns.filter((column) => ["participant", "contact", "forms", "readiness"].includes(column.id) || /medical|diet|allergy|consent|emergency/i.test(column.label))
        : registrationView === "Transport"
          ? displayColumns.filter((column) => ["participant", "contact", "registration", "transport", "source"].includes(column.id) || /transport|travel|pickup/i.test(column.label))
          : displayColumns;
  const matchesViewFilter = (registration: EventRegistration) => {
    if (registrationView === "Payments") return registration.amountDue > 0 || registration.paymentStatus !== "not_required";
    if (registrationView === "Medical and Dietary") return !registration.medicalFormReceived || !registration.consentFormReceived || Boolean(registration.emergencyContact);
    if (registrationView === "Transport") return registration.transportNeeded;
    return true;
  };
  const matchesContentFilter = (registration: EventRegistration) => {
    const term = filterValue.trim().toLowerCase();
    if (!term) return true;
    const columnsToSearch = selectedFilterColumn ? [selectedFilterColumn] : viewColumns;
    return columnsToSearch.some((column) =>
      registrationColumnValue(registration, column, sourceLabel).toString().toLowerCase().includes(term)
    );
  };
  const handleSortColumn = (columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
      return;
    }
    setSortColumnId(columnId);
    setSortDirection("asc");
  };
  const filteredRegistrations = event.registrations.filter((registration) => matchesViewFilter(registration) && matchesContentFilter(registration));
  const sortedRegistrations = sortColumnId
    ? [...filteredRegistrations].sort((firstRegistration, secondRegistration) => {
        const column = viewColumns.find((item) => item.id === sortColumnId) || allColumns.find((item) => item.id === sortColumnId);
        if (!column) return 0;
        const first = registrationColumnValue(firstRegistration, column, sourceLabel).toString();
        const second = registrationColumnValue(secondRegistration, column, sourceLabel).toString();
        const result = first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" });
        return sortDirection === "asc" ? result : -result;
      })
    : filteredRegistrations;
  const groupedRegistrations = sortedRegistrations.reduce<Record<string, EventRegistration[]>>((acc, registration) => {
    const balance = Math.max(0, registration.amountDue - registration.amountPaid);
    const key =
      activeView.group === "Readiness"
        ? isReady(registration) ? "Ready" : "Incomplete"
        : activeView.group === "Source"
          ? sourceLabel(registration)
          : activeView.group === "Payment"
            ? balance > 0 ? "Payment outstanding" : "Paid"
            : activeView.group === "Status"
              ? registration.status
              : "All registrations";
    acc[key] = [...(acc[key] || []), registration];
    return acc;
  }, {});
  const registrationGroups = Object.entries(groupedRegistrations);
  const updateConnection = (updates: Record<string, any>) => {
    if (!sheetConnection) return;
    onUpdateSheetSettings(sheetConnection.id, updates);
  };
  const toggleConnectionJsonSetting = (column: "notification_settings" | "person_matching_rules" | "readiness_rules", current: Record<string, boolean>, key: string) => {
    updateConnection({ [column]: { ...current, [key]: !current[key] } });
  };
  const sourceKindLabel = sheetConnection?.sourceKind === "google_form" ? "Google Form responses" : sheetConnection?.sourceKind === "google_sheet" ? "Google Sheet" : "Not detected";
  const showAdvancedRegistrationTools = false;
  const systemColumnIds = new Set(defaultRegistrationColumns.map((column) => column.id));
  const exportCurrentView = () => {
    const escapeCell = (value: string | number) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      viewColumns.map((column) => escapeCell(column.label)).join(","),
      ...sortedRegistrations.map((registration) =>
        viewColumns.map((column) => escapeCell(registrationColumnValue(registration, column, sourceLabel))).join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "event"}-${registrationView.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const moveColumn = (columnId: string, direction: -1 | 1) => {
    setColumnOrder((current) => {
      const ids = current.length ? current : allColumns.map((column) => column.id);
      const index = ids.indexOf(columnId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return ids;
      const next = [...ids];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      const column = allColumns.find((candidate) => candidate.id === columnId);
      if (column?.origin === "custom_field") onUpdateCustomColumn(column.id, { sort_order: nextIndex });
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border/70 bg-card/85 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold tracking-tight">Registration workspace</h3>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {event.registrations.length} total · {readyCount} ready · {reviewCount} need review
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sheetConnection && (
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => onSyncSheet(sheetConnection.id)}
                disabled={!canManageEvents || syncingSheetId === sheetConnection.id}
              >
                {syncingSheetId === sheetConnection.id ? "Syncing..." : "Sync Sheet"}
              </Button>
            )}
            {!sheetConnection && (
              <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onConnectSheet} disabled={!canManageEvents}>
                Connect Sheet
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => {
                if (hostedFormUrl) {
                  navigator.clipboard?.writeText(hostedFormUrl);
                  toast.success("Hosted form link copied.");
                  return;
                }
                onCreateHostedForm();
              }}
              disabled={!canManageEvents}
            >
              {hostedForm ? "Form Live" : "Publish Form"}
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onEnablePayments} disabled={!canManageEvents}>
              Payments
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onGenerateGoogleFormTemplate} disabled={!canManageEvents}>
              Google Form
            </Button>
            <div className="relative">
            <Button
              type="button"
              className="actsix-btn-primary h-8 rounded-full px-3 text-xs"
              onClick={() => setActionMenuOpen((open) => !open)}
              disabled={!canManageEvents}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
            {actionMenuOpen && (
              <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-border/70 bg-card p-2 shadow-lg">
                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-muted/70" onClick={() => { setActionMenuOpen(false); onAdd(); }}>
                  Add manually
                </button>
                <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-muted/70" onClick={() => { setActionMenuOpen(false); onConnectSheet(); }}>
                  Connect Google Sheet
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-muted/70"
                  onClick={() => {
                    setActionMenuOpen(false);
                    if (hostedFormUrl) {
                      navigator.clipboard?.writeText(hostedFormUrl);
                      toast.success("Hosted form link copied.");
                      return;
                    }
                    onCreateHostedForm();
                  }}
                >
                  {hostedForm ? "Copy hosted form link" : "Publish ACTSIX form"}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex flex-wrap gap-2">
            {viewDefinitions.map((view) => (
              <button
                key={view.label}
                type="button"
                onClick={() => {
                  setRegistrationView(view.label);
                  if (view.label !== "Custom View") setRegistrationGroup(view.group);
                  setFilterColumnId("");
                  setFilterValue("");
                }}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-extrabold transition",
                  registrationView === view.label
                    ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:border-brand-teal/25 hover:text-brand-teal"
                )}
              >
                {view.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => setColumnToolsOpen((open) => !open)}>
              <ListChecks className="h-3.5 w-3.5" />
              Columns
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={exportCurrentView} disabled={sortedRegistrations.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl border border-border/70 bg-background/45 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold">{sheetConnection?.spreadsheetName || "No spreadsheet connected"}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {sheetConnection
                  ? `${sheetConnection.worksheetName} · ${sheetConnection.syncMode === "one_time" ? "One-time" : sheetConnection.syncMode} · last synced ${sheetConnection.lastSyncedAt ? formatShortDate(new Date(sheetConnection.lastSyncedAt)) : "never"}`
                  : "Use a hosted form, Google Sheet, or manual entry to collect registrations."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sheetConnection && (
                <>
                  <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => onSyncSheet(sheetConnection.id)} disabled={!canManageEvents || syncingSheetId === sheetConnection.id}>
                    {syncingSheetId === sheetConnection.id ? "Syncing..." : "Sync Now"}
                  </Button>
                  <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onConnectSheet} disabled={!canManageEvents}>
                    Edit Mapping
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-destructive" onClick={() => onRemoveSheet(sheetConnection.id)} disabled={!canManageEvents || syncingSheetId === sheetConnection.id}>
                    Disconnect
                  </Button>
                </>
              )}
              {!sheetConnection && (
                <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onConnectSheet} disabled={!canManageEvents}>
                  Connect Google Sheet
                </Button>
              )}
            </div>
          </div>
          {sheetConnection && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <HealthRow label="Rows imported" value={sheetConnection.rowsImported} />
              <HealthRow label="Needs review" value={sheetConnection.rowsRequiringReview} />
              <HealthRow label="Sync status" value={sheetConnection.status} />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/70 bg-background/45 p-3">
          <p className="text-sm font-extrabold">Registration form</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {hostedForm ? "ACTSIX form is published and ready to share." : "Create an ACTSIX registration form for a shareable link."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-8 rounded-full px-3 text-xs"
            onClick={() => {
              if (hostedFormUrl) {
                navigator.clipboard?.writeText(hostedFormUrl);
                toast.success("Hosted form link copied.");
                return;
              }
              onCreateHostedForm();
            }}
            disabled={!canManageEvents}
          >
            {hostedForm ? "Copy Registration Link" : "Create Form"}
          </Button>
        </div>
      </section>

      {columnToolsOpen && (
        <section className="rounded-xl border border-border/70 bg-card/85 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold">Columns</h4>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                System columns are always visible. Custom ACTSIX columns can be renamed, moved, hidden, or deleted.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={customColumnTitle}
                onChange={(event) => setCustomColumnTitle(event.target.value)}
                placeholder="Add custom column"
                className="h-8 w-48 rounded-xl bg-background text-xs"
              />
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => {
                  onAddCustomColumn(customColumnTitle);
                  setCustomColumnTitle("");
                }}
                disabled={!canManageEvents || !customColumnTitle.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {orderedColumns.map((column, index) => {
              const isSystem = systemColumnIds.has(column.id) || column.origin === "system";
              const hidden = hiddenColumnIds.includes(column.id);
              const isEditing = editingColumnId === column.id;
              return (
                <div key={column.id} className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            onUpdateCustomColumn(column.id, { label: editingColumnLabel.trim() || column.label });
                            setEditingColumnId("");
                            setEditingColumnLabel("");
                          }}
                        >
                          <Input
                            value={editingColumnLabel}
                            onChange={(event) => setEditingColumnLabel(event.target.value)}
                            className="h-8 rounded-lg bg-card text-xs"
                            autoFocus
                          />
                          <Button type="submit" variant="outline" className="h-8 rounded-lg px-2 text-xs" disabled={!editingColumnLabel.trim()}>
                            Save
                          </Button>
                        </form>
                      ) : (
                        <>
                          <p className="truncate text-sm font-extrabold">{column.label}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            {isSystem ? "System" : column.origin === "sheet_mapping" ? "Sheet mapping" : "Custom"}
                          </p>
                        </>
                      )}
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 rounded-full text-[10px] font-bold", hidden && "text-muted-foreground")}>
                      {hidden ? "Hidden" : "Visible"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-[11px]" onClick={() => moveColumn(column.id, -1)} disabled={index === 0}>
                      Up
                    </Button>
                    <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-[11px]" onClick={() => moveColumn(column.id, 1)} disabled={index === orderedColumns.length - 1}>
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 rounded-full px-2 text-[11px]"
                      onClick={() =>
                        setHiddenColumnIds((current) =>
                          current.includes(column.id) ? current.filter((id) => id !== column.id) : [...current, column.id]
                        )
                      }
                      disabled={isSystem}
                    >
                      {hidden ? "Show" : "Hide"}
                    </Button>
                    {column.origin === "custom_field" && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={() => {
                            setEditingColumnId(column.id);
                            setEditingColumnLabel(column.label);
                          }}
                        >
                          Rename
                        </Button>
                        <Button type="button" variant="ghost" className="h-7 rounded-full px-2 text-[11px] text-muted-foreground hover:text-destructive" onClick={() => onDeleteCustomColumn(column.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showAdvancedRegistrationTools && sheetConnection && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-teal">Phase 2 sync controls</p>
                <h3 className="mt-1 text-base font-extrabold">Automation and registration rules</h3>
                <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                  Control scheduled sync, matching, readiness, notifications, and simple column transformations.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full border-brand-teal/20 bg-brand-teal/10 text-[11px] font-extrabold text-brand-teal">
                {sourceKindLabel}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-extrabold">Scheduled sync</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                  {sheetConnection.automaticSyncEnabled
                    ? `Every ${sheetConnection.syncFrequencyMinutes || 60} minutes. Next: ${sheetConnection.nextSyncAt ? formatShortDate(new Date(sheetConnection.nextSyncAt)) : "queued"}`
                    : "Manual sync only."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => updateConnection({
                      automatic_sync_enabled: !sheetConnection.automaticSyncEnabled,
                      sync_mode: sheetConnection.automaticSyncEnabled ? "manual" : "automatic",
                      sync_frequency_minutes: sheetConnection.automaticSyncEnabled ? null : 60,
                      next_sync_at: sheetConnection.automaticSyncEnabled ? null : new Date(Date.now() + 60 * 60_000).toISOString(),
                    })}
                  >
                    {sheetConnection.automaticSyncEnabled ? "Pause schedule" : "Enable hourly"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-extrabold">Person matching</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["email", "Email"],
                    ["mobile", "Mobile"],
                    ["name", "Name"],
                    ["auto_link_confident_matches", "Auto-link"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleConnectionJsonSetting("person_matching_rules", sheetConnection.personMatchingRules || {}, key)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-extrabold transition",
                        (sheetConnection.personMatchingRules || {})[key] !== false
                          ? "border-brand-teal/25 bg-brand-teal/10 text-brand-teal"
                          : "border-border/70 text-muted-foreground hover:text-brand-teal"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-extrabold">Notifications</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["new_registrations", "New rows"],
                    ["review_required", "Review"],
                    ["sync_failed", "Failures"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleConnectionJsonSetting("notification_settings", sheetConnection.notificationSettings || {}, key)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-extrabold transition",
                        (sheetConnection.notificationSettings || {})[key] !== false
                          ? "border-brand-sage/25 bg-brand-sage/10 text-brand-sage"
                          : "border-border/70 text-muted-foreground hover:text-brand-teal"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-extrabold">Readiness rules</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["require_consent", "Consent"],
                    ["require_medical", "Medical"],
                    ["require_payment", "Payment"],
                    ["require_emergency_contact", "Emergency contact"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleConnectionJsonSetting("readiness_rules", sheetConnection.readinessRules || {}, key)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-extrabold transition",
                        (sheetConnection.readinessRules || {})[key] === true || (key === "require_consent" && (sheetConnection.readinessRules || {})[key] !== false)
                          ? "border-brand-amber/25 bg-brand-amber/10 text-brand-amber"
                          : "border-border/70 text-muted-foreground hover:text-brand-teal"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-extrabold">Custom transformations</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Saved on mappings during setup. Supported sync transforms include title case, lower case, upper case, yes/no, and trim.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.registrationColumns.slice(0, 5).map((column) => (
                    <Badge key={column.id} variant="outline" className="rounded-full border-border/70 bg-card text-[11px] font-bold">
                      {column.label}
                    </Badge>
                  ))}
                  {event.registrationColumns.length === 0 && <span className="text-xs font-semibold text-muted-foreground">No mapped columns yet.</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
              <h3 className="text-sm font-extrabold">Import history</h3>
              <div className="mt-3 space-y-2">
                {latestRuns.map((run) => (
                  <div key={run.id} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold capitalize">{run.status}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">{formatShortDate(new Date(run.startedAt))}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {run.rowsImported} imported, {run.rowsSkipped} skipped, {run.rowsRequiringReview} review
                    </p>
                  </div>
                ))}
                {latestRuns.length === 0 && <p className="text-xs font-semibold text-muted-foreground">No import history yet.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
              <h3 className="text-sm font-extrabold">Sync audit log</h3>
              <div className="mt-3 space-y-2">
                {latestAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-extrabold">{log.action.replace(/_/g, " ")}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", log.severity === "error" ? "bg-destructive/10 text-destructive" : log.severity === "warning" ? "bg-brand-amber/10 text-brand-amber" : "bg-brand-teal/10 text-brand-teal")}>
                        {log.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{log.message}</p>
                  </div>
                ))}
                {latestAuditLogs.length === 0 && <p className="text-xs font-semibold text-muted-foreground">No audit events yet.</p>}
              </div>
            </div>

            {latestIssues.length > 0 && (
              <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/5 p-4 shadow-sm">
                <h3 className="text-sm font-extrabold text-brand-amber">Open import issues</h3>
                <div className="mt-3 space-y-2">
                  {latestIssues.map((issue) => (
                    <div key={issue.id} className="rounded-xl bg-card/80 px-3 py-2">
                      <p className="text-xs font-extrabold">{issue.title}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{issue.detail || issue.issueType}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {showAdvancedRegistrationTools && (
      <section className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-teal">Phase 3 registration experience</p>
            <h3 className="mt-1 text-base font-extrabold">Forms, payments, guardians, and approvals</h3>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-muted-foreground">
              Publish ACTSIX-hosted forms, generate a Google Form template spec, track guardian-facing records, and manage approval/payment workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onGenerateGoogleFormTemplate} disabled={!canManageEvents}>
              Google Form Template
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={onEnablePayments} disabled={!canManageEvents}>
              Enable Payments
            </Button>
            <Button type="button" className="actsix-btn-primary h-8 rounded-full px-3 text-xs" onClick={onCreateHostedForm} disabled={!canManageEvents || Boolean(hostedForm)}>
              {hostedForm ? "Hosted Form Live" : "Publish ACTSIX Form"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-sm font-extrabold">ACTSIX-hosted form</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              {hostedForm ? "Published and ready to share." : "Not published yet."}
            </p>
            {hostedFormUrl && (
              <button
                type="button"
                className="mt-2 truncate text-xs font-extrabold text-brand-teal"
                onClick={() => {
                  navigator.clipboard?.writeText(hostedFormUrl);
                  toast.success("Hosted form link copied.");
                }}
              >
                Copy hosted form link
              </button>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-sm font-extrabold">Google Form template</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              {googleTemplate ? `${googleTemplate.schema?.questions?.length || 0} question spec generated.` : "Generate a template spec to recreate in Google Forms."}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-sm font-extrabold">Payment integration</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              {event.paymentConfig ? `${event.paymentConfig.provider} payment workflow is ${event.paymentConfig.status}.` : "No payment workflow configured."}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-sm font-extrabold">Approvals and sync</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              {pendingApprovals} pending approvals. {queuedStatusUpdates} status updates queued.
            </p>
          </div>
        </div>
      </section>
      )}

      {showAdvancedRegistrationTools && (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <RegistrationMetricCard label="Ready" value={readyCount} detail="Confirmed, paid, and forms received" icon={CheckCircle2} tone="sage" />
        <RegistrationMetricCard label="Missing payment" value={missingPayment} detail="Payment still needs attention" icon={DollarSign} tone={missingPayment ? "amber" : "neutral"} />
        <RegistrationMetricCard label="Missing consent" value={missingConsent} detail="Consent form not received" icon={ShieldCheck} tone={missingConsent ? "amber" : "neutral"} />
        <RegistrationMetricCard label="Missing emergency" value={missingEmergency} detail="Emergency contact absent" icon={AlertTriangle} tone={missingEmergency ? "amber" : "neutral"} />
        <RegistrationMetricCard label="Needs review" value={reviewCount} detail="Unlinked or imported records" icon={Users} tone={reviewCount ? "teal" : "neutral"} />
      </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/85 p-3 shadow-sm">
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          Group by
          <select
            value={activeView.group}
            onChange={(event) => {
              setRegistrationView("Custom View");
              setRegistrationGroup(event.target.value);
            }}
            className="h-8 rounded-lg border border-border/70 bg-background px-2 text-xs font-bold text-foreground outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
          >
            <option>None</option>
            <option>Readiness</option>
            <option>Source</option>
            <option>Payment</option>
            <option>Status</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterColumnId}
            onChange={(event) => setFilterColumnId(event.target.value)}
            className="h-8 rounded-lg border border-border/70 bg-background px-2 text-xs font-bold text-foreground outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
          >
            <option value="">Any column</option>
            {viewColumns.map((column) => (
              <option key={column.id} value={column.id}>{column.label}</option>
            ))}
          </select>
          <Input
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder={selectedFilterColumn ? `${selectedFilterColumn.label} contains...` : "Column contains..."}
            className="h-8 w-56 rounded-lg bg-background text-xs font-semibold"
          />
          {(filterColumnId || filterValue) && (
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-full px-3 text-xs text-muted-foreground"
              onClick={() => {
                setFilterColumnId("");
                setFilterValue("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </section>

      {registrationGroups.map(([group, registrations]) => (
        <div key={group} className="space-y-2">
          {activeView.group !== "None" && (
            <div className="flex items-center justify-between rounded-xl bg-muted/45 px-3 py-2">
              <p className="text-sm font-extrabold">{group}</p>
              <span className="text-xs font-bold text-muted-foreground">{registrations.length} registration{registrations.length === 1 ? "" : "s"}</span>
            </div>
          )}
          <RegistrationRows
            registrations={registrations}
            columns={viewColumns}
            canManageEvents={canManageEvents}
            sourceLabel={sourceLabel}
            sortColumnId={sortColumnId}
            sortDirection={sortDirection}
            onSortColumn={handleSortColumn}
            onUpdate={onUpdate}
            onUpdateWithStatusSync={onUpdateWithStatusSync}
            onRemove={onRemove}
          />
        </div>
      ))}
      {event.registrations.length === 0 && <div className="actsix-empty-state mt-3 min-h-24 text-sm">No participants added yet.</div>}
      {event.registrations.length > 0 && filteredRegistrations.length === 0 && <div className="actsix-empty-state mt-3 min-h-24 text-sm">No registrations match this filter.</div>}
    </div>
  );
}

function RegistrationRows({
  registrations,
  columns,
  canManageEvents,
  sourceLabel,
  sortColumnId,
  sortDirection,
  onSortColumn,
  onUpdate,
  onUpdateWithStatusSync,
  onRemove,
}: {
  registrations: EventRegistration[];
  columns: EventRegistrationColumn[];
  canManageEvents: boolean;
  sourceLabel: (registration: EventRegistration) => string;
  sortColumnId: string;
  sortDirection: "asc" | "desc";
  onSortColumn: (columnId: string) => void;
  onUpdate: (registrationId: string, updates: Record<string, any>) => void;
  onUpdateWithStatusSync: (registration: EventRegistration, updates: Record<string, any>) => void;
  onRemove: (registrationId: string) => void;
}) {
  const displayColumns = columns.length ? columns : defaultRegistrationColumns;
  const valueForColumn = (registration: EventRegistration, column: EventRegistrationColumn) =>
    registrationColumnValue(registration, column, sourceLabel);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
      <div className="border-b border-border/60 bg-card/95 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold">Participant records</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Click a column heading to sort. Use the toolbar above for column-specific filtering.</p>
          </div>
          <Badge variant="outline" className="rounded-full border-brand-teal/20 bg-brand-teal/10 text-[11px] font-extrabold text-brand-teal">
            {registrations.length} shown
          </Badge>
        </div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-muted/40 text-xs font-extrabold text-muted-foreground">
          <tr>
            {displayColumns.map((column, index) => (
              <th key={column.id} className={cn("border-b border-border/60 px-4 py-3", index === 0 && "min-w-[15rem]")}>
                <button
                  type="button"
                  onClick={() => onSortColumn(column.id)}
                  className="group flex items-center gap-1.5 text-left font-extrabold transition hover:text-brand-teal"
                  title={`Sort by ${column.label}`}
                >
                  <span>{column.label}</span>
                  <span
                    className={cn(
                      "text-[10px] transition",
                      sortColumnId === column.id ? "text-brand-teal opacity-100" : "text-muted-foreground/50 opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {sortColumnId === column.id ? (sortDirection === "asc" ? "A-Z" : "Z-A") : "Sort"}
                  </span>
                </button>
              </th>
            ))}
            <th className="border-b border-border/60 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {registrations.map((registration) => {
            const balance = Math.max(0, registration.amountDue - registration.amountPaid);
            const ready =
              registration.status !== "Cancelled" &&
              balance === 0 &&
              registration.medicalFormReceived &&
              registration.consentFormReceived;
            return (
              <tr key={registration.id} className="group border-b border-border/60 transition hover:bg-brand-teal/5">
                {displayColumns.map((column) => {
                  const label = column.label.toLowerCase();
                  if (label.includes("registration") || label === "status") {
                    return (
                      <td key={column.id} className="border-b border-border/50 px-4 py-3.5 align-middle">
                        <select value={registration.status} onChange={(event) => onUpdateWithStatusSync(registration, { status: event.target.value })} className={cn("h-8 rounded-full border px-2 text-xs font-extrabold outline-none transition focus:ring-2 focus:ring-brand-teal/15", registrationStatusStyles[registration.status])} disabled={!canManageEvents}>
                          <option>Interested</option>
                          <option>Registered</option>
                          <option>Confirmed</option>
                          <option>Cancelled</option>
                        </select>
                      </td>
                    );
                  }
                  if (label.includes("readiness")) {
                    return (
                      <td key={column.id} className="border-b border-border/50 px-4 py-3.5 align-middle">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-extrabold", ready ? "border-brand-sage/20 bg-brand-sage/10 text-brand-sage" : "border-brand-amber/20 bg-brand-amber/10 text-brand-amber")}>
                          {ready ? "Ready" : "Incomplete"}
                        </span>
                      </td>
                    );
                  }
                  if (label.includes("source")) {
                    return (
                      <td key={column.id} className="border-b border-border/50 px-4 py-3.5 align-middle">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-extrabold", registration.source === "google_sheets" ? "border-brand-teal/20 bg-brand-teal/10 text-brand-teal" : "border-border/70 bg-background text-muted-foreground")}>
                          {sourceLabel(registration)}
                        </span>
                      </td>
                    );
                  }
                  if (label.includes("participant") || label.includes("name")) {
                    return (
                      <td key={column.id} className="border-b border-border/50 px-4 py-3.5 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <PersonAvatar name={registration.person?.display_name || registration.importedDisplayName} avatarUrl={registration.person?.avatar_url} size="sm" />
                          <div className="min-w-0">
                            <p className={cn("truncate font-extrabold", !registration.person && "text-brand-amber")}>{valueForColumn(registration, column) || "Unlinked registration"}</p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{registration.person?.email || registration.importedEmail || registration.person?.phone_number || registration.importedMobile || "No contact detail"}</p>
                            {(registration.guardianName || registration.guardianEmail) && (
                              <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                                Guardian: {registration.guardianName || registration.guardianEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  }
                  if (column.origin === "custom_field") {
                    const fieldKey = column.sourceColumn || column.label;
                    return (
                      <td key={column.id} className="border-b border-border/50 px-4 py-3.5 align-middle">
                        <Input
                          defaultValue={valueForColumn(registration, column)}
                          onBlur={(event) => {
                            const nextValue = event.target.value;
                            const previousValue = registration.customFields?.[fieldKey] || registration.customFields?.[column.label] || "";
                            if (nextValue === previousValue) return;
                            onUpdate(registration.id, {
                              custom_fields: {
                                ...(registration.customFields || {}),
                                [fieldKey]: nextValue,
                              },
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                          }}
                          className="h-8 min-w-36 rounded-lg bg-background text-xs font-semibold"
                          disabled={!canManageEvents}
                        />
                      </td>
                    );
                  }
                  return <td key={column.id} className="border-b border-border/50 px-4 py-3.5 align-middle text-xs font-bold text-foreground/85">{valueForColumn(registration, column) || <span className="text-muted-foreground/60">-</span>}</td>;
                })}
                <td className="border-b border-border/50 px-4 py-3.5 text-right align-middle">
                  {registration.approvalStatus === "pending" && (
                    <div className="mb-1 flex justify-end gap-1">
                      <Button type="button" variant="outline" className="h-7 rounded-full px-2 text-[11px]" onClick={() => onUpdateWithStatusSync(registration, { approval_status: "approved", status: "Confirmed" })} disabled={!canManageEvents}>
                        Approve
                      </Button>
                      <Button type="button" variant="outline" className="h-7 rounded-full px-2 text-[11px] text-muted-foreground hover:text-destructive" onClick={() => onUpdateWithStatusSync(registration, { approval_status: "rejected", status: "Cancelled" })} disabled={!canManageEvents}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {registration.externalStatusSyncStatus === "queued" && (
                    <p className="mb-1 text-[10px] font-extrabold text-brand-amber">Status sync queued</p>
                  )}
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={() => onRemove(registration.id)} disabled={!canManageEvents}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function GoogleSheetConnectionModal({
  open,
  onOpenChange,
  event,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventItem | null;
  onSave: (payload: {
    sheetLink: string;
    spreadsheetName: string;
    worksheetName: string;
    headerRow: number;
    syncMode: "one_time" | "manual" | "automatic";
    mappings: Array<{ actsixField: string; sheetColumn: string; fieldType: string; transform: string; isSensitive?: boolean }>;
  }) => void;
}) {
  const [step, setStep] = useState(0);
  const [sheetLink, setSheetLink] = useState("");
  const [syncMode, setSyncMode] = useState<"one-time" | "manual" | "automatic">("manual");
  const [spreadsheetName, setSpreadsheetName] = useState("");
  const [worksheetName, setWorksheetName] = useState("Form Responses 1");
  const [headerRow, setHeaderRow] = useState(1);
  const [detectedColumns, setDetectedColumns] = useState<Array<{ column: string; sample: string }>>([]);
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
  const [columnSettings, setColumnSettings] = useState<Record<string, { enabled: boolean; title: string }>>({});
  const [customMappingTitle, setCustomMappingTitle] = useState("");
  const [columnToAdd, setColumnToAdd] = useState("");
  const [previewingSheet, setPreviewingSheet] = useState(false);
  const [previewRowCount, setPreviewRowCount] = useState(0);
  const defaultFieldDefinitions = [
    { field: "First Name", handling: "Split first word as first name", keywords: ["first", "name", "full name"] },
    { field: "Surname", handling: "Manually review names after import", keywords: ["surname", "last", "name", "full name"] },
    { field: "Email", handling: "Standard field", keywords: ["email", "e-mail"] },
    { field: "Mobile", handling: "Standard field", keywords: ["mobile", "phone", "cell", "contact"] },
    { field: "Registration Date", handling: "Standard field", keywords: ["timestamp", "date", "submitted"] },
    { field: "Age", handling: "Event field", keywords: ["age"] },
    { field: "Dietary Requirements", handling: "Event field", keywords: ["diet", "food", "allergy"] },
    { field: "Consent Status", handling: "Forms readiness", keywords: ["consent", "permission"] },
    { field: "Payment Status", handling: "Payment readiness", keywords: ["payment", "paid", "deposit"] },
  ];
  const [fieldDefinitions, setFieldDefinitions] = useState(defaultFieldDefinitions);
  const reviewItems = [
    "2 possible duplicate submissions will require review",
    "1 row has no email or mobile number",
    "Custom fields stay on this event registration",
  ];

  const resetAndClose = () => {
    onOpenChange(false);
    setStep(0);
  };
  const selectedSpreadsheetName = spreadsheetName || `${event?.title || "Event"} Registrations`;
  const hasValidSheetLink = /docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(sheetLink.trim());
  const enabledColumns = detectedColumns.filter((item) => columnSettings[item.column]?.enabled !== false);
  const availableColumnsToAdd = detectedColumns.filter((item) => columnSettings[item.column]?.enabled === false);
  const detectedColumnNames = enabledColumns.map((item) => item.column);
  const guessColumn = (keywords: string[]) => {
    const normalized = detectedColumnNames.map((column) => ({ column, value: column.toLowerCase() }));
    return normalized.find((item) => keywords.some((keyword) => item.value === keyword || item.value.includes(keyword)))?.column || detectedColumnNames[0] || "";
  };
  const mappings = fieldDefinitions.map((definition) => ({
    ...definition,
    sheetColumn: mappingSelections[definition.field] || guessColumn(definition.keywords),
  }));
  const mappingPayload = enabledColumns.map((column) => {
    const mappedDefinition = mappings.find((mapping) => mapping.sheetColumn === column.column);
    const title = columnSettings[column.column]?.title?.trim() || column.column;
    const handling = mappedDefinition?.handling || "Event field";
    return {
      actsixField: title,
      sheetColumn: column.column,
      fieldType: handling === "Event field" ? "event_custom" : handling === "Forms readiness" || handling === "Payment readiness" ? "system" : "standard",
      transform: handling,
      isSensitive: ["medical", "passport", "payment", "allergy"].some((word) => `${title} ${column.column}`.toLowerCase().includes(word)),
    };
  }).reduce<Array<{ actsixField: string; sheetColumn: string; fieldType: string; transform: string; isSensitive: boolean }>>((acc, mapping) => {
    const baseTitle = mapping.actsixField || mapping.sheetColumn;
    const duplicateCount = acc.filter((item) => item.actsixField === baseTitle || item.actsixField.startsWith(`${baseTitle} `)).length;
    acc.push({
      ...mapping,
      actsixField: duplicateCount ? `${baseTitle} ${duplicateCount + 1}` : baseTitle,
    });
    return acc;
  }, []);
  const previewSheet = async (nextStep = 1) => {
    if (!hasValidSheetLink) return;
    setPreviewingSheet(true);
    const { data, error } = await supabase.functions.invoke("google-sheet-registration-sync", {
      body: {
        mode: "preview",
        sheet_url: sheetLink.trim(),
        worksheet_name: worksheetName,
        header_row: headerRow,
      },
    });
    setPreviewingSheet(false);

    if (error) {
      let message = error.message || "Could not detect columns.";
      const context = (error as any).context;
      if (context?.json) {
        try {
          const body = await context.json();
          message = body?.error || message;
        } catch {
          message = error.message || message;
        }
      }
      toast.error(message);
      return;
    }

    const columns = Array.isArray(data?.columns) ? data.columns : [];
    setDetectedColumns(columns);
    setColumnSettings(
      columns.reduce<Record<string, { enabled: boolean; title: string }>>((acc, item: { column: string }) => {
        acc[item.column] = { enabled: true, title: item.column };
        return acc;
      }, {})
    );
    setMappingSelections({});
    setPreviewRowCount(Number(data?.row_count || 0));
    setStep(nextStep);
  };
  const addCustomMapping = () => {
    const title = customMappingTitle.trim();
    if (!title) return;
    const sourceColumn = detectedColumnNames.find((column) => !mappings.some((mapping) => mapping.sheetColumn === column)) || detectedColumnNames[0];
    if (sourceColumn) {
      setColumnSettings((current) => ({
        ...current,
        [sourceColumn]: { enabled: true, title },
      }));
    }
    setCustomMappingTitle("");
  };
  const removeColumnFromActsix = (column: string) => {
    setColumnSettings((current) => ({
      ...current,
      [column]: { enabled: false, title: current[column]?.title || column },
    }));
  };
  const addColumnToActsix = (column: string) => {
    if (!column) return;
    setColumnSettings((current) => ({
      ...current,
      [column]: { enabled: true, title: current[column]?.title || column },
    }));
    setColumnToAdd("");
  };
  const canOpenStep = (index: number) =>
    index === 0 ||
    (index === 1 && detectedColumns.length > 0) ||
    (index === 2 && detectedColumns.length > 0) ||
    (index === 3 && mappingPayload.length > 0);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetAndClose();
          return;
        }
        onOpenChange(isOpen);
      }}
      title="Connect Google Sheet"
      description="Turn Google Form response rows into event registrations. MVP sync is Sheet to ACTSIX only."
      className="max-h-[92svh] max-w-4xl overflow-y-auto rounded-xl"
      bodyClassName="space-y-4"
    >
      <div className="flex flex-wrap gap-2">
        {["Choose Sheet", "Headers", "Map Columns", "Sync"].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (canOpenStep(index)) setStep(index);
            }}
            disabled={!canOpenStep(index)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-extrabold transition",
              step === index
                ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                : canOpenStep(index)
                  ? "border-border/70 text-muted-foreground hover:text-brand-teal"
                  : "border-border/50 text-muted-foreground/40"
            )}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3 rounded-xl border border-border/70 bg-background/45 p-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Step 1</p>
              <h4 className="mt-1 text-lg font-extrabold">Choose the Sheet</h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Paste a Google Sheet link, name the spreadsheet, and detect the columns ACTSIX should manage.</p>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Paste Google Sheet link</span>
              <Input value={sheetLink} onChange={(event) => setSheetLink(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="h-9 rounded-xl bg-background" />
              {sheetLink && !hasValidSheetLink && (
                <span className="text-xs font-bold text-brand-amber">Use the full Google Sheet URL from your browser.</span>
              )}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Spreadsheet</span>
                <Input
                  value={selectedSpreadsheetName}
                  onChange={(event) => setSpreadsheetName(event.target.value)}
                  placeholder={`${event?.title || "Event"} Registrations`}
                  className="h-9 rounded-xl bg-background"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Worksheet</span>
                <Input
                  value={worksheetName}
                  onChange={(event) => setWorksheetName(event.target.value)}
                  placeholder="Form Responses 1"
                  className="h-9 rounded-xl bg-background"
                />
              </label>
            </div>
            <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => previewSheet(1)} disabled={!hasValidSheetLink || previewingSheet}>
              {previewingSheet ? "Detecting columns..." : "Detect Columns"}
            </Button>
          </div>
          <div className="rounded-xl border border-brand-teal/15 bg-brand-teal/5 p-4">
            <p className="text-sm font-extrabold text-brand-teal">Connection principle</p>
            <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
              Google Sheet supplies registrations. ACTSIX manages the event workflow.
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-background/45 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Step 2</p>
              <h4 className="mt-1 text-lg font-extrabold">Confirm the header row</h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                ACTSIX detected {detectedColumns.length} columns and {previewRowCount} data rows from the Sheet.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="space-y-1">
                <span className="text-xs font-bold text-muted-foreground">Header row</span>
                <select
                  value={headerRow}
                  onChange={(event) => setHeaderRow(Number(event.target.value))}
                  className="h-9 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none"
                >
                  <option value={1}>Row 1</option>
                  <option value={2}>Row 2</option>
                  <option value={3}>Row 3</option>
                  <option value={4}>Row 4</option>
                  <option value={5}>Row 5</option>
                </select>
              </label>
              <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs" onClick={() => previewSheet(1)} disabled={!hasValidSheetLink || previewingSheet}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-muted/50 text-xs font-extrabold text-muted-foreground">
                <tr>
                  <th className="rounded-l-lg px-3 py-2">Use</th>
                  <th className="px-3 py-2">Sheet column</th>
                  <th className="px-3 py-2">ACTSIX title</th>
                  <th className="rounded-r-lg px-3 py-2">Sample value</th>
                </tr>
              </thead>
              <tbody>
                {detectedColumns.map(({ column, sample }) => (
                  <tr key={column} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={columnSettings[column]?.enabled !== false}
                        onChange={(event) =>
                          setColumnSettings((current) => ({
                            ...current,
                            [column]: { enabled: event.target.checked, title: current[column]?.title || column },
                          }))
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                    </td>
                    <td className="px-3 py-2 font-extrabold">{column}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={columnSettings[column]?.title || column}
                        onChange={(event) =>
                          setColumnSettings((current) => ({
                            ...current,
                            [column]: { enabled: current[column]?.enabled !== false, title: event.target.value },
                          }))
                        }
                        className="h-8 rounded-xl bg-card text-xs font-bold"
                        disabled={columnSettings[column]?.enabled === false}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{sample}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detectedColumns.length === 0 && (
            <div className="actsix-empty-state min-h-20 text-sm">No columns detected yet. Check the Sheet link, worksheet name, and sharing settings.</div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-background/45 p-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Step 3</p>
            <h4 className="mt-1 text-lg font-extrabold">Choose ACTSIX columns</h4>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Only these columns will show in ACTSIX. Rename them here or remove anything you do not want to manage.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-muted/50 text-xs font-extrabold text-muted-foreground">
                <tr>
                  <th className="rounded-l-lg px-3 py-2">ACTSIX column title</th>
                  <th className="px-3 py-2">Google Sheet column</th>
                  <th className="px-3 py-2">Sample value</th>
                  <th className="rounded-r-lg px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {enabledColumns.map((column) => (
                  <tr key={column.column} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <Input
                        value={columnSettings[column.column]?.title || column.column}
                        onChange={(event) =>
                          setColumnSettings((current) => ({
                            ...current,
                            [column.column]: { enabled: true, title: event.target.value },
                          }))
                        }
                        className="h-8 rounded-xl bg-card text-xs font-bold"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="h-8 w-full rounded-xl border border-border/70 bg-card px-2 text-xs font-bold outline-none"
                        value={column.column}
                        onChange={(event) => {
                          const nextColumn = event.target.value;
                          setColumnSettings((current) => ({
                            ...current,
                            [column.column]: { enabled: false, title: current[column.column]?.title || column.column },
                            [nextColumn]: { enabled: true, title: current[column.column]?.title || nextColumn },
                          }));
                        }}
                      >
                        {detectedColumns.map((option) => <option key={option.column} value={option.column}>{option.column}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs font-bold text-muted-foreground">{column.sample || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={() => removeColumnFromActsix(column.column)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {availableColumnsToAdd.length > 0 && (
              <>
                <select
                  value={columnToAdd}
                  onChange={(event) => setColumnToAdd(event.target.value)}
                  className="h-8 rounded-xl border border-border/70 bg-background px-2 text-xs font-bold outline-none"
                >
                  <option value="">Add removed Sheet column</option>
                  {availableColumnsToAdd.map((column) => (
                    <option key={column.column} value={column.column}>{column.column}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => addColumnToActsix(columnToAdd)} disabled={!columnToAdd}>
                  Add Selected
                </Button>
              </>
            )}
            <Input
              value={customMappingTitle}
              onChange={(event) => setCustomMappingTitle(event.target.value)}
              placeholder="Custom field title, e.g. T-shirt size"
              className="h-8 max-w-xs rounded-xl bg-background text-xs"
            />
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={addCustomMapping} disabled={!customMappingTitle.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Create custom registration field
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3 rounded-xl border border-border/70 bg-background/45 p-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Step 4</p>
              <h4 className="mt-1 text-lg font-extrabold">Sync options</h4>
              <p className="mt-1 text-sm font-medium text-muted-foreground">Choose whether ACTSIX imports once, waits for Sync Now, or keeps the Sheet on a schedule.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["manual", "Manual Sync", "Keep the mapping and import new rows when Sync Now is pressed."],
                ["one-time", "One-Time Import", "Import current rows only and do not keep checking the Sheet."],
                ["automatic", "Automatic Sync", "Check this Sheet every hour and notify leaders when new rows arrive."],
              ].map(([value, label, detail]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSyncMode(value as typeof syncMode)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    syncMode === value ? "border-brand-teal/35 bg-brand-teal/5" : "border-border/70 bg-card/70 hover:border-brand-teal/25"
                  )}
                >
                  <p className="text-sm font-extrabold">{label}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{detail}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/10 p-3">
              <p className="text-sm font-extrabold text-brand-amber">Sync needs review</p>
              <div className="mt-2 grid gap-1">
                {reviewItems.map((item) => (
                  <p key={item} className="text-sm font-medium text-muted-foreground">{item}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Connection Status</p>
            <div className="mt-3 space-y-3">
              <HealthRow label="Spreadsheet" value={selectedSpreadsheetName} />
              <HealthRow label="Worksheet" value={worksheetName} />
              <HealthRow label="Sync mode" value={syncMode === "automatic" ? "Automatic" : syncMode === "manual" ? "Manual" : "One-time"} />
              <HealthRow label="Rows detected" value={previewRowCount} />
              <HealthRow label="Columns mapped" value={mappingPayload.length} />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2 border-t border-border/70 pt-3">
        <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
          Back
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            className="actsix-btn-primary h-9 rounded-xl"
            onClick={() => {
              if (step === 0) {
                previewSheet(1);
                return;
              }
              setStep((current) => Math.min(3, current + 1));
            }}
            disabled={(step === 0 && !hasValidSheetLink) || previewingSheet || (step === 1 && detectedColumns.length === 0)}
          >
            {step === 0 && previewingSheet ? "Detecting..." : "Continue"}
          </Button>
        ) : (
            <Button
            type="button"
            className="actsix-btn-primary h-9 rounded-xl"
            disabled={!hasValidSheetLink || mappingPayload.length === 0}
            onClick={() => {
              onSave({
                sheetLink,
                spreadsheetName: selectedSpreadsheetName,
                worksheetName,
                headerRow,
                syncMode: syncMode === "one-time" ? "one_time" : syncMode,
                mappings: mappingPayload,
              });
            }}
          >
            Save Mapping
          </Button>
        )}
      </div>
    </ResponsiveModal>
  );
}

function TeamList({
  event,
  canManageEvents,
  onRemove,
  onAdd,
}: {
  event: EventItem;
  canManageEvents: boolean;
  onRemove: (collaboratorId: string) => void;
  onAdd: () => void;
}) {
  const matchesSection = (item: EventLogisticsItem, section: (typeof eventPortfolios)[number]) => {
    const label = item.label.toLowerCase();
    if (item.label.split(":")[0]?.trim() === section.label) return true;
    return section.match.some((keyword) => label.includes(keyword));
  };
  const portfolioGroups = eventPortfolios
    .map((portfolio) => {
      const items = event.logistics.filter((item) => matchesSection(item, portfolio));
      const owner = items.find((item) => item.label === portfolio.label)?.assignee || null;
      const team = items
        .filter((item) => item.label.toLowerCase().includes("team member") && item.assignee)
        .reduce<Array<{ itemId: string; person: EventPerson }>>((acc, item) => {
          if (!item.assignee || acc.some((member) => member.person.id === item.assignee?.id)) return acc;
          acc.push({ itemId: item.id, person: item.assignee });
          return acc;
        }, []);

      return { portfolio, owner, team };
    })
    .filter((group) => group.owner || group.team.length > 0);
  const hasEventLeadership = Boolean(event.owner || event.team.length || event.collaborators.length);
  const hasPortfolioLeadership = portfolioGroups.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" className="actsix-btn-primary h-8 rounded-full px-3 text-xs" onClick={onAdd} disabled={!canManageEvents}>
          <Plus className="h-3.5 w-3.5" />
          Add Team Member
        </Button>
      </div>

      <section className="rounded-xl border border-border/60 bg-background/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Event Leadership</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Main event leader and whole-event team roles.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {event.owner && (
            <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-2">
              <p className="truncate text-sm font-extrabold">{event.owner}</p>
              <p className="mt-1 text-xs font-bold text-brand-teal">Event Leader</p>
            </div>
          )}
          {event.team.map((member) => (
            <div key={`${member.role}-${member.name}`} className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
              <p className="truncate text-sm font-extrabold">{member.name}</p>
              <p className="mt-1 truncate text-xs font-bold text-muted-foreground">{member.role}</p>
            </div>
          ))}
          {event.collaborators.map((collaborator) => (
            <div key={collaborator.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <PersonAvatar name={collaborator.person?.display_name} avatarUrl={collaborator.person?.avatar_url} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{collaborator.person?.display_name || "Unknown person"}</p>
                  <p className="truncate text-xs font-bold text-muted-foreground">{collaborator.role || "Event Team"}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={() => onRemove(collaborator.id)} disabled={!canManageEvents}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {!hasEventLeadership && <div className="actsix-empty-state min-h-24 text-sm">Add an event leader or event team members so ownership is visible.</div>}
      </section>

      <section className="rounded-xl border border-border/60 bg-background/45 p-3">
        <div className="mb-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Portfolio Teams</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Portfolio owners and the people assigned inside each planning area.</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {portfolioGroups.map((group) => (
            <div key={group.portfolio.id} className="rounded-xl border border-border/60 bg-card/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{group.portfolio.label}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{group.portfolio.purpose}</p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-bold">
                  {group.team.length + (group.owner ? 1 : 0)} people
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {group.owner ? (
                  <div className="flex items-center gap-2 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-2">
                    <PersonAvatar name={group.owner.display_name} avatarUrl={group.owner.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{group.owner.display_name}</p>
                      <p className="truncate text-xs font-bold text-brand-teal">Portfolio Owner</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs font-bold text-muted-foreground">
                    No portfolio owner assigned.
                  </div>
                )}
                {group.team.map((member) => (
                  <div key={member.itemId} className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2">
                    <PersonAvatar name={member.person.display_name} avatarUrl={member.person.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{member.person.display_name}</p>
                      <p className="truncate text-xs font-bold text-muted-foreground">{group.portfolio.label} Team Member</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!hasPortfolioLeadership && <div className="actsix-empty-state min-h-24 text-sm">Assign portfolio owners or team members from the Portfolios tab.</div>}
      </section>
    </div>
  );
}

function BudgetSurface(props: {
  event: EventItem;
  spent: number;
  remaining: number;
  expectedRevenue: number;
  canManageEvents: boolean;
  expenseTitle: string;
  setExpenseTitle: (value: string) => void;
  expenseCategory: string;
  setExpenseCategory: (value: string) => void;
  expenseAmount: number;
  setExpenseAmount: (value: number) => void;
  expensePaidById: string;
  setExpensePaidById: (value: string) => void;
  expenseNotes: string;
  setExpenseNotes: (value: string) => void;
  collaboratorPeople: EventPerson[];
  onAddExpense: () => void;
  onDeleteExpense: (expenseId: string) => void;
  onUpdateRegistration?: (registrationId: string, updates: Record<string, any>) => void;
}) {
  const [financeView, setFinanceView] = useState<"budget" | "expenses" | "income" | "payments">("budget");
  const paymentRows = props.event.registrations.map((registration) => {
    const displayName = registration.person?.display_name || registration.importedDisplayName || "Unnamed participant";
    const contact = registration.person?.email || registration.importedEmail || registration.person?.phone_number || registration.importedMobile || "";
    const balance = Math.max(0, registration.amountDue - registration.amountPaid);
    return { ...registration, displayName, contact, balance };
  });
  const outstandingPayments = paymentRows.reduce((sum, row) => sum + row.balance, 0);
  const incomeReceived = props.event.received || props.expectedRevenue;
  const categories = Array.from(
    props.event.expenses.reduce<Map<string, { amount: number; count: number }>>((acc, expense) => {
      const label = expense.category || "Uncategorised";
      const current = acc.get(label) || { amount: 0, count: 0 };
      acc.set(label, { amount: current.amount + expense.amount, count: current.count + 1 });
      return acc;
    }, new Map())
  ).map(([label, totals]) => ({ label, ...totals }));
  const fallbackCategories = ["Venue", "Food", "Travel", "Equipment", "Communication"];
  const plannedCategories = categories.length ? categories : fallbackCategories.map((label) => ({ label, amount: 0, count: 0 }));
  const categoryBudget = plannedCategories.length ? props.event.budget / plannedCategories.length : 0;
  const financeTabs: Array<{ id: typeof financeView; label: string }> = [
    { id: "budget", label: "Budget" },
    { id: "expenses", label: "Expenses" },
    { id: "income", label: "Income" },
    { id: "payments", label: "Participant Payments" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <HealthRow label="Budgeted" value={money(props.event.budget)} />
        <HealthRow label="Committed" value={money(props.spent)} />
        <HealthRow label="Paid" value={money(props.spent)} />
        <HealthRow label="Remaining" value={money(props.remaining)} />
        <HealthRow label="Income received" value={money(incomeReceived)} />
        <HealthRow label="Outstanding" value={money(outstandingPayments)} />
      </div>

      <div className="rounded-xl border border-border/70 bg-background/55 p-1">
        <div className="flex flex-wrap gap-1">
          {financeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFinanceView(tab.id)}
              className={cn(
                "h-9 rounded-lg px-3 text-xs font-extrabold transition",
                financeView === tab.id ? "bg-brand-teal text-white shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {financeView === "budget" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-xl border border-border/70 bg-background/45 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-extrabold">Budget by category</h4>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">Category totals come from the expenses already recorded for this event.</p>
            </div>
            <div className="grid gap-2">
              {plannedCategories.map((category) => {
                const used = categoryBudget ? percent(category.amount, categoryBudget) : 0;
                return (
                  <div key={category.label} className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-extrabold">{category.label}</p>
                        <p className="text-xs font-semibold text-muted-foreground">{category.count} expense{category.count === 1 ? "" : "s"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold">{money(category.amount)}</p>
                        <p className="text-[11px] font-bold text-muted-foreground">Plan {money(categoryBudget)}</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", used > 100 ? "bg-destructive" : "bg-brand-teal")} style={{ width: `${Math.min(100, used)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-background/45 p-4">
              <h4 className="text-sm font-extrabold">Finance position</h4>
              <div className="mt-3 space-y-2">
                <HealthRow label="Budget health" value={props.remaining < 0 ? "Over budget" : "On track"} />
                <HealthRow label="Per person cost" value={money(props.event.costPerPerson)} />
                <HealthRow label="Registered" value={`${props.event.registrations.length}/${props.event.capacity}`} />
              </div>
            </div>
            <Button type="button" variant="outline" className="h-9 w-full rounded-xl text-xs" onClick={() => setFinanceView("expenses")}>
              Add or review expenses
            </Button>
          </div>
        </div>
      )}

      {financeView === "expenses" && (
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-border/70 bg-background/45 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input value={props.expenseTitle} onChange={(event) => props.setExpenseTitle(event.target.value)} placeholder="Expense title" className="h-8 rounded-xl bg-background text-xs" disabled={!props.canManageEvents} />
            <Input value={props.expenseCategory} onChange={(event) => props.setExpenseCategory(event.target.value)} placeholder="Category" className="h-8 rounded-xl bg-background text-xs" disabled={!props.canManageEvents} />
            <Input type="number" value={props.expenseAmount} onChange={(event) => props.setExpenseAmount(Number(event.target.value))} placeholder="Amount" className="h-8 rounded-xl bg-background text-xs" disabled={!props.canManageEvents} />
            <select value={props.expensePaidById} onChange={(event) => props.setExpensePaidById(event.target.value)} className="h-8 rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none" disabled={!props.canManageEvents}>
              <option value="">Paid by</option>
              {props.collaboratorPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
            </select>
            <Button type="button" className="actsix-btn-primary h-8 rounded-xl text-xs" onClick={props.onAddExpense} disabled={!props.canManageEvents || !props.expenseTitle.trim()}>
              Add Expense
            </Button>
            <Input value={props.expenseNotes} onChange={(event) => props.setExpenseNotes(event.target.value)} placeholder="Expense notes or receipt reference..." className="h-8 rounded-xl bg-background text-xs sm:col-span-2 lg:col-span-5" disabled={!props.canManageEvents} />
          </div>
          <div className="grid gap-2">
            {props.event.expenses.map((expense) => (
              <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{expense.title}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {expense.category} · {expense.paidBy?.display_name || "No payer"} · {formatShortDate(new Date(expense.spentAt))}
                  </p>
                  {expense.notes && <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{expense.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold">{money(expense.amount)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={() => props.onDeleteExpense(expense.id)} disabled={!props.canManageEvents}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {props.event.expenses.length === 0 && <div className="actsix-empty-state min-h-24 text-sm">Add expenses to track committed and paid amounts.</div>}
        </div>
      )}

      {financeView === "income" && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/45 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Participant income</p>
            <p className="mt-2 text-2xl font-extrabold">{money(paymentRows.reduce((sum, row) => sum + row.amountPaid, 0))}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{money(outstandingPayments)} still outstanding</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/45 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Expected registration income</p>
            <p className="mt-2 text-2xl font-extrabold">{money(props.expectedRevenue)}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{props.event.registrations.length} registration records</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/45 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Other income recorded</p>
            <p className="mt-2 text-2xl font-extrabold">{money(props.event.received)}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Stored on the event summary</p>
          </div>
        </div>
      )}

      {financeView === "payments" && (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/45">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-xs font-extrabold text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Participant</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-extrabold">{row.displayName}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{row.contact || "No contact"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="rounded-full text-[10px] font-bold">{row.paymentStatus || row.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      defaultValue={row.amountDue}
                      onBlur={(event) => props.onUpdateRegistration?.(row.id, { amount_due: Number(event.target.value) })}
                      className="h-8 w-28 rounded-xl bg-background text-xs"
                      disabled={!props.canManageEvents || !props.onUpdateRegistration}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      defaultValue={row.amountPaid}
                      onBlur={(event) => props.onUpdateRegistration?.(row.id, { amount_paid: Number(event.target.value) })}
                      className="h-8 w-28 rounded-xl bg-background text-xs"
                      disabled={!props.canManageEvents || !props.onUpdateRegistration}
                    />
                  </td>
                  <td className="px-3 py-2 font-extrabold">{money(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paymentRows.length === 0 && <div className="actsix-empty-state m-3 min-h-24 text-sm">Participant payments appear after registrations are added.</div>}
        </div>
      )}
    </div>
  );
}

function PortfolioSurface(props: {
  event: EventItem;
  view: string;
  onViewChange: (value: string) => void;
  canManageEvents: boolean;
  label: string;
  setLabel: (value: string) => void;
  assigneeId: string;
  setAssigneeId: (value: string) => void;
  collaboratorPeople: EventPerson[];
  onAdd: () => void;
  onUpdate: (itemId: string, updates: Record<string, string | null>) => void;
  onDelete: (itemId: string) => void;
  onAssignOwner: (portfolioLabel: string, personId: string, itemId?: string) => void;
  onAddTeamMember: (portfolioLabel: string, personId: string) => void;
  onCreatePortfolio: (portfolioLabel: string) => void;
  onRenamePortfolio: (currentLabel: string, nextLabel: string) => void;
  onDeletePortfolio: (portfolioLabel: string) => void;
  budgetProps: {
    spent: number;
    remaining: number;
    expectedRevenue: number;
    expenseTitle: string;
    setExpenseTitle: (value: string) => void;
    expenseCategory: string;
    setExpenseCategory: (value: string) => void;
    expenseAmount: number;
    setExpenseAmount: (value: number) => void;
    expensePaidById: string;
    setExpensePaidById: (value: string) => void;
    expenseNotes: string;
    setExpenseNotes: (value: string) => void;
    onAddExpense: () => void;
    onDeleteExpense: (expenseId: string) => void;
    onUpdateRegistration?: (registrationId: string, updates: Record<string, any>) => void;
  };
}) {
  const [portfolioDetailTab, setPortfolioDetailTab] = useState<"overview" | "tasks" | "files" | "notes" | "activity">("overview");
  const [portfolioTeamMemberId, setPortfolioTeamMemberId] = useState("");
  const [newPortfolioLabel, setNewPortfolioLabel] = useState("");
  const [editingPortfolioLabel, setEditingPortfolioLabel] = useState("");
  const [editingPortfolioValue, setEditingPortfolioValue] = useState("");
  const sections = eventPortfolios;
  const matchesSection = (item: EventLogisticsItem, section: (typeof eventPortfolios)[number]) => {
    const label = item.label.toLowerCase();
    if (item.label.split(":")[0]?.trim() === section.label) return true;
    return section.match.some((keyword) => label.includes(keyword));
  };
  const getPortfolioName = (item: EventLogisticsItem) => {
    const prefix = item.label.split(":")[0]?.trim();
    if (item.label.includes(":") && prefix) {
      const normalizedPrefix = prefix.toLowerCase();
      const matchedSection = sections.find(
        (section) =>
          section.label === prefix ||
          section.match.some((keyword) => normalizedPrefix.includes(keyword))
      );
      return matchedSection?.label || prefix;
    }

    const section = sections.find((candidate) => matchesSection(item, candidate));
    return section?.label || item.label.trim();
  };
  const activeSection = sections.find((section) => section.id === props.view);
  const activePortfolioName = props.view.startsWith("portfolio:") ? props.view.replace("portfolio:", "") : "";
  const activeLabel = activePortfolioName || activeSection?.label || "";
  const visibleItems = activePortfolioName
    ? props.event.logistics.filter((item) => getPortfolioName(item) === activePortfolioName)
    : activeSection
      ? props.event.logistics.filter((item) => matchesSection(item, activeSection))
      : props.event.logistics;
  const isTeamMemberItem = (item: EventLogisticsItem) => item.label.toLowerCase().includes("team member");
  const isPortfolioMetaItem = (item: EventLogisticsItem, label = activeLabel) => item.label === label;
  const portfolioRootItem = visibleItems.find((item) => isPortfolioMetaItem(item));
  const portfolioTeamItems = visibleItems.filter(isTeamMemberItem);
  const portfolioWorkItems = visibleItems.filter((item) => !isTeamMemberItem(item) && !isPortfolioMetaItem(item));
  const portfolioTabs = Array.from(
    props.event.logistics.reduce<Map<string, EventLogisticsItem[]>>((acc, item) => {
      const name = getPortfolioName(item);
      if (!isTeamMemberItem(item)) {
        acc.set(name, [...(acc.get(name) || []), item]);
      }
      return acc;
    }, new Map())
  )
    .map(([label, items]) => ({ id: `portfolio:${label}`, label, items }))
    .sort((a, b) => {
      const aIndex = sections.findIndex((section) => section.label === a.label);
      const bIndex = sections.findIndex((section) => section.label === b.label);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  const activePortfolioCards = sections
    .map((section) => {
      const items = props.event.logistics.filter((item) => matchesSection(item, section));
      return {
        ...section,
        items: items.filter((item) => !isTeamMemberItem(item) && !isPortfolioMetaItem(item, section.label)),
        owner: items.find((item) => isPortfolioMetaItem(item, section.label))?.assignee?.display_name,
      };
    })
    .filter((section) => section.core || section.items.length > 0);
  const availablePortfolioCards = sections.filter(
    (section) => !activePortfolioCards.some((active) => active.id === section.id)
  );
  const completedItems = portfolioWorkItems.filter((item) => item.status === "Done").length;
  const openItems = portfolioWorkItems.filter((item) => item.status !== "Done").length;
  const unownedItems = portfolioWorkItems.filter((item) => !item.assigneePersonId).length;
  const portfolioProgress = percent(completedItems, portfolioWorkItems.length);
  const portfolioOwner = portfolioRootItem?.assignee;
  const portfolioTeamAssignments = Array.from(
    portfolioTeamItems.reduce<Map<string, { itemId: string; person: EventPerson }>>((acc, item) => {
      if (item.assignee) acc.set(item.assignee.id, { itemId: item.id, person: item.assignee });
      return acc;
    }, new Map()).values()
  );
  const portfolioTeam = portfolioTeamAssignments.map((assignment) => assignment.person);
  const portfolioAlerts = [
    unownedItems ? `${unownedItems} item${unownedItems === 1 ? "" : "s"} need an owner` : "",
    openItems ? `${openItems} item${openItems === 1 ? "" : "s"} still open` : "",
    activeLabel === "Finance" && props.budgetProps.remaining < 0
      ? `Budget exceeded by ${money(Math.abs(props.budgetProps.remaining))}`
      : "",
  ].filter(Boolean);
  const portfolioPurpose =
    sections.find((section) => section.label === activeLabel || section.id === props.view)?.purpose ||
    "Portfolio workspace for tasks, files, notes, milestones, ownership, and alerts.";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-background/55 p-1">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => props.onViewChange("landing")}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-extrabold transition",
                props.view === "landing" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              )}
            >
              All
            </button>
            {portfolioTabs.map((section) => {
              const isEditing = editingPortfolioLabel === section.label;
              return (
                <div
                  key={section.id}
                  className={cn(
                    "group inline-flex h-9 items-center rounded-lg text-xs font-extrabold transition",
                    props.view === section.id ? "bg-brand-teal text-white shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                  )}
                >
                  {isEditing ? (
                    <form
                      className="flex items-center gap-1 px-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        props.onRenamePortfolio(section.label, editingPortfolioValue);
                        setEditingPortfolioLabel("");
                        setEditingPortfolioValue("");
                      }}
                    >
                      <Input
                        value={editingPortfolioValue}
                        onChange={(event) => setEditingPortfolioValue(event.target.value)}
                        className="h-7 w-32 rounded-md bg-background px-2 text-xs text-foreground"
                        autoFocus
                      />
                      <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-md text-current" disabled={!props.canManageEvents || !editingPortfolioValue.trim()}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-current"
                        onClick={() => {
                          setEditingPortfolioLabel("");
                          setEditingPortfolioValue("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => props.onViewChange(section.id)}
                        className="inline-flex h-full items-center gap-2 rounded-lg px-3"
                      >
                        {section.label}
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", props.view === section.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                          {section.items.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "mr-0.5 flex h-7 w-7 items-center justify-center rounded-md opacity-70 transition hover:opacity-100",
                          props.view === section.id ? "hover:bg-white/15" : "hover:bg-muted"
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingPortfolioLabel(section.label);
                          setEditingPortfolioValue(section.label);
                        }}
                        disabled={!props.canManageEvents}
                        title="Rename portfolio"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "mr-1 flex h-7 w-7 items-center justify-center rounded-md opacity-70 transition hover:opacity-100",
                          props.view === section.id ? "hover:bg-white/15" : "hover:bg-muted hover:text-destructive"
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onDeletePortfolio(section.label);
                        }}
                        disabled={!props.canManageEvents}
                        title="Remove portfolio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <form
              className="ml-auto flex h-9 min-w-[13rem] items-center gap-1 rounded-lg border border-dashed border-border/70 bg-card/70 px-1"
              onSubmit={(event) => {
                event.preventDefault();
                props.onCreatePortfolio(newPortfolioLabel);
                setNewPortfolioLabel("");
              }}
            >
              <Input
                value={newPortfolioLabel}
                onChange={(event) => setNewPortfolioLabel(event.target.value)}
                placeholder="New portfolio"
                className="h-7 min-w-0 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
                disabled={!props.canManageEvents}
              />
              <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 rounded-md text-brand-teal" disabled={!props.canManageEvents || !newPortfolioLabel.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
      </div>

      {props.view === "landing" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Event Portfolios</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Organise the event into clear planning areas, each with its own owner, tasks, files, and progress.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activePortfolioCards.map((section) => {
              const done = section.items.filter((item) => item.status === "Done").length;
              const open = section.items.filter((item) => item.status !== "Done").length;
              const unowned = section.items.filter((item) => !item.assigneePersonId).length;
              const progress = percent(done, section.items.length);
              const alertText = unowned
                ? `${unowned} item${unowned === 1 ? "" : "s"} need an owner`
                : open
                  ? `${open} item${open === 1 ? "" : "s"} still open`
                  : "No urgent attention needed";
              return (
                <div
                  key={section.label}
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onViewChange(`portfolio:${section.label}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") props.onViewChange(`portfolio:${section.label}`);
                  }}
                  className="cursor-pointer rounded-xl border border-border/60 bg-card/75 p-3 text-left transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                      <FolderOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{section.label}</p>
                          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                            Owner: {section.owner || "Unassigned"}
                          </p>
                        </div>
                        {open > 0 && (
                          <span className="shrink-0 rounded-full bg-brand-amber/10 px-2 py-1 text-[10px] font-extrabold text-brand-amber">
                            {open} open
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                      <span>{section.items.length} tasks · {done} complete</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand-teal" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {alertText !== "No urgent attention needed" && (
                    <p className="mt-2 truncate text-xs font-bold text-brand-amber">{alertText}</p>
                  )}
                </div>
              );
            })}
          </div>
          {availablePortfolioCards.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background/45 p-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Available planning areas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availablePortfolioCards.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => props.onViewChange(section.id)}
                    className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-extrabold text-muted-foreground transition hover:border-brand-teal/25 hover:text-brand-teal"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(activeLabel || activeSection) && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-brand-teal/15 bg-brand-teal/10 text-brand-teal">
                  <FolderOpen className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-extrabold">{activeLabel || activeSection?.label}</h3>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">Event Portfolio · {props.event.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2 py-1 text-[11px] font-extrabold text-brand-teal">
                      Active
                    </span>
                    {portfolioAlerts.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-amber/20 bg-brand-amber/10 px-2 py-1 text-[11px] font-extrabold text-brand-amber">
                        <AlertTriangle className="h-3 w-3" />
                        {portfolioAlerts.length} alert{portfolioAlerts.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="actsix-btn-primary h-9 rounded-xl px-3 text-xs" onClick={() => setPortfolioDetailTab("tasks")}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Task
                </Button>
                <Button type="button" variant="outline" className="h-9 rounded-xl px-3 text-xs" onClick={() => props.onViewChange("landing")}>
                  Portfolio Overview
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2 sm:col-span-2">
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <span>Progress</span>
                  <span>{portfolioProgress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-teal" style={{ width: `${portfolioProgress}%` }} />
                </div>
              </div>
              <HealthRow label="Tasks" value={`${completedItems}/${portfolioWorkItems.length}`} />
              <HealthRow label="Owner" value={portfolioOwner?.display_name || "Unassigned"} />
            </div>

            <div className="mt-4 overflow-x-auto border-t border-border/70 pt-3">
              <div className="flex min-w-max gap-1">
                {["overview", "tasks", "files", "notes", "activity"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPortfolioDetailTab(tab as typeof portfolioDetailTab)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-extrabold capitalize transition",
                      portfolioDetailTab === tab ? "bg-brand-teal text-white" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeLabel && portfolioDetailTab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <PortfolioTaskList
              items={portfolioWorkItems}
              canManageEvents={props.canManageEvents}
              collaboratorPeople={props.collaboratorPeople}
              onUpdate={props.onUpdate}
              onDelete={props.onDelete}
            />
            <div className="rounded-xl border border-border/70 bg-background/45 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-brand-teal" />
                <h4 className="text-sm font-extrabold">Upcoming Milestones</h4>
              </div>
              <div className="grid gap-2">
                {portfolioWorkItems.slice(0, 3).map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-card/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.label}</p>
                      <p className="text-xs font-medium text-muted-foreground">Milestone {index + 1}</p>
                    </div>
                    <span className="rounded-full bg-brand-sage/10 px-2 py-1 text-[11px] font-extrabold text-brand-sage">Upcoming</span>
                  </div>
                ))}
                {portfolioWorkItems.length === 0 && <div className="actsix-empty-state min-h-20 text-sm">No milestones yet.</div>}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/45 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-teal" />
                <h4 className="text-sm font-extrabold">Portfolio Details</h4>
              </div>
              <div className="space-y-3 text-sm">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Portfolio Owner</span>
                  <select
                    value={portfolioOwner?.id || ""}
                    onChange={(event) => props.onAssignOwner(activeLabel, event.target.value, portfolioRootItem?.id)}
                    className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none"
                    disabled={!props.canManageEvents}
                  >
                    <option value="">Unassigned</option>
                    {props.collaboratorPeople.map((person) => (
                      <option key={person.id} value={person.id}>{person.display_name}</option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={portfolioTeamMemberId}
                      onChange={(event) => setPortfolioTeamMemberId(event.target.value)}
                      className="h-8 min-w-0 flex-1 rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none"
                      disabled={!props.canManageEvents}
                    >
                      <option value="">Add team member</option>
                      {props.collaboratorPeople
                        .filter((person) => person.id !== portfolioOwner?.id && !portfolioTeam.some((member) => member.id === person.id))
                        .map((person) => (
                          <option key={person.id} value={person.id}>{person.display_name}</option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-xl px-2 text-xs"
                      disabled={!props.canManageEvents || !portfolioTeamMemberId}
                      onClick={() => {
                        props.onAddTeamMember(activeLabel, portfolioTeamMemberId);
                        setPortfolioTeamMemberId("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {portfolioTeamAssignments.map((assignment) => (
                      <span key={assignment.itemId} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2 py-1 text-[11px] font-bold">
                        {assignment.person.display_name}
                        {props.canManageEvents && (
                          <button
                            type="button"
                            onClick={() => props.onDelete(assignment.itemId)}
                            className="rounded-full p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${assignment.person.display_name} from ${activeLabel}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {portfolioTeam.length === 0 && (
                      <span className="text-xs font-medium text-muted-foreground">No team members assigned yet.</span>
                    )}
                  </div>
                </div>
                <HealthRow label="Status" value={openItems ? "Active" : "Complete"} />
                <HealthRow label="Progress" value={`${portfolioProgress}%`} />
                <HealthRow label="Budget items" value={activeLabel === "Finance" ? props.event.expenses.length : 0} />
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/45 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-teal" />
                <h4 className="text-sm font-extrabold">Files</h4>
              </div>
              <div className="actsix-empty-state min-h-20 text-sm">Attach files to this portfolio as the file library expands.</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/45 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold">Notes</h4>
                <Button type="button" variant="ghost" className="h-7 px-2 text-xs">Edit</Button>
              </div>
              <p className="text-sm font-medium leading-6 text-muted-foreground">{portfolioPurpose}</p>
            </div>
          </div>
        </div>
      )}

      {activeLabel && portfolioDetailTab === "tasks" && (
        <div className="space-y-3">
          <PortfolioTaskComposer
            activeLabel={activeLabel}
            label={props.label}
            setLabel={props.setLabel}
            assigneeId={props.assigneeId}
            setAssigneeId={props.setAssigneeId}
            collaboratorPeople={props.collaboratorPeople}
            canManageEvents={props.canManageEvents}
            onAdd={props.onAdd}
          />
          <PortfolioTaskList
            items={portfolioWorkItems}
            canManageEvents={props.canManageEvents}
            collaboratorPeople={props.collaboratorPeople}
            onUpdate={props.onUpdate}
            onDelete={props.onDelete}
          />
        </div>
      )}

      {activeLabel && portfolioDetailTab === "files" && (
        <div className="actsix-empty-state min-h-32 text-sm">Portfolio files will live here, alongside files attached to tasks and budget items.</div>
      )}

      {activeLabel && portfolioDetailTab === "notes" && (
        <Textarea
          value={portfolioPurpose}
          readOnly
          className="min-h-36 rounded-xl bg-background text-sm"
        />
      )}

      {activeLabel && portfolioDetailTab === "activity" && (
        <div className="grid gap-2">
          {portfolioWorkItems.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-sm font-medium">
              {item.label} is currently {item.status.toLowerCase()}.
            </div>
          ))}
          {portfolioWorkItems.length === 0 && <div className="actsix-empty-state min-h-24 text-sm">No activity for this portfolio yet.</div>}
        </div>
      )}

      {activeLabel === "Finance" && portfolioDetailTab === "overview" && (
        <div className="rounded-xl border border-border/70 bg-background/45 p-4">
          <div className="mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-brand-teal" />
            <h4 className="text-sm font-extrabold">Financial Portfolio</h4>
          </div>
          <BudgetSurface
            event={props.event}
            spent={props.budgetProps.spent}
            remaining={props.budgetProps.remaining}
            expectedRevenue={props.budgetProps.expectedRevenue}
            canManageEvents={props.canManageEvents}
            expenseTitle={props.budgetProps.expenseTitle}
            setExpenseTitle={props.budgetProps.setExpenseTitle}
            expenseCategory={props.budgetProps.expenseCategory}
            setExpenseCategory={props.budgetProps.setExpenseCategory}
            expenseAmount={props.budgetProps.expenseAmount}
            setExpenseAmount={props.budgetProps.setExpenseAmount}
            expensePaidById={props.budgetProps.expensePaidById}
            setExpensePaidById={props.budgetProps.setExpensePaidById}
            expenseNotes={props.budgetProps.expenseNotes}
            setExpenseNotes={props.budgetProps.setExpenseNotes}
            collaboratorPeople={props.collaboratorPeople}
            onAddExpense={props.budgetProps.onAddExpense}
            onDeleteExpense={props.budgetProps.onDeleteExpense}
            onUpdateRegistration={props.budgetProps.onUpdateRegistration}
          />
        </div>
      )}
    </div>
  );
}

function PortfolioTaskComposer({
  activeLabel,
  label,
  setLabel,
  assigneeId,
  setAssigneeId,
  collaboratorPeople,
  canManageEvents,
  onAdd,
}: {
  activeLabel: string;
  label: string;
  setLabel: (value: string) => void;
  assigneeId: string;
  setAssigneeId: (value: string) => void;
  collaboratorPeople: EventPerson[];
  canManageEvents: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/45 p-3 sm:grid-cols-[1fr_12rem_auto]">
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={`Add ${activeLabel.toLowerCase()} task...`}
        className="h-8 rounded-xl bg-background text-xs"
        disabled={!canManageEvents}
      />
      <select
        value={assigneeId}
        onChange={(event) => setAssigneeId(event.target.value)}
        className="h-8 rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none"
        disabled={!canManageEvents}
      >
        <option value="">No owner</option>
        {collaboratorPeople.map((person) => (
          <option key={person.id} value={person.id}>{person.display_name}</option>
        ))}
      </select>
      <Button type="button" className="actsix-btn-primary h-8 rounded-xl text-xs" onClick={onAdd} disabled={!canManageEvents || !label.trim()}>
        Add Task
      </Button>
    </div>
  );
}

function PortfolioTaskList({
  items,
  canManageEvents,
  collaboratorPeople,
  onUpdate,
  onDelete,
}: {
  items: EventLogisticsItem[];
  canManageEvents: boolean;
  collaboratorPeople: EventPerson[];
  onUpdate: (itemId: string, updates: Record<string, string | null>) => void;
  onDelete: (itemId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/45 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-brand-teal" />
        <h4 className="text-sm font-extrabold">Open Tasks</h4>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-3 sm:grid-cols-[1fr_9rem_12rem_auto] sm:items-center">
            <p className="min-w-0 truncate text-sm font-extrabold">{item.label}</p>
            <select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value })} className="h-8 rounded-full border border-border/70 bg-background px-2 text-xs font-bold" disabled={!canManageEvents}>
              <option>Open</option>
              <option>In Progress</option>
              <option>Done</option>
            </select>
            <select value={item.assigneePersonId || ""} onChange={(event) => onUpdate(item.id, { assignee_person_id: event.target.value || null })} className="h-8 rounded-full border border-border/70 bg-background px-2 text-xs font-bold" disabled={!canManageEvents}>
              <option value="">No owner</option>
              {collaboratorPeople.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
            </select>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.id)} disabled={!canManageEvents}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <div className="actsix-empty-state min-h-24 text-sm">No tasks in this portfolio yet.</div>}
      </div>
    </div>
  );
}

function FilesSurface({
  event,
  canManageEvents,
  onCreateHostedForm,
  onGenerateGoogleFormTemplate,
  onConnectSheet,
  onSyncSheet,
  syncingSheetId,
}: {
  event: EventItem;
  canManageEvents: boolean;
  onCreateHostedForm: () => void;
  onGenerateGoogleFormTemplate: () => void;
  onConnectSheet: () => void;
  onSyncSheet: (connectionId?: string) => void;
  syncingSheetId: string;
}) {
  const [fileView, setFileView] = useState<"all" | "portfolio" | "registration" | "finance" | "communication">("all");
  const [fileSearch, setFileSearch] = useState("");
  const hostedForm = event.registrationForms.find((form) => form.formType === "actsix_hosted" && form.status === "published");
  const googleTemplate = event.registrationForms.find((form) => form.formType === "google_form_template");
  const hostedFormUrl = hostedForm ? `${window.location.origin}/register/${hostedForm.publicToken}` : "";
  const sheetConnection = event.sheetConnections[0];
  const eventDateLabel = event.startsAt ? formatShortDate(new Date(event.startsAt)) : "Event date";
  const fileActions = [
    {
      id: "hosted-form",
      title: hostedForm ? hostedForm.title : "ACTSIX-hosted registration form",
      detail: hostedForm ? `Published ${formatShortDate(new Date(hostedForm.createdAt))}` : "Create a public registration form for this event.",
      status: hostedForm ? "Published" : "Not created",
      action: hostedForm ? "Copy link" : "Publish form",
      onAction: () => {
        if (hostedFormUrl) {
          navigator.clipboard?.writeText(hostedFormUrl);
          toast.success("Hosted form link copied.");
          return;
        }
        onCreateHostedForm();
      },
    },
    {
      id: "google-template",
      title: googleTemplate ? googleTemplate.title : "Google Form template",
      detail: googleTemplate
        ? `${googleTemplate.schema?.questions?.length || 0} questions generated`
        : "Generate a question spec to recreate in Google Forms.",
      status: googleTemplate ? googleTemplate.status : "Not generated",
      action: "Generate",
      onAction: onGenerateGoogleFormTemplate,
    },
    {
      id: "sheet",
      title: sheetConnection?.spreadsheetName || "Registration Sheet",
      detail: sheetConnection
        ? `${sheetConnection.worksheetName} · ${sheetConnection.rowsImported} imported`
        : "Connect a Google Sheet response file.",
      status: sheetConnection ? sheetConnection.status : "Not connected",
      action: sheetConnection ? (syncingSheetId === sheetConnection.id ? "Syncing..." : "Sync") : "Connect",
      onAction: () => sheetConnection ? onSyncSheet(sheetConnection.id) : onConnectSheet(),
    },
  ];
  const startDate = new Date(`${event.startsAt || new Date().toISOString().slice(0, 10)}T12:00:00`);
  const fileRows = [
    ...(hostedForm
      ? [{
          id: `form-${hostedForm.id}`,
          name: hostedForm.title,
          type: "Hosted form",
          area: "Registration Documents",
          portfolio: "People",
          owner: "ACTSIX",
          date: hostedForm.createdAt,
          status: hostedForm.status,
          actionLabel: "Copy link",
          action: () => {
            navigator.clipboard?.writeText(hostedFormUrl);
            toast.success("Hosted form link copied.");
          },
        }]
      : []),
    ...(googleTemplate
      ? [{
          id: `template-${googleTemplate.id}`,
          name: googleTemplate.title,
          type: "Google Form spec",
          area: "Registration Documents",
          portfolio: "People",
          owner: "ACTSIX",
          date: googleTemplate.createdAt,
          status: googleTemplate.status,
          actionLabel: "Regenerate",
          action: onGenerateGoogleFormTemplate,
        }]
      : []),
    ...event.sheetConnections.map((connection) => ({
      id: `sheet-${connection.id}`,
      name: connection.spreadsheetName || "Registration Sheet",
      type: connection.sourceKind === "google_form" ? "Google Form responses" : "Google Sheet",
      area: "Registration Documents",
      portfolio: "People",
      owner: "Google Sheets",
      date: connection.lastSyncedAt || event.startsAt,
      status: connection.status,
      actionLabel: syncingSheetId === connection.id ? "Syncing..." : "Sync",
      action: () => onSyncSheet(connection.id),
    })),
    ...event.expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      name: expense.notes ? `${expense.title} support note` : `${expense.title} expense record`,
      type: "Finance record",
      area: "Finance Documents",
      portfolio: "Finance",
      owner: expense.paidBy?.display_name || "Unassigned",
      date: expense.spentAt,
      status: expense.notes ? "Documented" : "Needs receipt",
      actionLabel: "Open finance",
      action: undefined,
    })),
    ...event.logistics
      .filter((item) => item.status !== "Done")
      .map((item) => {
        const prefix = item.label.includes(":") ? item.label.split(":")[0].trim() : "Portfolio";
        return {
          id: `portfolio-${item.id}`,
          name: item.label,
          type: "Working file need",
          area: "Portfolio Files",
          portfolio: prefix,
          owner: item.assignee?.display_name || "Unassigned",
          date: event.startsAt,
          status: item.status,
          actionLabel: "Review task",
          action: undefined,
        };
      }),
    ...communicationSchedules.standard.milestones.slice(0, 6).map((milestone) => ({
      id: `comms-${milestone.title}`,
      name: `${milestone.title} asset`,
      type: "Communication asset",
      area: "Communication Assets",
      portfolio: "Comms",
      owner: milestone.ownerRole,
      date: addDays(startDate, milestone.offsetDays).toISOString(),
      status: milestone.approvalStatus,
      actionLabel: "Plan message",
      action: undefined,
    })),
  ];
  const viewLabels = [
    { id: "all" as const, label: "All Files" },
    { id: "portfolio" as const, label: "By Portfolio" },
    { id: "registration" as const, label: "Registration Documents" },
    { id: "finance" as const, label: "Finance Documents" },
    { id: "communication" as const, label: "Communication Assets" },
  ];
  const filteredFileRows = fileRows.filter((row) => {
    const matchesView =
      fileView === "all" ||
      (fileView === "portfolio" && row.area === "Portfolio Files") ||
      (fileView === "registration" && row.area === "Registration Documents") ||
      (fileView === "finance" && row.area === "Finance Documents") ||
      (fileView === "communication" && row.area === "Communication Assets");
    const query = fileSearch.trim().toLowerCase();
    const matchesSearch = !query || [row.name, row.type, row.area, row.portfolio, row.owner, row.status].some((value) => `${value}`.toLowerCase().includes(query));
    return matchesView && matchesSearch;
  });
  const groupedPortfolioFiles = Array.from(
    filteredFileRows.reduce<Map<string, typeof filteredFileRows>>((acc, row) => {
      acc.set(row.portfolio, [...(acc.get(row.portfolio) || []), row]);
      return acc;
    }, new Map())
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {fileActions.map((file) => (
          <div key={file.id} className="rounded-xl border border-border/70 bg-background/55 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{file.title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{file.detail}</p>
              </div>
              <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-bold">{file.status}</Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-8 rounded-full px-3 text-xs"
              onClick={file.onAction}
              disabled={!canManageEvents || file.action === "Syncing..."}
            >
              {file.action}
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-background/45 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold">File library</h4>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Indexed forms, sheets, finance records, portfolio file needs, and communication assets.</p>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px] font-bold">{filteredFileRows.length} shown</Badge>
        </div>

        <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-card/60 p-1">
            {viewLabels.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setFileView(view.id)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-extrabold transition",
                  fileView === view.id ? "bg-brand-teal text-white" : "text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                {view.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="Search files..." className="h-9 rounded-xl bg-background pl-8 text-xs" />
          </div>
        </div>

        {fileView === "portfolio" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {groupedPortfolioFiles.map(([portfolio, rows]) => (
              <div key={portfolio} className="rounded-xl border border-border/60 bg-card/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold">{portfolio}</p>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold">{rows.length}</Badge>
                </div>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <FileLibraryRow key={row.id} row={row} canManageEvents={canManageEvents} />
                  ))}
                </div>
              </div>
            ))}
            {groupedPortfolioFiles.length === 0 && <div className="actsix-empty-state min-h-24 text-sm lg:col-span-2">No portfolio files match this view.</div>}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredFileRows.map((row) => (
              <FileLibraryRow key={row.id} row={row} canManageEvents={canManageEvents} />
            ))}
            {filteredFileRows.length === 0 && <div className="actsix-empty-state min-h-24 text-sm">No files match this view.</div>}
          </div>
        )}

        <div className="mt-3 rounded-xl border border-dashed border-border/70 bg-card/40 px-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Upload storage is not configured in this page yet. This library indexes the event records ACTSIX already owns, including forms, sheets, finance entries, portfolio tasks, and communication assets for {eventDateLabel}.
          </p>
        </div>
      </div>
    </div>
  );
}

function FileLibraryRow({
  row,
  canManageEvents,
}: {
  row: {
    id: string;
    name: string;
    type: string;
    area: string;
    portfolio: string;
    owner: string;
    date: string;
    status: string;
    actionLabel: string;
    action?: () => void;
  };
  canManageEvents: boolean;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2 md:grid-cols-[minmax(0,1.4fr)_8rem_9rem_8rem_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold">{row.name}</p>
        <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{row.type} · {row.area}</p>
      </div>
      <p className="text-xs font-bold text-muted-foreground">{row.portfolio}</p>
      <p className="truncate text-xs font-bold text-muted-foreground">{row.owner}</p>
      <div>
        <p className="text-xs font-bold text-muted-foreground">{row.date ? formatShortDate(new Date(row.date)) : "No date"}</p>
        <p className="mt-1 text-[11px] font-extrabold text-brand-teal">{row.status}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-8 rounded-xl px-3 text-xs"
        onClick={() => {
          if (row.action) {
            row.action();
            return;
          }
          toast.info("This record is indexed from event data. Open the related workspace to edit it.");
        }}
        disabled={!canManageEvents || row.actionLabel === "Syncing..."}
      >
        {row.actionLabel}
      </Button>
    </div>
  );
}

function ActivitySurface({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  const activityItems = [
    ...event.importRuns.map((run) => ({
      id: `run-${run.id}`,
      title: `Import ${run.status}`,
      detail: `${run.rowsImported} imported · ${run.rowsRequiringReview} review`,
      when: run.completedAt || run.startedAt,
      tone: run.status === "failed" ? "destructive" : "teal",
    })),
    ...event.syncAuditLogs.map((log) => ({
      id: `log-${log.id}`,
      title: log.action.replace(/_/g, " "),
      detail: log.message,
      when: log.createdAt,
      tone: log.severity === "error" ? "destructive" : log.severity === "warning" ? "amber" : "teal",
    })),
    ...event.expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      title: `Expense added: ${expense.title}`,
      detail: `${expense.category} · ${money(expense.amount)}`,
      when: expense.spentAt,
      tone: "sage",
    })),
    ...event.registrations.slice(0, 8).map((registration) => ({
      id: `registration-${registration.id}`,
      title: `${registration.person?.display_name || registration.importedDisplayName || "Participant"} is ${registration.status.toLowerCase()}`,
      detail: registration.source === "google_sheets" ? "Imported from Google Sheet" : "Manual registration",
      when: registration.createdAt,
      tone: registration.status === "Cancelled" ? "destructive" : "teal",
    })),
  ]
    .filter((item) => item.when)
    .sort((a, b) => `${b.when}`.localeCompare(`${a.when}`))
    .slice(0, compact ? 5 : 12);

  return (
    <div className="space-y-3">
      {activityItems.map((item) => (
        <div key={item.id} className={cn("flex gap-3 rounded-xl border border-border/70 bg-background/55", compact ? "p-2.5" : "p-3")}>
          <span
            className={cn(
              "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
              item.tone === "destructive" ? "bg-destructive" : item.tone === "amber" ? "bg-brand-amber" : item.tone === "sage" ? "bg-brand-sage" : "bg-brand-teal"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cn("truncate font-extrabold capitalize", compact ? "text-xs" : "text-sm")}>{item.title}</p>
              <span className="text-[11px] font-bold text-muted-foreground">{formatShortDate(new Date(item.when))}</span>
            </div>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{item.detail}</p>
          </div>
        </div>
      ))}
      {activityItems.length === 0 && (
        <div className="actsix-empty-state min-h-24 text-sm">
          Activity will appear when participants, imports, expenses, or sync settings change.
        </div>
      )}
    </div>
  );
}

type CommunicationPreset = "small" | "standard" | "medium" | "major" | "camp" | "mission" | "custom";

type CommunicationMilestone = {
  timing: string;
  title: string;
  offsetDays: number;
  audience: string;
  channel: string;
  ownerRole: string;
  approvalStatus: string;
  draft: string;
};

const communicationSchedules: Record<CommunicationPreset, { label: string; description: string; milestones: CommunicationMilestone[] }> = {
  small: {
    label: "Small event",
    description: "Best for meetings, worship evenings, and training sessions.",
    milestones: [
      { timing: "3 weeks before", title: "Initial announcement", offsetDays: -21, audience: "Whole church or group", channel: "Announcement", ownerRole: "Event Leader", approvalStatus: "Draft", draft: "Announce the event, purpose, date, and basic next step." },
      { timing: "2 weeks before", title: "Invitation reminder", offsetDays: -14, audience: "Invited people", channel: "Email", ownerRole: "Event Leader", approvalStatus: "Draft", draft: "Remind people why it matters and ask them to respond." },
      { timing: "1 week before", title: "Details and RSVP reminder", offsetDays: -7, audience: "Interested people", channel: "Email", ownerRole: "Event Team", approvalStatus: "Needs review", draft: "Confirm time, location, RSVP details, and anything to bring." },
      { timing: "1 day before", title: "Final reminder", offsetDays: -1, audience: "Confirmed attendees", channel: "SMS or WhatsApp", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Send the final time, location, arrival note, and contact person." },
      { timing: "1 day after", title: "Thank you", offsetDays: 1, audience: "Attendees and helpers", channel: "Email", ownerRole: "Event Leader", approvalStatus: "Draft", draft: "Thank people warmly and point them to any next step." },
    ],
  },
  standard: {
    label: "Standard event",
    description: "A balanced default for most church events.",
    milestones: [
      { timing: "12 weeks before", title: "Save the date", offsetDays: -84, audience: "Whole church", channel: "Announcement", ownerRole: "Comms Owner", approvalStatus: "Draft", draft: "Share the date early so people can plan around it." },
      { timing: "8 weeks before", title: "Official event launch", offsetDays: -56, audience: "Whole church", channel: "Email and announcement", ownerRole: "Comms Owner", approvalStatus: "Needs approval", draft: "Launch registration with the event purpose, dates, location, and cost." },
      { timing: "6 weeks before", title: "Invitation and awareness message", offsetDays: -42, audience: "Target audience", channel: "Email", ownerRole: "Programme Owner", approvalStatus: "Draft", draft: "Invite the right people and explain why they should come." },
      { timing: "4 weeks before", title: "Registration reminder", offsetDays: -28, audience: "Not yet registered", channel: "Email", ownerRole: "People Owner", approvalStatus: "Draft", draft: "Remind people to register and include the clearest action link." },
      { timing: "2 weeks before", title: "Deadline warning", offsetDays: -14, audience: "Interested and unpaid people", channel: "Email and SMS", ownerRole: "People Owner", approvalStatus: "Needs review", draft: "Warn clearly about registration, payment, and form deadlines." },
      { timing: "7 days before", title: "Participant information pack", offsetDays: -7, audience: "Registered participants", channel: "Email", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Send arrival details, schedule, packing list, transport, and emergency contact." },
      { timing: "2 days before", title: "Final reminder", offsetDays: -2, audience: "Registered participants", channel: "SMS or WhatsApp", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Confirm final timing, location, transport, and what to bring." },
      { timing: "Event day", title: "Operational update if required", offsetDays: 0, audience: "Participants and leaders", channel: "WhatsApp", ownerRole: "Event Leader", approvalStatus: "Optional", draft: "Send only if there is a practical update people need now." },
      { timing: "1 day after", title: "Thank-you message", offsetDays: 1, audience: "Participants and volunteers", channel: "Email", ownerRole: "Event Leader", approvalStatus: "Draft", draft: "Thank everyone and celebrate what happened." },
      { timing: "5 days after", title: "Feedback and follow-up", offsetDays: 5, audience: "Participants", channel: "Email", ownerRole: "Follow-up Owner", approvalStatus: "Draft", draft: "Ask for feedback and explain the next step after the event." },
    ],
  },
  medium: {
    label: "Medium event",
    description: "Good for conferences, outreach days, and leadership retreats.",
    milestones: [
      { timing: "10 weeks before", title: "Save the date", offsetDays: -70, audience: "Whole church", channel: "Announcement", ownerRole: "Comms Owner", approvalStatus: "Draft", draft: "Give people enough notice to plan the date." },
      { timing: "8 weeks before", title: "Launch", offsetDays: -56, audience: "Whole church", channel: "Email and social", ownerRole: "Comms Owner", approvalStatus: "Needs approval", draft: "Open the event with the core details and registration link." },
      { timing: "6 weeks before", title: "Invitation campaign", offsetDays: -42, audience: "Target audience", channel: "Email", ownerRole: "Comms Owner", approvalStatus: "Draft", draft: "Explain the value of attending and repeat the call to action." },
      { timing: "4 weeks before", title: "Registration reminder", offsetDays: -28, audience: "Not yet registered", channel: "Email", ownerRole: "People Owner", approvalStatus: "Draft", draft: "Prompt people who have not responded yet." },
      { timing: "2 weeks before", title: "Deadline warning", offsetDays: -14, audience: "Interested people", channel: "Email and SMS", ownerRole: "People Owner", approvalStatus: "Needs review", draft: "Make deadlines and consequences clear." },
      { timing: "1 week before", title: "Participant information", offsetDays: -7, audience: "Registered participants", channel: "Email", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Send practical information in one clear message." },
      { timing: "2 days before", title: "Final reminder", offsetDays: -2, audience: "Registered participants", channel: "SMS or WhatsApp", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Confirm final timing and arrival details." },
      { timing: "2 days after", title: "Thank you and feedback", offsetDays: 2, audience: "Participants and volunteers", channel: "Email", ownerRole: "Follow-up Owner", approvalStatus: "Draft", draft: "Say thank you and invite feedback while the event is fresh." },
    ],
  },
  major: {
    label: "Major event",
    description: "For large or high-commitment events.",
    milestones: [
      { timing: "6 months before", title: "Initial interest and save the date", offsetDays: -182, audience: "Potential participants", channel: "Email and announcement", ownerRole: "Event Leader", approvalStatus: "Draft", draft: "Invite early interest and ask people to save the date." },
      { timing: "5 months before", title: "Applications or registration open", offsetDays: -150, audience: "Potential participants", channel: "Email", ownerRole: "People Owner", approvalStatus: "Needs approval", draft: "Explain how to apply or register and what commitment is required." },
      { timing: "3 months before", title: "Payment and preparation reminder", offsetDays: -90, audience: "Registered participants", channel: "Email", ownerRole: "Finance Owner", approvalStatus: "Draft", draft: "Remind people about payments, preparation, and key deadlines." },
      { timing: "2 months before", title: "Participant confirmation", offsetDays: -60, audience: "Registered participants", channel: "Email", ownerRole: "People Owner", approvalStatus: "Needs review", draft: "Confirm participation and clarify any outstanding requirements." },
      { timing: "1 month before", title: "Forms and final payment deadline", offsetDays: -30, audience: "Participants with outstanding items", channel: "Email and SMS", ownerRole: "Safety Owner", approvalStatus: "Ready", draft: "Clearly list missing forms, payments, and the final deadline." },
      { timing: "2 weeks before", title: "Full information pack", offsetDays: -14, audience: "Confirmed participants", channel: "Email", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Send the full schedule, packing list, transport, safety, and contact details." },
      { timing: "2 days before", title: "Final reminder", offsetDays: -2, audience: "Confirmed participants", channel: "SMS or WhatsApp", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Confirm departure or arrival details and last practical reminders." },
      { timing: "After event", title: "Thank you, feedback, and reporting", offsetDays: 3, audience: "Participants, families, and leaders", channel: "Email", ownerRole: "Follow-up Owner", approvalStatus: "Draft", draft: "Thank people, gather feedback, and share reporting or next steps." },
    ],
  },
  camp: {
    label: "Camp or retreat",
    description: "Adds extra weight to forms, packing, transport, and parent communication.",
    milestones: [
      { timing: "12 weeks before", title: "Save the date", offsetDays: -84, audience: "Parents and participants", channel: "Announcement", ownerRole: "Comms Owner", approvalStatus: "Draft", draft: "Give families the dates, age group, and early cost estimate." },
      { timing: "8 weeks before", title: "Registration opens", offsetDays: -56, audience: "Parents and participants", channel: "Email", ownerRole: "People Owner", approvalStatus: "Needs approval", draft: "Open registration and explain cost, forms, and places available." },
      { timing: "5 weeks before", title: "Parent information reminder", offsetDays: -35, audience: "Parents", channel: "Email", ownerRole: "Safety Owner", approvalStatus: "Draft", draft: "Remind parents about forms, medication, dietaries, and transport." },
      { timing: "3 weeks before", title: "Forms and payment chase", offsetDays: -21, audience: "Outstanding families", channel: "Email and SMS", ownerRole: "People Owner", approvalStatus: "Needs review", draft: "List exactly what is outstanding and how to complete it." },
      { timing: "1 week before", title: "Information pack", offsetDays: -7, audience: "Registered families", channel: "Email", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Send packing list, schedule, venue, transport, and emergency contact details." },
      { timing: "1 day before", title: "Final camp reminder", offsetDays: -1, audience: "Registered families", channel: "SMS or WhatsApp", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Confirm drop-off time, pickup time, and what to bring." },
      { timing: "2 days after", title: "Thank you and feedback", offsetDays: 2, audience: "Families and volunteers", channel: "Email", ownerRole: "Follow-up Owner", approvalStatus: "Draft", draft: "Thank families and helpers, then ask for feedback." },
    ],
  },
  mission: {
    label: "Mission trip",
    description: "Best for travel, fundraising, documents, training, and reporting.",
    milestones: [
      { timing: "6 months before", title: "Initial interest", offsetDays: -182, audience: "Potential team members", channel: "Announcement and email", ownerRole: "Event Leader", approvalStatus: "Draft", draft: "Invite expressions of interest and explain the mission purpose." },
      { timing: "5 months before", title: "Applications open", offsetDays: -150, audience: "Potential team members", channel: "Email", ownerRole: "People Owner", approvalStatus: "Needs approval", draft: "Explain application steps, dates, cost, and expectations." },
      { timing: "4 months before", title: "Support raising launch", offsetDays: -120, audience: "Mission team", channel: "Email", ownerRole: "Finance Owner", approvalStatus: "Draft", draft: "Give support raising guidance, payment schedule, and key milestones." },
      { timing: "3 months before", title: "Document reminder", offsetDays: -90, audience: "Mission team", channel: "Email", ownerRole: "Safety Owner", approvalStatus: "Needs review", draft: "Remind the team about passports, visas, consent, medical, and insurance details." },
      { timing: "1 month before", title: "Final payment and forms deadline", offsetDays: -30, audience: "Mission team", channel: "Email and SMS", ownerRole: "Finance Owner", approvalStatus: "Ready", draft: "List final payments, forms, and documents still outstanding." },
      { timing: "2 weeks before", title: "Full travel information pack", offsetDays: -14, audience: "Mission team and families", channel: "Email", ownerRole: "Travel Owner", approvalStatus: "Ready", draft: "Send flights, routes, packing list, emergency contact, and itinerary." },
      { timing: "2 days before", title: "Final travel reminder", offsetDays: -2, audience: "Mission team", channel: "WhatsApp", ownerRole: "Travel Owner", approvalStatus: "Ready", draft: "Confirm meeting time, documents, baggage, and travel contact." },
      { timing: "After event", title: "Thank you, feedback, and reporting", offsetDays: 5, audience: "Team, families, and supporters", channel: "Email", ownerRole: "Follow-up Owner", approvalStatus: "Draft", draft: "Thank supporters, gather feedback, and share reporting." },
    ],
  },
  custom: {
    label: "Custom schedule",
    description: "A light starter when the event does not fit a preset.",
    milestones: [
      { timing: "6 weeks before", title: "First announcement", offsetDays: -42, audience: "Target audience", channel: "Announcement", ownerRole: "Comms Owner", approvalStatus: "Draft", draft: "Introduce the event and the clearest next step." },
      { timing: "4 weeks before", title: "Invitation reminder", offsetDays: -28, audience: "Target audience", channel: "Email", ownerRole: "Comms Owner", approvalStatus: "Draft", draft: "Remind people to respond, register, or ask questions." },
      { timing: "2 weeks before", title: "Deadline or details message", offsetDays: -14, audience: "Interested people", channel: "Email", ownerRole: "Event Team", approvalStatus: "Needs review", draft: "Send deadlines, details, or requirements people need to act on." },
      { timing: "2 days before", title: "Final reminder", offsetDays: -2, audience: "Confirmed people", channel: "SMS or WhatsApp", ownerRole: "Event Team", approvalStatus: "Ready", draft: "Confirm final details and what people should do next." },
      { timing: "After event", title: "Follow-up", offsetDays: 3, audience: "Participants", channel: "Email", ownerRole: "Follow-up Owner", approvalStatus: "Draft", draft: "Thank people, collect feedback, and share the next step." },
    ],
  },
};

function CommunicationSurface({
  event,
  collaboratorPeople,
  canManageEvents,
}: {
  event: EventItem;
  collaboratorPeople: EventPerson[];
  canManageEvents: boolean;
}) {
  const [preset, setPreset] = useState<CommunicationPreset>("standard");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [customChannel, setCustomChannel] = useState("Email");
  const [customDays, setCustomDays] = useState(-14);
  const [milestoneOverrides, setMilestoneOverrides] = useState<Record<string, Partial<CommunicationMilestone> & {
    id?: string;
    dueDate?: string;
    owner?: string;
    complete?: boolean;
    removed?: boolean;
    status?: string;
    assetNote?: string;
  }>>({});
  const schedule = communicationSchedules[preset];
  const startDate = new Date(`${event.startsAt || new Date().toISOString().slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const communicationOwner =
    collaboratorPeople.find((person) => person.display_name === event.owner)?.display_name ||
    event.owner ||
    collaboratorPeople[0]?.display_name ||
    "Unassigned";
  const milestoneId = (milestone: CommunicationMilestone, index: number) => `${preset}-${index}-${milestone.title}-${milestone.offsetDays}`;
  type CommunicationPlanItem = CommunicationMilestone & {
    id: string;
    dueDate: Date;
    dueDateInput: string;
    owner: string;
    status: string;
    assetNote: string;
    complete: boolean;
    daysUntil: number;
  };
  const baseGeneratedItems = schedule.milestones
    .map((milestone, index) => {
      const id = milestoneId(milestone, index);
      const override = milestoneOverrides[id] || {};
      if (override.removed) return null;
      const dueDate = override.dueDate ? new Date(`${override.dueDate}T12:00:00`) : addDays(startDate, Number(override.offsetDays ?? milestone.offsetDays));
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      const computedStatus = override.complete ? "Complete" : daysUntil < 0 ? "Review" : daysUntil <= 7 ? "Due soon" : "Scheduled";
      return {
        ...milestone,
        ...override,
        id,
        dueDate,
        dueDateInput: dueDate.toISOString().slice(0, 10),
        title: override.title || milestone.title,
        audience: override.audience || milestone.audience,
        channel: override.channel || milestone.channel,
        owner: override.owner || (milestone.ownerRole === "Event Leader" ? communicationOwner : milestone.ownerRole),
        approvalStatus: override.approvalStatus || milestone.approvalStatus,
        status: override.status || computedStatus,
        draft: override.draft || milestone.draft,
        assetNote: override.assetNote || "",
        complete: Boolean(override.complete),
        daysUntil,
      };
    })
    .filter(Boolean) as CommunicationPlanItem[];
  const customGeneratedItems = Object.entries(milestoneOverrides)
    .filter(([id, override]) => id.includes("-custom-") && !override.removed)
    .map(([id, override]) => {
      const dueDate = override.dueDate ? new Date(`${override.dueDate}T12:00:00`) : addDays(startDate, Number(override.offsetDays || 0));
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      const computedStatus = override.complete ? "Complete" : daysUntil < 0 ? "Review" : daysUntil <= 7 ? "Due soon" : "Scheduled";
      return {
        timing: override.timing || "Custom",
        title: override.title || "Custom message",
        offsetDays: Number(override.offsetDays || 0),
        audience: override.audience || "Target audience",
        channel: override.channel || "Email",
        ownerRole: override.ownerRole || "Comms Owner",
        approvalStatus: override.approvalStatus || "Draft",
        draft: override.draft || "Write the message brief and add any artwork or file notes.",
        id,
        dueDate,
        dueDateInput: dueDate.toISOString().slice(0, 10),
        owner: override.owner || communicationOwner,
        status: override.status || computedStatus,
        assetNote: override.assetNote || "",
        complete: Boolean(override.complete),
        daysUntil,
      };
    }) as CommunicationPlanItem[];
  const generatedItems = [...baseGeneratedItems, ...customGeneratedItems];
  const selected = generatedItems[selectedIndex] || generatedItems[0];
  const pendingCount = generatedItems.filter((item) => !item.complete).length;
  const completedCount = generatedItems.filter((item) => item.complete).length;
  const updateMilestone = (id: string, updates: Partial<CommunicationMilestone> & { dueDate?: string; owner?: string; complete?: boolean; status?: string; assetNote?: string; removed?: boolean }) => {
    setMilestoneOverrides((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...updates,
      },
    }));
  };
  const addCustomMilestone = () => {
    const title = customTitle.trim();
    if (!title) return;
    const id = `${preset}-custom-${Date.now()}`;
    const dueDate = addDays(startDate, customDays).toISOString().slice(0, 10);
    setMilestoneOverrides((current) => ({
      ...current,
      [id]: {
        id,
        timing: customDays === 0 ? "Event day" : `${Math.abs(customDays)} day${Math.abs(customDays) === 1 ? "" : "s"} ${customDays < 0 ? "before" : "after"}`,
        title,
        offsetDays: customDays,
        audience: "Target audience",
        channel: customChannel,
        ownerRole: "Comms Owner",
        owner: communicationOwner,
        approvalStatus: "Draft",
        status: "Scheduled",
        draft: "Write the message brief and add any artwork or file notes.",
        dueDate,
      },
    }));
    setCustomTitle("");
    setCustomDays(-14);
    setCustomChannel("Email");
    setSelectedIndex(generatedItems.length);
  };
  const channelOptions = ["Announcement", "Email", "SMS or WhatsApp", "Social media", "Website", "Printed material", "Direct participant message"];
  const statusOptions = ["Scheduled", "Draft", "Needs review", "Ready", "Sent", "Complete", "Review"];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Schedule type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(communicationSchedules) as CommunicationPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPreset(key);
                  setSelectedIndex(0);
                }}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-extrabold transition",
                  preset === key
                    ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                    : "border-border/70 bg-card/70 text-muted-foreground hover:border-brand-teal/25 hover:text-brand-teal"
                )}
              >
                {communicationSchedules[key].label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-brand-teal/15 bg-brand-teal/5 p-3">
          <p className="text-sm font-extrabold text-brand-teal">Default principle</p>
          <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
            Communicate early enough for people to plan, often enough for them to remember, and clearly enough for them to act.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HealthRow label="Preset" value={schedule.label} />
        <HealthRow label="Milestones" value={generatedItems.length} />
        <HealthRow label="Open" value={pendingCount} />
        <HealthRow label="Complete" value={completedCount} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-border/70 bg-background/45 p-3 md:grid-cols-[minmax(0,1fr)_9rem_11rem_auto]">
            <Input
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="Add communication milestone..."
              className="h-9 rounded-xl bg-background text-xs"
              disabled={!canManageEvents}
            />
            <Input
              type="number"
              value={customDays}
              onChange={(event) => setCustomDays(Number(event.target.value))}
              className="h-9 rounded-xl bg-background text-xs"
              disabled={!canManageEvents}
              aria-label="Days from event date"
            />
            <select
              value={customChannel}
              onChange={(event) => setCustomChannel(event.target.value)}
              className="h-9 rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none"
              disabled={!canManageEvents}
            >
              {channelOptions.map((channel) => <option key={channel}>{channel}</option>)}
            </select>
            <Button type="button" className="actsix-btn-primary h-9 rounded-xl px-3 text-xs" onClick={addCustomMilestone} disabled={!canManageEvents || !customTitle.trim()}>
              Add
            </Button>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/45 p-3">
          <div className="mb-3">
            <h4 className="text-sm font-extrabold">{schedule.label} timeline</h4>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Dates are calculated from {formatShortDate(startDate)}. {schedule.description}
            </p>
          </div>
          <div className="grid gap-2">
            {generatedItems.map((item, index) => (
              <div
                key={`${item.title}-${item.offsetDays}`}
                className={cn(
                  "grid gap-2 rounded-xl border p-3 transition md:grid-cols-[2rem_8rem_minmax(0,1fr)_8rem_auto] md:items-center",
                  selectedIndex === index
                    ? "border-brand-teal/35 bg-brand-teal/5"
                    : "border-border/60 bg-card/70 hover:border-brand-teal/25"
                )}
              >
                <input
                  type="checkbox"
                  checked={item.complete}
                  onChange={(event) => updateMilestone(item.id, { complete: event.target.checked, status: event.target.checked ? "Complete" : "Scheduled" })}
                  className="h-4 w-4 rounded border-border text-brand-teal"
                  disabled={!canManageEvents}
                  aria-label={`Mark ${item.title} complete`}
                />
                <div>
                  <Input
                    type="date"
                    value={item.dueDateInput}
                    onChange={(event) => updateMilestone(item.id, { dueDate: event.target.value })}
                    className="h-8 rounded-xl bg-background text-xs"
                    disabled={!canManageEvents}
                  />
                  <p className="mt-1 text-[11px] font-bold text-muted-foreground">{item.timing}</p>
                </div>
                <div className="min-w-0">
                  <Input
                    value={item.title}
                    onFocus={() => setSelectedIndex(index)}
                    onChange={(event) => updateMilestone(item.id, { title: event.target.value })}
                    className="h-8 rounded-xl bg-background text-xs font-extrabold"
                    disabled={!canManageEvents}
                  />
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{item.audience}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{item.channel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    "justify-self-start rounded-full px-2 py-1 text-[11px] font-extrabold md:justify-self-end",
                    item.status === "Due soon" || item.status === "Needs review"
                      ? "bg-brand-amber/10 text-brand-amber"
                      : item.status === "Review"
                        ? "bg-muted text-muted-foreground"
                        : item.status === "Complete" || item.status === "Sent"
                          ? "bg-brand-sage/10 text-brand-sage"
                          : "bg-brand-teal/10 text-brand-teal"
                  )}
                >
                  {item.status}
                </button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={() => updateMilestone(item.id, { removed: true })} disabled={!canManageEvents}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {generatedItems.length === 0 && <div className="actsix-empty-state min-h-24 text-sm">Add a milestone to start the communication plan.</div>}
          </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-background/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Selected message</p>
                <h4 className="mt-1 text-lg font-extrabold">{selected?.title || "No milestone selected"}</h4>
                {selected && <p className="mt-1 text-sm font-medium text-muted-foreground">{selected.timing} - {formatShortDate(selected.dueDate)}</p>}
              </div>
              {selected && <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-bold">{selected.status}</Badge>}
            </div>
            {selected && (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Audience</span>
                  <Input value={selected.audience} onChange={(event) => updateMilestone(selected.id, { audience: event.target.value })} className="h-8 rounded-xl bg-background text-xs" disabled={!canManageEvents} />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-muted-foreground">Channel</span>
                    <select value={selected.channel} onChange={(event) => updateMilestone(selected.id, { channel: event.target.value })} className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none" disabled={!canManageEvents}>
                      {channelOptions.map((channel) => <option key={channel}>{channel}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-muted-foreground">Status</span>
                    <select value={selected.status} onChange={(event) => updateMilestone(selected.id, { status: event.target.value, complete: event.target.value === "Complete" })} className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none" disabled={!canManageEvents}>
                      {statusOptions.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-muted-foreground">Owner</span>
                  <select value={selected.owner} onChange={(event) => updateMilestone(selected.id, { owner: event.target.value })} className="h-8 w-full rounded-xl border border-border/70 bg-background px-2 text-xs font-semibold outline-none" disabled={!canManageEvents}>
                    <option>{communicationOwner}</option>
                    {collaboratorPeople.map((person) => <option key={person.id}>{person.display_name}</option>)}
                    <option>Comms Owner</option>
                    <option>People Owner</option>
                    <option>Finance Owner</option>
                    <option>Safety Owner</option>
                    <option>Event Team</option>
                  </select>
                </label>
                <HealthRow label="Approval" value={selected.approvalStatus} />
              </div>
            )}
          </div>

          {selected && <div className="rounded-xl border border-border/70 bg-background/45 p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-teal" />
              <h4 className="text-sm font-extrabold">Draft message brief</h4>
            </div>
            <Textarea
              value={selected.draft}
              onChange={(event) => updateMilestone(selected.id, { draft: event.target.value })}
              className="min-h-28 rounded-xl bg-background text-sm"
              disabled={!canManageEvents}
            />
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Artwork or file note</span>
              <Input
                value={selected.assetNote}
                onChange={(event) => updateMilestone(selected.id, { assetNote: event.target.value })}
                placeholder="Poster, slide, image, or document needed..."
                className="h-8 rounded-xl bg-background text-xs"
                disabled={!canManageEvents}
              />
            </label>
          </div>}
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ icon: Icon, title, lines }: { icon: typeof Tent; title: string; lines: string[] }) {
  return (
    <WorkspacePanel title={title} icon={Icon}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {lines.map((line) => (
          <div key={line} className="rounded-xl border border-border/60 bg-card/70 px-3 py-3 text-sm font-bold">
            {line}
          </div>
        ))}
      </div>
    </WorkspacePanel>
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
