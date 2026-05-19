import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  History,
  Edit3,
  Plus,
  ListChecks,
  MessageCircle,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompactTaskRow from "@/components/CompactTaskRow";
import TaskEditorModal from "@/components/TaskEditorModal";
import ProjectEditorModal from "@/components/ProjectEditorModal";
import { syncProjectStats, syncProjectStatsForNames } from "@/lib/syncProjectStats";
import { logActivity } from "@/lib/activityLog";
import { createNotificationForPerson } from "@/lib/notifications";
import { toast } from "sonner";
import { getWhatsappHref, isMessageablePhone } from "@/lib/phone";

type Person = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  phone_number: string | null;
};

type ProjectCollaborator = {
  id: string;
  user_id: string;
  project_id: string;
  person_id: string;
  role: string | null;
  created_at: string;
  people?: Person | null;
};

type ActivityLog = {
  id: string;
  actor_person_id: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  people?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

const statusClass = (status?: string | null) => {
  const clean = (status || "Active").toLowerCase();

  if (clean.includes("hold")) return "bg-brand-amber/15 text-brand-amber";
  if (clean.includes("planning")) return "bg-brand-teal-soft text-brand-teal";
  if (clean.includes("complete")) return "bg-brand-sage/10 text-brand-sage";

  return "bg-brand-teal/15 text-brand-teal";
};

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [project, setProject] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDue, setNewActionDue] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [collaboratorRole, setCollaboratorRole] = useState("Collaborator");
  const [collaboratorMessage, setCollaboratorMessage] = useState("");

  const load = async () => {
    if (!user || !projectId) return;

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError) {
      toast.error(projectError.message);
      return;
    }

    const [
      { data: taskData, error: taskError },
      { data: peopleData, error: peopleError },
      { data: collaboratorData, error: collaboratorError },
      { data: activityData, error: activityError },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("project", projectData.name)
        .order("created_at", { ascending: false }),

      (supabase as any)
        .from("people")
        .select("id, user_id, display_name, avatar_url, email, phone_number")
        .eq("user_id", user.id)
        .order("display_name", { ascending: true }),

      (supabase as any)
        .from("project_collaborators")
        .select("id, user_id, project_id, person_id, role, created_at, people(id, user_id, display_name, avatar_url, email, phone_number)")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),

      (supabase as any)
        .from("activity_logs")
        .select("id, actor_person_id, entity_type, entity_id, action_type, title, description, metadata, created_at")
        .eq("user_id", user.id)
        .eq("entity_type", "project")
        .eq("entity_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (taskError) {
      toast.error(taskError.message);
      return;
    }

    if (peopleError) {
      toast.error(peopleError.message);
      return;
    }

    if (collaboratorError) {
      toast.error(collaboratorError.message);
      return;
    }

    if (activityError) {
      toast.error(activityError.message);
      return;
    }

    const actorPersonIds = Array.from(
      new Set(
        (activityData ?? [])
          .map((activity: ActivityLog) => activity.actor_person_id)
          .filter(Boolean)
      )
    );

    let actorPeople: { id: string; display_name: string; avatar_url: string | null }[] = [];

    if (actorPersonIds.length > 0) {
      const { data: actorPeopleData, error: actorPeopleError } = await (supabase as any)
        .from("people")
        .select("id, display_name, avatar_url")
        .eq("user_id", user.id)
        .in("id", actorPersonIds);

      if (actorPeopleError) {
        toast.error(actorPeopleError.message);
      }

      actorPeople = actorPeopleData || [];
    }

    const enrichedActivityLogs = (activityData ?? []).map((activity: ActivityLog) => ({
      ...activity,
      people:
        actorPeople.find((person) => person.id === activity.actor_person_id) || null,
    }));

    setProject(projectData);
    setNotesDraft(projectData.notes || "");
    setTasks(taskData ?? []);
    setPeople(peopleData ?? []);
    setCollaborators(collaboratorData ?? []);
    setActivityLogs(enrichedActivityLogs);
  };

  useEffect(() => {
    load();
  }, [user, projectId]);

  const stats = useMemo(() => {
    const openTasks = tasks.filter((task) => !task.complete);
    const completedTasks = tasks.filter((task) => task.complete);
    const dueSoon = openTasks.filter((task) => Boolean(task.due)).length;
    const progress =
      tasks.length === 0 ? project?.progress ?? 0 : Math.round((completedTasks.length / tasks.length) * 100);

    return { openTasks, completedTasks, dueSoon, progress };
  }, [tasks, project]);

  const logProjectActivity = async (
    actionType: string,
    title: string,
    description?: string | null,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!user || !project) return;

    await logActivity({
      userId: user.id,
      actorPersonId: currentPerson?.id || null,
      entityType: "project",
      entityId: project.id,
      actionType,
      title,
      description,
      metadata,
    });
  };

  const addProjectAction = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!newActionTitle.trim() || !user || !project) return;

    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      title: newActionTitle.trim(),
      user_id: user.id,
      project: project.name,
      context: "General",
      priority: "Medium",
      energy: "Medium",
      minutes: 15,
      complete: false,
      notes: "",
      person: "",
      location: "",
      tags: [],
      assigned_person_id: null,
      due: newActionDue || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(project.name, user.id);
    await logProjectActivity(
      "task_added",
      "Task added",
      newActionTitle.trim(),
      { due: newActionDue || null }
    );
    setNewActionTitle("");
    setNewActionDue("");
    toast.success("Next action added");
    load();
  };

  const toggleTask = async (task: any) => {
    const nextComplete = !task.complete;

    const { error } = await supabase
      .from("tasks")
      .update({
        complete: nextComplete,
        completed_at: nextComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(task.project, user?.id);
    await logProjectActivity(
      nextComplete ? "task_completed" : "task_reopened",
      nextComplete ? "Task completed" : "Task reopened",
      task.title,
      { task_id: task.id }
    );
    load();
  };

  const removeTask = async (taskOrId: any) => {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    const targetTask = tasks.find((task) => task.id === id);

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(targetTask?.project, user?.id);
    await logProjectActivity(
      "task_deleted",
      "Task deleted",
      targetTask?.title || "Project task deleted",
      { task_id: id }
    );
    toast.success("Action deleted");
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    const previousProject = tasks.find((task) => task.id === editingTask.id)?.project || "";

    setSavingTask(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editingTask.title || "",
        notes: editingTask.notes || "",
        project: editingTask.project || "",
        context: editingTask.context || "General",
        priority: editingTask.priority || "Medium",
        energy: editingTask.energy || "Medium",
        minutes: Number(editingTask.minutes) || 15,
        due: editingTask.due || null,
        tags: Array.isArray(editingTask.tags) ? editingTask.tags : [],
        assigned_person_id: editingTask.assigned_person_id || null,
        complete: Boolean(editingTask.complete),
        completed_at: editingTask.complete
          ? editingTask.completed_at || new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingTask.id);

    setSavingTask(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsForNames([previousProject, editingTask.project], user?.id);
    await logProjectActivity(
      "task_updated",
      "Task updated",
      editingTask.title || "Project task updated",
      { task_id: editingTask.id, previous_project: previousProject, next_project: editingTask.project }
    );

    const previousAssignedPersonId =
      tasks.find((task) => task.id === editingTask.id)?.assigned_person_id || null;
    const nextAssignedPersonId = editingTask.assigned_person_id || null;

    if (nextAssignedPersonId && nextAssignedPersonId !== previousAssignedPersonId) {
      await createNotificationForPerson({
        personId: nextAssignedPersonId,
        currentUserId: user.id,
        actorPersonId: currentPerson?.id || null,
        title: "A task was assigned to you",
        message: `${editingTask.title || "A project task"} was assigned to you in ${editingTask.project || project.name}.`,
        type: "task",
        entityType: "project",
        entityId: project.id,
      });
    }
    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const saveNotes = async () => {
    if (!project) return;

    const { error } = await supabase
      .from("projects")
      .update({
        notes: notesDraft,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logProjectActivity(
      "notes_updated",
      "Project notes updated",
      "Project notes were changed"
    );
    toast.success("Project notes saved");
    load();
  };

  const removeProject = async (targetProject: any) => {
    const { error } = await supabase.from("projects").delete().eq("id", targetProject.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Project deleted");
    navigate("/tasks/projects");
  };

  const addCollaborator = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!user || !project || selectedPersonIds.length === 0) return;

    const { error } = await (supabase as any)
      .from("project_collaborators")
      .insert(
        selectedPersonIds.map((personId) => ({
          user_id: user.id,
          project_id: project.id,
          person_id: personId,
          role: collaboratorRole.trim() || "Collaborator",
        }))
      );

    if (error) {
      toast.error(error.message);
      return;
    }

    await logProjectActivity(
      "collaborator_added",
      selectedPersonIds.length === 1 ? "Collaborator added" : "Collaborators added",
      selectedPersonIds.length === 1
        ? "One collaborator was added to this project"
        : `${selectedPersonIds.length} collaborators were added to this project`,
      { person_ids: selectedPersonIds, role: collaboratorRole.trim() || "Collaborator" }
    );

    await Promise.all(
      selectedPersonIds.map((personId) =>
        createNotificationForPerson({
          personId,
          currentUserId: user.id,
          actorPersonId: currentPerson?.id || null,
          title: "You were added to a project",
          message: `You were added to ${project.name} as ${collaboratorRole.trim() || "Collaborator"}.`,
          type: "project",
          entityType: "project",
          entityId: project.id,
        })
      )
    );

    toast.success(
      selectedPersonIds.length === 1
        ? "Collaborator added"
        : `${selectedPersonIds.length} collaborators added`
    );

    setSelectedPersonIds([]);
    setCollaboratorRole("Collaborator");
    setAddCollaboratorOpen(false);
    load();
  };

  const removeCollaborator = async (collaboratorId: string) => {
    const { error } = await (supabase as any)
      .from("project_collaborators")
      .delete()
      .eq("id", collaboratorId)
      .eq("user_id", user?.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logProjectActivity(
      "collaborator_removed",
      "Collaborator removed",
      "A collaborator was removed from this project",
      { collaborator_id: collaboratorId }
    );

    toast.success("Collaborator removed");
    load();
  };

  const availablePeople = people.filter((person) => {
    return !collaborators.some((collaborator) => collaborator.person_id === person.id);
  });

  const messageableCollaborators = collaborators.filter((collaborator) =>
    isMessageablePhone(collaborator.people?.phone_number)
  );

  const nonMessageableCollaborators = collaborators.filter((collaborator) =>
    !isMessageablePhone(collaborator.people?.phone_number)
  );

  const messageProjectCollaborators = () => {
    if (messageableCollaborators.length === 0) {
      toast.error("No collaborators have valid phone numbers.");
      return;
    }

    const encodedMessage = collaboratorMessage.trim()
      ? `?text=${encodeURIComponent(collaboratorMessage.trim())}`
      : "";

    messageableCollaborators.forEach((collaborator, index) => {
      const href = getWhatsappHref(collaborator.people?.phone_number);

      if (!href) return;

      window.setTimeout(() => {
        window.open(`${href}${encodedMessage}`, "_blank", "noopener,noreferrer");
      }, index * 250);
    });

    toast.success(
      messageableCollaborators.length === 1
        ? "Opening WhatsApp message"
        : `Opening ${messageableCollaborators.length} WhatsApp messages`
    );
  };

  const saveProject = async () => {
    if (!editingProject || !user || !project) return;

    const previousName = project.name;
    const nextName = editingProject.name?.trim() || "";

    if (!nextName) {
      toast.error("Project name is required");
      return;
    }

    setSavingProject(true);

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: nextName,
          area: editingProject.area || "General",
          status: editingProject.status || "In Progress",
          notes: editingProject.notes || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingProject.id);

      if (error) throw error;

      if (previousName !== nextName) {
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            project: nextName,
            updated_at: new Date().toISOString(),
          })
          .eq("project", previousName)
          .eq("user_id", user.id);

        if (taskError) throw taskError;
      }

      await syncProjectStats(nextName, user.id);
      await logProjectActivity(
        "project_updated",
        "Project details updated",
        previousName !== nextName
          ? `Project renamed from ${previousName} to ${nextName}`
          : "Project details were updated",
        { previous_name: previousName, next_name: nextName }
      );
      toast.success("Project updated");
      setEditingProject(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update project");
    } finally {
      setSavingProject(false);
    }
  };

  if (!project) {
    return (
      <div>
        <PageHeader eyebrow="ACTSIX: Tasks" title="Project" subtitle="Loading project..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX: Tasks"
        title={project.name}
        subtitle={project.area || "General"}
      />

      <div className="px-8 pb-12 max-w-7xl space-y-6">
<Card className="border-border/70 bg-card shadow-card overflow-hidden">
          <div className="p-6 border-b border-border/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  {project.area || "General"}
                </div>

                <h2 className="text-3xl font-extrabold tracking-tight mt-3 leading-tight">
                  {project.name}
                </h2>

                <div className="mt-3">
                  <span className={`chip ${statusClass(project.status)}`}>
                    {project.status || "In Progress"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Edit project"
                  aria-label="Edit project"
                  onClick={() => setEditingProject({ ...project })}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete project"
                  aria-label="Delete project"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeProject(project)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              {project.notes || "Add notes to describe this project, its goal, and what success looks like."}
            </p>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-extrabold tracking-tight">Progress</p>
                <p className="font-extrabold tracking-tight">{stats.progress}%</p>
              </div>

              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-teal rounded-full"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3 mt-5">
              <div className="rounded-lg border border-border/70 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-brand-teal mx-auto mb-1" />
                <div className="text-xl font-extrabold">{stats.openTasks.length}</div>
                <p className="text-[11px] text-muted-foreground">Open Actions</p>
              </div>

              <div className="rounded-lg border border-border/70 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-brand-sage mx-auto mb-1" />
                <div className="text-xl font-extrabold">{stats.completedTasks.length}</div>
                <p className="text-[11px] text-muted-foreground">Completed</p>
              </div>

              <div className="rounded-lg border border-border/70 p-3 text-center">
                <Clock3 className="h-5 w-5 text-brand-amber mx-auto mb-1" />
                <div className="text-xl font-extrabold">{stats.dueSoon}</div>
                <p className="text-[11px] text-muted-foreground">Due Soon</p>
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-border/70">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-extrabold tracking-tight">Collaborators</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Link People profiles to this project.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setAddCollaboratorOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Collaborator
              </Button>
            </div>

            {collaborators.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                No collaborators added yet.
              </div>
            )}

            {collaborators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1.5 text-sm"
                  >
                    <PersonAvatar
                      name={collaborator.people?.display_name}
                      avatarUrl={collaborator.people?.avatar_url}
                      size="xs"
                    />

                    <span className="font-bold">
                      {collaborator.people?.display_name || "Person"}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {collaborator.role || "Collaborator"}
                    </span>

                    <button
                      type="button"
                      className="ml-1 text-muted-foreground/60 transition hover:text-destructive"
                      onClick={() => removeCollaborator(collaborator.id)}
                      aria-label="Remove collaborator"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {collaborators.length > 0 && (
              <div className="mt-5 rounded-2xl border border-border/70 bg-muted/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="label-eyebrow">Messaging</p>
                    <h4 className="mt-1 font-extrabold tracking-tight">
                      Message collaborators
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Opens WhatsApp chats for collaborators with valid phone numbers.
                    </p>
                  </div>

                  <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                    {messageableCollaborators.length} messageable
                  </span>
                </div>

                <textarea
                  value={collaboratorMessage}
                  onChange={(event) => setCollaboratorMessage(event.target.value)}
                  rows={3}
                  placeholder={`Hi team, quick update on ${project.name}...`}
                  className="mt-4 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />

                {nonMessageableCollaborators.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {nonMessageableCollaborators.length} collaborator{nonMessageableCollaborators.length === 1 ? "" : "s"} will be skipped because they do not have a valid phone number.
                  </p>
                )}

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    className="actsix-btn-primary rounded-xl"
                    onClick={messageProjectCollaborators}
                    disabled={messageableCollaborators.length === 0}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message Collaborators
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 border-b border-border/70">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold tracking-tight">Next Actions</h3>
              <span className="text-xs text-brand-teal font-bold">
                {stats.openTasks.length} open
              </span>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/10 p-2 space-y-1.5">
              {tasks.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  No actions attached yet.
                </div>
              )}

              {tasks.map((task) => (
                <CompactTaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onEdit={(task) => setEditingTask({ ...task })}
                  onDelete={(task) => removeTask(task.id)}
                />
              ))}
            </div>

            <form
              onSubmit={addProjectAction}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto] mt-4"
            >
              <Input
                value={newActionTitle}
                onChange={(event) => setNewActionTitle(event.target.value)}
                placeholder="What needs to be done?"
                className="border-border/70 bg-background"
              />

              <Input
                type="date"
                value={newActionDue}
                onChange={(event) => setNewActionDue(event.target.value)}
                className="border-border/70 bg-background"
              />

              <Button type="submit" className="actsix-btn-primary rounded-xl px-4">
                Add
              </Button>
            </form>
          </div>

          <div className="p-5 border-b border-border/70">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold tracking-tight">Activity Log</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Recent changes made to this collaborative project.
                </p>
              </div>

              <History className="h-4 w-4 text-muted-foreground" />
            </div>

            {activityLogs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                No activity recorded yet.
              </div>
            )}

            {activityLogs.length > 0 && (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-background">
                {activityLogs.map((activity) => (
                  <div key={activity.id} className="flex gap-3 px-4 py-3">
                    <PersonAvatar
                      name={activity.people?.display_name || "ACTSIX"}
                      avatarUrl={activity.people?.avatar_url}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-extrabold tracking-tight">
                          {activity.title}
                        </p>

                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </span>
                      </div>

                      {activity.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold tracking-tight">Notes</h3>
              <Button variant="ghost" size="sm" className="text-brand-teal" onClick={saveNotes}>
                Save
              </Button>
            </div>

            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              className="min-h-28 w-full rounded-lg border border-border/70 bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add project notes..."
            />
          </div>
        </Card>
      </div>

      {addCollaboratorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-visible border-border/70 bg-card shadow-card">
            <form onSubmit={addCollaborator} className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 p-6">
                <div>
                  <p className="label-eyebrow">Project Collaborators</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Add Collaborators
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose People profiles to connect to this project.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setSelectedPersonIds([]);
                    setCollaboratorRole("Collaborator");
                    setAddCollaboratorOpen(false);
                  }}
                >
                  Close
                </Button>
              </div>

              <div className="relative z-20 min-h-0 flex-1 space-y-4 overflow-visible p-6">

              <div>
                <label className="label-eyebrow">People</label>
                <div className="mt-2">
                  <PeopleMultiSearchSelect
                    people={availablePeople}
                    selectedPersonIds={selectedPersonIds}
                    onChange={setSelectedPersonIds}
                    placeholder="Search by name, email, or phone..."
                    emptyText="No available collaborators found."
                  />
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Role</label>
                <Input
                  value={collaboratorRole}
                  onChange={(event) => setCollaboratorRole(event.target.value)}
                  placeholder="Collaborator"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              {availablePeople.length === 0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Everyone in People is already linked to this project.
                </div>
              )}
              </div>

              <div className="relative z-10 flex shrink-0 justify-end gap-2 border-t border-border/70 bg-card p-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setSelectedPersonIds([]);
                    setCollaboratorRole("Collaborator");
                    setAddCollaboratorOpen(false);
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary rounded-xl"
                  disabled={selectedPersonIds.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  {selectedPersonIds.length > 1 ? `Add ${selectedPersonIds.length} Collaborators` : "Add Collaborator"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <ProjectEditorModal
        project={editingProject}
        saving={savingProject}
        onChange={setEditingProject}
        onClose={() => setEditingProject(null)}
        onSave={saveProject}
        onDelete={
          editingProject
            ? () => {
                removeProject(editingProject);
                setEditingProject(null);
              }
            : undefined
        }
      />

      <TaskEditorModal
        task={editingTask}
        saving={savingTask}
        eyebrow="Edit Project Action"
        description="Edit this project action using the shared ACTSIX task editor."
        onChange={setEditingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
        onDelete={
          editingTask
            ? () => {
                removeTask(editingTask.id);
                setEditingTask(null);
              }
            : undefined
        }
        onRefreshOptions={load}
      />
    </div>
  );
};

export default ProjectDetail;
