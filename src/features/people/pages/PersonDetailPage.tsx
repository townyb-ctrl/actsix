import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  BookOpen,
  CalendarDays,
  Trash2,
  Camera,
  CheckCircle2,
  Clock3,
  Folder,
  FolderKanban,
  Mail,
  MapPin,
  Plus,
  Send,
  Phone,
  Save,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Link, useParams } from "react-router-dom";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { createNotificationForPerson } from "@/lib/notifications";
import { formatPhoneForDisplay, getWhatsappHref, isMessageablePhone, normalizePhoneForStorage } from "@/lib/phone";

type Person = {
  id: string;
  user_id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  gender: string | null;
  membership_status: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type TeamMembership = {
  id: string;
  team_id: string;
  role_name: string | null;
  notes: string | null;
  service_teams?: {
    name: string;
  } | null;
};

type ServiceAssignment = {
  id: string;
  service_id: string;
  team_id: string | null;
  role_name: string;
  notes: string | null;
  created_at: string;
};

type ServiceInstance = {
  id: string;
  title: string | null;
  service_date: string;
  start_time: string | null;
  location: string | null;
};

type GroupMembership = {
  id: string;
  group_id: string;
  person_id: string;
  role: string | null;
  created_at: string;
  people_groups?: {
    id: string;
    name: string;
    description: string | null;
    folder_id: string | null;
    people_group_folders?: {
      name: string;
    } | null;
  } | null;
};

type AssignedTask = {
  id: string;
  title: string;
  project: string | null;
  priority: string | null;
  due: string | null;
  complete: boolean | null;
  created_at: string | null;
};

type ProjectCollaboration = {
  id: string;
  project_id: string;
  person_id: string;
  role: string | null;
  created_at: string | null;
};

type CollaborationProject = {
  id: string;
  name: string;
  area: string | null;
  status: string | null;
  notes: string | null;
};

type TrainingCourse = {
  id: string;
  title: string;
  category: string;
  estimated_minutes: number;
  status: "Active" | "Draft" | "Archived";
};

type TrainingAssignment = {
  id: string;
  workspace_id: string;
  course_id: string;
  person_id: string;
  status: "Not Started" | "In Progress" | "Complete";
  progress: number;
  due_date: string | null;
  completed_at: string | null;
};

type PersonTrainingAssignment = TrainingAssignment & {
  course: TrainingCourse | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const normalizeEmail = (value?: string | null) => {
  return value?.trim().toLowerCase() || null;
};

const statusBadgeClass = (status: TrainingAssignment["status"] | TrainingCourse["status"]) => {
  if (status === "Active" || status === "Complete") {
    return "border-brand-sage/25 bg-brand-sage/10 text-brand-sage";
  }

  if (status === "Draft" || status === "Not Started") {
    return "border-brand-amber/25 bg-brand-amber/10 text-brand-amber";
  }

  return "border-brand-teal/25 bg-brand-teal/10 text-brand-teal";
};

const getProgressStatus = (progress: number): TrainingAssignment["status"] => {
  if (progress >= 100) return "Complete";
  if (progress > 0) return "In Progress";
  return "Not Started";
};


const PersonDetailPage = () => {
  const { personId } = useParams();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { role, canEditPeopleDirectory } = useCurrentWorkspace();

  const [person, setPerson] = useState<Person | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [projectCollaborations, setProjectCollaborations] = useState<ProjectCollaboration[]>([]);
  const [collaborationProjects, setCollaborationProjects] = useState<CollaborationProject[]>([]);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [assignmentServices, setAssignmentServices] = useState<ServiceInstance[]>([]);
  const [trainingCourses, setTrainingCourses] = useState<TrainingCourse[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<PersonTrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [assignTrainingOpen, setAssignTrainingOpen] = useState(false);
  const [assigningTraining, setAssigningTraining] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("Member");
  const [notes, setNotes] = useState("");
  const [selectedTrainingCourseId, setSelectedTrainingCourseId] = useState("");
  const [trainingDueDate, setTrainingDueDate] = useState("");

  const canEditProfile =
    Boolean(person?.auth_user_id && person.auth_user_id === user?.id) ||
    canEditPeopleDirectory;

  const canManageTraining = ["admin", "editor", "group_leader"].includes(role || "");

  const fetchPerson = async () => {
    if (!user || !personId || !currentPerson?.workspace_id) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("people")
      .select("*")
      .eq("id", personId)
      .eq("workspace_id", currentPerson.workspace_id)
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setPerson(data);
    setFirstName(data.first_name || "");
    setLastName(data.last_name || "");
    setPhoneNumber(formatPhoneForDisplay(data.phone_number) || "");
    setEmail(data.email || "");
    setGender(data.gender || "");
    setMembershipStatus(data.membership_status || "Member");
    setNotes(data.notes || "");

    const { data: membershipData, error: membershipError } = await (supabase as any)
      .from("service_team_members")
      .select("id, team_id, role_name, notes, service_teams(name)")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("role_name", { ascending: true });

    if (membershipError) {
      toast.error(membershipError.message);
    }

    setMemberships(membershipData || []);

    const { data: groupMembershipData, error: groupMembershipError } = await (supabase as any)
      .from("people_group_members")
      .select("id, group_id, person_id, role, created_at, people_groups(id, name, description, folder_id, people_group_folders(name))")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("created_at", { ascending: false });

    if (groupMembershipError) {
      toast.error(groupMembershipError.message);
    }

    setGroupMemberships(groupMembershipData || []);

    const { data: assignedTaskData, error: assignedTaskError } = await (supabase as any)
      .from("tasks")
      .select("id, title, project, priority, due, complete, created_at")
      .eq("user_id", user.id)
      .eq("assigned_person_id", personId)
      .order("complete", { ascending: true })
      .order("due", { ascending: true, nullsFirst: false });

    if (assignedTaskError) {
      toast.error(assignedTaskError.message);
    }

    setAssignedTasks(assignedTaskData || []);

    const { data: collaborationData, error: collaborationError } = await (supabase as any)
      .from("project_collaborators")
      .select("id, project_id, person_id, role, created_at")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("created_at", { ascending: false });

    if (collaborationError) {
      toast.error(collaborationError.message);
    }

    const collaborations = collaborationData || [];
    setProjectCollaborations(collaborations);

    const projectIds = Array.from(
      new Set(collaborations.map((collaboration: ProjectCollaboration) => collaboration.project_id))
    );

    if (projectIds.length > 0) {
      const { data: collaborationProjectData, error: collaborationProjectError } = await (supabase as any)
        .from("projects")
        .select("id, name, area, status, notes")
        .eq("user_id", user.id)
        .in("id", projectIds);

      if (collaborationProjectError) {
        toast.error(collaborationProjectError.message);
      }

      setCollaborationProjects(collaborationProjectData || []);
    } else {
      setCollaborationProjects([]);
    }

    const { data: assignmentData, error: assignmentError } = await (supabase as any)
      .from("service_team_assignments")
      .select("id, service_id, team_id, role_name, notes, created_at")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      toast.error(assignmentError.message);
    }

    const nextAssignments = assignmentData || [];
    setServiceAssignments(nextAssignments);

    const serviceIds = Array.from(
      new Set(nextAssignments.map((assignment: ServiceAssignment) => assignment.service_id))
    );

    if (serviceIds.length > 0) {
      const { data: serviceData, error: servicesError } = await (supabase as any)
        .from("service_instances")
        .select("id, title, service_date, start_time, location")
        .eq("user_id", user.id)
        .in("id", serviceIds)
        .order("service_date", { ascending: false });

      if (servicesError) {
        toast.error(servicesError.message);
      }

      setAssignmentServices(serviceData || []);
    } else {
      setAssignmentServices([]);
    }

    const { data: trainingAssignmentData, error: trainingAssignmentError } = await (supabase as any)
      .from("training_assignments")
      .select("id, workspace_id, course_id, person_id, status, progress, due_date, completed_at")
      .eq("workspace_id", currentPerson.workspace_id)
      .eq("person_id", personId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (trainingAssignmentError) {
      toast.error(trainingAssignmentError.message);
    }

    const nextTrainingAssignments = trainingAssignmentData || [];
    const { data: trainingCourseData, error: trainingCourseError } = await (supabase as any)
      .from("training_courses")
      .select("id, title, category, estimated_minutes, status")
      .eq("workspace_id", currentPerson.workspace_id)
      .neq("status", "Archived")
      .order("title", { ascending: true });

    if (trainingCourseError) {
      toast.error(trainingCourseError.message);
    }

    const nextTrainingCourses = trainingCourseData || [];
    setTrainingCourses(nextTrainingCourses);

    const trainingCourseIds = Array.from(
      new Set(nextTrainingAssignments.map((assignment: TrainingAssignment) => assignment.course_id))
    );

    if (trainingCourseIds.length > 0) {
      const coursesById = nextTrainingCourses.reduce<Record<string, TrainingCourse>>(
        (acc, course: TrainingCourse) => {
          acc[course.id] = course;
          return acc;
        },
        {}
      );

      setTrainingAssignments(
        nextTrainingAssignments.map((assignment: TrainingAssignment) => ({
          ...assignment,
          course: coursesById[assignment.course_id] || null,
        }))
      );
    } else {
      setTrainingAssignments([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPerson();
  }, [user, personId, currentPerson?.workspace_id]);

  const cancelEdit = () => {
    if (!person) return;

    setFirstName(person.first_name || "");
    setLastName(person.last_name || "");
    setPhoneNumber(formatPhoneForDisplay(person.phone_number) || "");
    setEmail(person.email || "");
    setGender(person.gender || "");
    setMembershipStatus(person.membership_status || "Member");
    setNotes(person.notes || "");
    setEditing(false);
  };

  const updatePerson = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !person || !canEditProfile) return;

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(" ");

    if (!cleanFirstName) {
      toast.error("First name is required.");
      return;
    }

    const { error } = await (supabase as any).rpc("update_workspace_person_profile", {
      target_person_id: person.id,
      next_first_name: cleanFirstName,
      next_last_name: cleanLastName || "",
      next_phone_number: normalizePhoneForStorage(phoneNumber) || "",
      next_email: normalizeEmail(email) || "",
      next_gender: gender.trim() || "",
      next_membership_status: membershipStatus,
      next_notes: notes.trim() || "",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Person updated");
    setEditing(false);
    fetchPerson();
  };

  const updateTrainingAssignment = async (
    assignment: PersonTrainingAssignment,
    updates: Partial<Pick<TrainingAssignment, "status" | "progress" | "due_date">>
  ) => {
    if (!canManageTraining) return;

    const nextProgress =
      updates.progress !== undefined
        ? Math.max(0, Math.min(100, Number(updates.progress) || 0))
        : assignment.progress;
    const nextStatus = updates.status || getProgressStatus(nextProgress);
    const nextDueDate =
      updates.due_date !== undefined
        ? updates.due_date || null
        : assignment.due_date;

    const { error } = await (supabase as any)
      .from("training_assignments")
      .update({
        status: nextStatus,
        progress: nextProgress,
        due_date: nextDueDate,
        completed_at: nextStatus === "Complete" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTrainingAssignments((current) =>
      current.map((item) =>
        item.id === assignment.id
          ? {
              ...item,
              status: nextStatus,
              progress: nextProgress,
              due_date: nextDueDate,
              completed_at: nextStatus === "Complete" ? new Date().toISOString() : null,
            }
          : item
      )
    );

    toast.success("Training updated");
  };

  const openAssignTraining = () => {
    if (!canManageTraining) return;

    setSelectedTrainingCourseId(availableTrainingCourses[0]?.id || "");
    setTrainingDueDate("");
    setAssignTrainingOpen(true);
  };

  const assignTrainingToPerson = async (event: FormEvent) => {
    event.preventDefault();

    if (!user?.id || !person || !currentPerson?.workspace_id || !canManageTraining) return;

    if (!selectedTrainingCourseId) {
      toast.error("Choose a training course.");
      return;
    }

    setAssigningTraining(true);

    const { error } = await (supabase as any)
      .from("training_assignments")
      .upsert(
        {
          workspace_id: currentPerson.workspace_id,
          course_id: selectedTrainingCourseId,
          person_id: person.id,
          assigned_by: user.id,
          status: "Not Started",
          progress: 0,
          due_date: trainingDueDate || null,
        },
        { onConflict: "course_id,person_id" }
      );

    if (error) {
      setAssigningTraining(false);
      toast.error(error.message);
      return;
    }

    const assignedCourse = trainingCourses.find((course) => course.id === selectedTrainingCourseId);

    await createNotificationForPerson({
      personId: person.id,
      currentUserId: user.id,
      actorPersonId: currentPerson?.id || null,
      title: "Training assigned",
      message: `You were assigned ${assignedCourse?.title || "a training course"}.`,
      type: "training",
      entityType: "training",
      entityId: selectedTrainingCourseId,
    });

    setAssigningTraining(false);
    setAssignTrainingOpen(false);
    setSelectedTrainingCourseId("");
    setTrainingDueDate("");
    toast.success("Training assigned");
    fetchPerson();
  };


  const todayDateKey = new Date().toISOString().slice(0, 10);

  const getServiceForAssignment = (serviceId: string) => {
    return assignmentServices.find((serviceItem) => serviceItem.id === serviceId) || null;
  };

  const upcomingServiceAssignments = serviceAssignments
    .filter((assignment) => {
      const linkedService = getServiceForAssignment(assignment.service_id);
      return linkedService?.service_date && linkedService.service_date >= todayDateKey;
    })
    .sort((a, b) => {
      const aService = getServiceForAssignment(a.service_id);
      const bService = getServiceForAssignment(b.service_id);
      return (aService?.service_date || "").localeCompare(bService?.service_date || "");
    });

  const pastServiceAssignments = serviceAssignments
    .filter((assignment) => {
      const linkedService = getServiceForAssignment(assignment.service_id);
      return !linkedService?.service_date || linkedService.service_date < todayDateKey;
    })
    .sort((a, b) => {
      const aService = getServiceForAssignment(a.service_id);
      const bService = getServiceForAssignment(b.service_id);
      return (bService?.service_date || "").localeCompare(aService?.service_date || "");
    });

  const assignedTrainingCourseIds = new Set(
    trainingAssignments.map((assignment) => assignment.course_id)
  );
  const availableTrainingCourses = trainingCourses.filter(
    (course) => !assignedTrainingCourseIds.has(course.id)
  );

  const openAssignedTasks = assignedTasks.filter((task) => !task.complete);
  const completedAssignedTasks = assignedTasks.filter((task) => task.complete);

  const getProjectForCollaboration = (projectId: string) => {
    return collaborationProjects.find((project) => project.id === projectId) || null;
  };

  const uploadAvatar = async (file?: File | null) => {
    if (!user || !person || !file || !canEditProfile) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${user.id}/${person.id}-${Date.now()}.${fileExt}`;

    toast.info("Uploading profile picture...");

    const { error: uploadError } = await supabase.storage
      .from("people-avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("people-avatars")
      .getPublicUrl(filePath);

    if (!data.publicUrl) {
      toast.error("Could not generate public image URL.");
      return;
    }

    const { error: updateError } = await (supabase as any)
      .from("people")
      .update({
        avatar_url: data.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id)
      .eq("workspace_id", currentPerson?.workspace_id);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    setPerson({
      ...person,
      avatar_url: data.publicUrl,
      updated_at: new Date().toISOString(),
    });

    toast.success("Profile picture updated");
    fetchPerson();
  };

  const removeAvatar = async () => {
    if (!user || !person || !canEditProfile) return;

    const confirmed = window.confirm("Remove this profile picture?");
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("people")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id)
      .eq("workspace_id", currentPerson?.workspace_id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPerson({
      ...person,
      avatar_url: null,
      updated_at: new Date().toISOString(),
    });

    toast.success("Profile picture removed");
    fetchPerson();
  };

  if (loading) {
    return (
      <div className="px-4 py-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel p-4 sm:p-5">
          <div className="actsix-loading-state" role="status">Loading person profile...</div>
        </Card>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="px-4 py-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel p-4 sm:p-5">
          <div className="actsix-empty-state">Person not found.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 px-4 pb-12 pt-5 sm:px-6 xl:px-8 2xl:px-10">
      <Card className="actsix-panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex min-w-0 items-start gap-4">
            <PersonAvatar
              name={person.display_name}
              avatarUrl={person.avatar_url}
              size="xl"
              shape="rounded"
              className="rounded-3xl"
            />

            <div className="min-w-0">
              <p className="label-eyebrow">People</p>
              <h1 className="mt-1.5 truncate text-2xl font-extrabold leading-tight md:text-3xl">
                {person.display_name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {person.phone_number && (
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhoneForDisplay(person.phone_number)}
                </span>
              )}

              {person.email && (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {person.email}
                </span>
              )}

              {person.gender && (
                <span className="inline-flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {person.gender}
                </span>
              )}

              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
                {person.membership_status || "Member"}
              </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {isMessageablePhone(person.phone_number) ? (
              <a
                href={getWhatsappHref(person.phone_number)}
                target="_blank"
                rel="noreferrer"
                className="actsix-btn-outline inline-flex h-9 gap-2 border-brand-teal px-3 text-sm font-bold text-brand-teal"
              >
                <Send className="h-4 w-4" />
                Message
              </a>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="cursor-not-allowed text-muted-foreground/50"
                disabled
                title={person.phone_number ? "Invalid phone format. Use +27..." : "No phone number"}
              >
                <Send className="h-4 w-4" />
                Message
              </Button>
            )}

            <label className={`inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-background px-4 text-sm font-bold text-foreground transition ${canEditProfile ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-50"}`}>
              <Camera className="h-4 w-4" />
              Upload Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!canEditProfile}
                onChange={(event) => {
                  uploadAvatar(event.target.files?.[0]).finally(() => {
                    event.currentTarget.value = "";
                  });
                }}
              />
            </label>

            {canEditProfile && person.avatar_url && (
              <Button
                type="button"
                variant="outline"
                className="actsix-btn-outline text-muted-foreground"
                onClick={removeAvatar}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}

            {!canEditProfile && (
              <div className="actsix-loading-state max-w-xs px-3 py-2 text-xs leading-5">
                You can view this profile, but only admins/editors can edit other people.
              </div>
            )}

            <Button
              type="button"
              className="actsix-btn-primary"
              onClick={() => setEditing(true)}
              disabled={!canEditProfile}
            >
              Edit Profile
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="actsix-panel-soft bg-background/70 p-4">
              <p className="label-eyebrow">Profile Notes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {person.notes || "No notes added yet."}
              </p>
            </Card>

            <Card className="border-border/70 bg-background/70 p-4">
              <p className="label-eyebrow">Teams & Roles</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Ministry connections
              </h2>

              {memberships.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  This person is not linked to any teams yet. The next patch will connect team members to People profiles.
                </div>
              )}

              {memberships.length > 0 && (
                <div className="actsix-interactive-row mt-4 divide-y divide-border overflow-hidden bg-card">
                  {memberships.map((membership) => (
                    <div key={membership.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                        <Users className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold tracking-tight">
                          {membership.service_teams?.name || "Service Team"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {membership.role_name || "No role assigned"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="actsix-panel-soft bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-eyebrow">Groups</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    People group connections
                  </h2>
                </div>

                <Link
                  to="/groups"
                  className="actsix-btn-outline inline-flex h-9 px-3 text-sm font-bold text-foreground"
                >
                  View Groups
                </Link>
              </div>

              {groupMemberships.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  This person is not part of any People Groups yet.
                </div>
              )}

              {groupMemberships.length > 0 && (
                <div className="actsix-interactive-row mt-4 divide-y divide-border overflow-hidden bg-card">
                  {groupMemberships.map((membership) => (
                    <Link
                      key={membership.id}
                      to="/groups"
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-teal/5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                        <Folder className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold tracking-tight">
                          {membership.people_groups?.name || "People Group"}
                        </p>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {membership.people_groups?.people_group_folders?.name || "Uncategorized"}
                          </span>

                          {membership.role && (
                            <>
                              <span>|</span>
                              <span>{membership.role}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card className="actsix-panel-soft bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-eyebrow">Project Collaborations</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    Projects connected to this person
                  </h2>
                </div>

                {projectCollaborations.length > 0 && (
                  <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                    {projectCollaborations.length} project{projectCollaborations.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {projectCollaborations.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  This person is not currently linked to any projects.
                </div>
              )}

              {projectCollaborations.length > 0 && (
                <div className="actsix-interactive-row mt-4 divide-y divide-border overflow-hidden bg-card">
                  {projectCollaborations.map((collaboration) => {
                    const linkedProject = getProjectForCollaboration(collaboration.project_id);

                    return (
                      <Link
                        key={collaboration.id}
                        to={`/tasks/projects/${collaboration.project_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-teal/5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                          <FolderKanban className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold tracking-tight">
                            {linkedProject?.name || "Project"}
                          </p>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {linkedProject?.area && <span>{linkedProject.area}</span>}

                            {collaboration.role && (
                              <>
                                {linkedProject?.area && <span>|</span>}
                                <span>{collaboration.role}</span>
                              </>
                            )}

                            {linkedProject?.status && (
                              <>
                                <span>|</span>
                                <span>{linkedProject.status}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="actsix-panel-soft bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-eyebrow">Training</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    Courses assigned to this person
                  </h2>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {canManageTraining && (
                    <Button
                      type="button"
                      className="actsix-btn-primary h-9 px-3 text-sm"
                      onClick={openAssignTraining}
                      disabled={availableTrainingCourses.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                      Assign Training
                    </Button>
                  )}

                  <Link
                    to="/training"
                    className="actsix-btn-outline inline-flex h-9 px-3 text-sm font-bold text-foreground"
                  >
                    Training Center
                  </Link>
                </div>
              </div>

              {trainingAssignments.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  No training assigned yet.
                </div>
              )}

              {trainingAssignments.length > 0 && (
                <div className="mt-4 space-y-3">
                  {trainingAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-[var(--radius-control)] border border-border/70 bg-background/70 p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                            <BookOpen className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-extrabold tracking-tight">
                              {assignment.course?.title || "Training Course"}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full border border-border bg-background px-2.5 py-1 font-bold">
                                {assignment.course?.category || "General"}
                              </span>

                              {assignment.course?.estimated_minutes && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 className="h-3 w-3" />
                                  {assignment.course.estimated_minutes} min
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {assignment.status === "Complete"
                                  ? "Complete"
                                  : formatDate(assignment.due_date)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClass(assignment.status)}`}>
                          {assignment.status}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px] md:items-end">
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
                            <span>Progress</span>
                            <span>{assignment.progress}%</span>
                          </div>
                          <Progress value={assignment.progress} className="h-2.5 bg-muted" />
                        </div>

                        {canManageTraining && (
                          <div className="grid grid-cols-[1fr_82px] gap-2 sm:grid-cols-[1fr_90px_120px]">
                            <select
                              value={assignment.status}
                              onChange={(event) =>
                                updateTrainingAssignment(assignment, {
                                  status: event.target.value as TrainingAssignment["status"],
                                  progress:
                                    event.target.value === "Complete"
                                      ? 100
                                      : event.target.value === "Not Started"
                                        ? 0
                                        : assignment.progress || 25,
                                })
                              }
                              className="h-10 min-w-0 rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm font-medium outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                            >
                              <option value="Not Started">Not Started</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Complete">Complete</option>
                            </select>

                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={assignment.progress}
                              onChange={(event) =>
                                updateTrainingAssignment(assignment, {
                                  progress: Number(event.target.value),
                                })
                              }
                              className="h-10 border-border/70 bg-background text-sm"
                            />

                            <Input
                              type="date"
                              value={assignment.due_date || ""}
                              onChange={(event) =>
                                updateTrainingAssignment(assignment, {
                                  due_date: event.target.value,
                                })
                              }
                              className="col-span-2 h-10 border-border/70 bg-background text-sm sm:col-span-1"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="actsix-panel-soft bg-background/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-eyebrow">Assigned Tasks</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    Current responsibilities
                  </h2>
                </div>

                {openAssignedTasks.length > 0 && (
                  <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                    {openAssignedTasks.length} open
                  </span>
                )}
              </div>

              {assignedTasks.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  No tasks are currently assigned to this person.
                </div>
              )}

              {assignedTasks.length > 0 && (
                <div className="actsix-interactive-row mt-4 divide-y divide-border overflow-hidden bg-card">
                  {assignedTasks.slice(0, 8).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        task.complete
                          ? "bg-muted text-muted-foreground"
                          : "bg-brand-teal/10 text-brand-teal"
                      }`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-extrabold tracking-tight ${
                          task.complete ? "text-muted-foreground line-through" : "text-foreground"
                        }`}>
                          {task.title}
                        </p>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {task.project && <span>{task.project}</span>}
                          {task.priority && (
                            <>
                              {task.project && <span>|</span>}
                              <span>{task.priority}</span>
                            </>
                          )}
                          {task.due && (
                            <>
                              <span>|</span>
                              <span>{formatDate(task.due)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {task.complete && (
                        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground">
                          Done
                        </span>
                      )}
                    </div>
                  ))}

                  {assignedTasks.length > 8 && (
                    <div className="px-4 py-3 text-xs font-bold text-muted-foreground">
                      Showing latest 8 assigned tasks.
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card className="actsix-panel-soft bg-background/70 p-4">
              <p className="label-eyebrow">Upcoming Services</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Scheduled to serve
              </h2>

              {upcomingServiceAssignments.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  No upcoming service assignments linked to this person.
                </div>
              )}

              {upcomingServiceAssignments.length > 0 && (
                <div className="actsix-interactive-row mt-4 divide-y divide-border overflow-hidden bg-card">
                  {upcomingServiceAssignments.map((assignment) => {
                    const linkedService = getServiceForAssignment(assignment.service_id);

                    return (
                      <Link
                        key={assignment.id}
                        to={`/service-planner/services/${assignment.service_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-teal/5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                          <CalendarDays className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold tracking-tight">
                            {linkedService?.title || "Service"}
                          </p>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{assignment.role_name}</span>

                            {linkedService?.service_date && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatDate(linkedService.service_date)}
                              </span>
                            )}

                            {linkedService?.start_time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {linkedService.start_time.slice(0, 5)}
                              </span>
                            )}

                            {linkedService?.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {linkedService.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="actsix-panel-soft bg-background/70 p-4">
              <p className="label-eyebrow">Past Serving History</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Previous assignments
              </h2>

              {pastServiceAssignments.length === 0 && (
                <div className="actsix-empty-state mt-4 bg-card/70 p-4 text-left">
                  No past service assignments linked to this person yet.
                </div>
              )}

              {pastServiceAssignments.length > 0 && (
                <div className="actsix-interactive-row mt-4 divide-y divide-border overflow-hidden bg-card">
                  {pastServiceAssignments.slice(0, 8).map((assignment) => {
                    const linkedService = getServiceForAssignment(assignment.service_id);

                    return (
                      <Link
                        key={assignment.id}
                        to={`/service-planner/services/${assignment.service_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-teal/5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold tracking-tight">
                            {linkedService?.title || "Service"}
                          </p>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{assignment.role_name}</span>

                            {linkedService?.service_date && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatDate(linkedService.service_date)}
                              </span>
                            )}

                            {linkedService?.start_time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {linkedService.start_time.slice(0, 5)}
                              </span>
                            )}

                            {linkedService?.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {linkedService.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {pastServiceAssignments.length > 8 && (
                    <div className="px-4 py-3 text-xs font-bold text-muted-foreground">
                      Showing latest 8 past assignments.
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <Card className="actsix-panel-soft bg-background/70 p-4">
            <p className="label-eyebrow">Profile Summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Name
                </p>
                <p className="font-bold">{person.display_name}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Phone
                </p>
                <p className="font-bold">{formatPhoneForDisplay(person.phone_number) || "Not added"}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <p className="break-words font-bold">{person.email || "Not added"}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Gender
                </p>
                <p className="font-bold">{person.gender || "Not specified"}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Membership
                </p>
                <p className="font-bold">{person.membership_status || "Member"}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Messaging
                </p>
                <p className="font-bold">
                  {isMessageablePhone(person.phone_number) ? "Available" : "Needs valid phone"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Teams
                </p>
                <p className="font-bold">{memberships.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Groups
                </p>
                <p className="font-bold">{groupMemberships.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Project Collaborations
                </p>
                <p className="font-bold">{projectCollaborations.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Training
                </p>
                <p className="font-bold">
                  {trainingAssignments.filter((assignment) => assignment.status !== "Complete").length} active
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Open Tasks
                </p>
                <p className="font-bold">{openAssignedTasks.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Completed Tasks
                </p>
                <p className="font-bold">{completedAssignedTasks.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Upcoming Services
                </p>
                <p className="font-bold">{upcomingServiceAssignments.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Past Assignments
                </p>
                <p className="font-bold">{pastServiceAssignments.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </Card>

      <Dialog open={assignTrainingOpen} onOpenChange={setAssignTrainingOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={assignTrainingToPerson} className="space-y-4">
            <DialogHeader>
              <p className="label-eyebrow">Training</p>
              <DialogTitle className="text-xl">Assign Training</DialogTitle>
              <DialogDescription>
                Assign a course to {person.display_name} and optionally set a due date.
              </DialogDescription>
            </DialogHeader>

            {availableTrainingCourses.length === 0 ? (
              <div className="actsix-empty-state bg-card/70 p-4 text-left">
                All available training courses are already assigned to this person.
              </div>
            ) : (
              <>
                <div>
                  <label className="label-eyebrow">Course</label>
                  <select
                    value={selectedTrainingCourseId}
                    onChange={(event) => setSelectedTrainingCourseId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    {availableTrainingCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title} · {course.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Due Date</label>
                  <Input
                    type="date"
                    value={trainingDueDate}
                    onChange={(event) => setTrainingDueDate(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </>
            )}

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="actsix-btn-outline"
                onClick={() => setAssignTrainingOpen(false)}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>

              <Button
                type="submit"
                className="actsix-btn-primary"
                disabled={assigningTraining || availableTrainingCourses.length === 0}
              >
                <Plus className="h-4 w-4" />
                {assigningTraining ? "Assigning..." : "Assign Training"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={(open) => !open && cancelEdit()}>
        <DialogContent className="max-w-2xl">
            <form onSubmit={updatePerson} className="space-y-4">
              <DialogHeader>
                <p className="label-eyebrow">People</p>
                <DialogTitle className="text-xl">Edit Profile</DialogTitle>
                <DialogDescription>
                  Update this profile without changing workspace permissions or linked ministry records.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">First Name</label>
                  <Input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                    placeholder="073 775 4927"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Last Name</label>
                  <Input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Phone / WhatsApp Number</label>
                  <Input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Email</label>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Gender</label>
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Membership</label>
                  <select
                    value={membershipStatus}
                    onChange={(event) => setMembershipStatus(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="Member">Member</option>
                    <option value="Adherent">Adherent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </div>

              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="actsix-btn-outline"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary">
                  <Save className="h-4 w-4" />
                  Save Profile
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonDetailPage;
