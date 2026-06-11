import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronDown,
  CheckCircle2,
  Clock3,
  History,
  Edit3,
  Plus,
  ListChecks,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { PeopleSearchSelect, type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompactTaskRow from "@/components/CompactTaskRow";
import TaskEditorModal from "@/components/TaskEditorModal";
import ProjectEditorModal from "@/features/projects/components/ProjectEditorModal";
import { syncProjectStatsById, syncProjectStatsForIds } from "@/lib/syncProjectStats";
import { logActivity } from "@/lib/activityLog";
import { toast } from "sonner";
import {
  addProjectCollaborators,
  createProjectActionTask,
  deleteProject,
  deleteProjectActionTask,
  deleteProjectSection,
  getPeopleByIds,
  getProject,
  getProjectActivityLogs,
  getProjectCollaborators,
  getProjectSections,
  getProjectTasks,
  getWorkspacePeople,
  removeProjectCollaborator,
  updateProject,
  updateProjectActionTask,
  updateProjectNameOnTasks,
  updateProjectNotes,
  updateProjectTaskCompletion,
  upsertProjectSection,
} from "@/features/projects/api/projectsApi";

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

type ProjectSection = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  description: string;
  leader_person_id: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

const isMissingProjectSectionsSchema = (error?: { message?: string; code?: string } | null) => {
  const message = error?.message || "";

  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("project_sections") ||
    message.includes("section_id")
  );
};

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson, loading: currentPersonLoading } = useCurrentPerson();

  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sections, setSections] = useState<ProjectSection[]>([]);
  const [projectSectionsAvailable, setProjectSectionsAvailable] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [openSectionIds, setOpenSectionIds] = useState<Record<string, boolean>>({});
  const [openCompletedSectionIds, setOpenCompletedSectionIds] = useState<Record<string, boolean>>({});
  const [isUnsectionedOpen, setIsUnsectionedOpen] = useState(false);
  const [sectionTaskDrafts, setSectionTaskDrafts] = useState<Record<string, { title: string; due: string; assigned_person_id: string }>>({});
  const [notesDraft, setNotesDraft] = useState("");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [editingSection, setEditingSection] = useState<Partial<ProjectSection> | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [collaboratorRole, setCollaboratorRole] = useState("Collaborator");

  const load = async () => {
    if (!user || !projectId || !currentPerson?.workspace_id) return;

    setLoading(true);
    setLoadError(null);

    const { data: projectData, error: projectError } = await getProject(projectId);

    if (projectError) {
      setLoadError(projectError.message || "Could not load this project.");
      setLoading(false);
      toast.error(projectError.message);
      return;
    }

    const [
      { data: taskData, error: taskError },
      { data: peopleData, error: peopleError },
      { data: collaboratorData, error: collaboratorError },
      { data: sectionData, error: sectionError },
      { data: activityData, error: activityError },
    ] = await Promise.all([
      getProjectTasks(projectData.id),
      getWorkspacePeople(currentPerson.workspace_id),
      getProjectCollaborators(projectId),
      getProjectSections(projectId),
      getProjectActivityLogs({ userId: user.id, projectId }),
    ]);

    if (taskError) {
      setLoadError(taskError.message || "Could not load project tasks.");
      setLoading(false);
      toast.error(taskError.message);
      return;
    }

    if (peopleError) {
      setLoadError(peopleError.message || "Could not load project people.");
      setLoading(false);
      toast.error(peopleError.message);
      return;
    }

    if (collaboratorError) {
      setLoadError(collaboratorError.message || "Could not load project collaborators.");
      setLoading(false);
      toast.error(collaboratorError.message);
      return;
    }

    if (sectionError) {
      if (isMissingProjectSectionsSchema(sectionError)) {
        setProjectSectionsAvailable(false);
        setSections([]);
        setIsUnsectionedOpen(true);
      } else {
        setLoadError(sectionError.message || "Could not load project sections.");
        setLoading(false);
        toast.error(sectionError.message);
        return;
      }
    } else {
      setProjectSectionsAvailable(true);
    }

    if (activityError) {
      setLoadError(activityError.message || "Could not load project activity.");
      setLoading(false);
      toast.error(activityError.message);
      return;
    }

    const peopleById = new Map(
      (peopleData ?? []).map((person: Person) => [person.id, person])
    );

    const enrichedTasks = (taskData ?? []).map((task: any) => ({
      ...task,
      assignedPersonName: task.assigned_person_id
        ? peopleById.get(task.assigned_person_id)?.display_name || ""
        : "",
    }));

    const actorPersonIds = Array.from(
      new Set(
        (activityData ?? [])
          .map((activity: ActivityLog) => activity.actor_person_id)
          .filter(Boolean)
      )
    );

    let actorPeople: { id: string; display_name: string; avatar_url: string | null }[] = [];

    if (actorPersonIds.length > 0) {
      const { data: actorPeopleData, error: actorPeopleError } = await getPeopleByIds({
        workspaceId: currentPerson.workspace_id,
        personIds: actorPersonIds,
      });

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
    setTasks(enrichedTasks);
    setSections(sectionError ? [] : sectionData ?? []);
    setPeople(peopleData ?? []);
    setCollaborators(collaboratorData ?? []);
    setActivityLogs(enrichedActivityLogs);
    setLoading(false);
  };

  const toggleCompletedSection = (sectionId: string) => {
    setOpenCompletedSectionIds((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  useEffect(() => {
    if (currentPersonLoading) {
      setLoading(true);
      return;
    }

    if (user && projectId && currentPerson?.workspace_id) {
      load();
      return;
    }

    if (!user || !projectId || !currentPerson?.workspace_id) {
      setLoading(false);
      setLoadError("Workspace context is required to load this project.");
    }
  }, [user, projectId, currentPerson?.workspace_id, currentPersonLoading]);

  const stats = useMemo(() => {
    const openTasks = tasks.filter((task) => !task.complete);
    const completedTasks = tasks.filter((task) => task.complete);
    const dueSoon = openTasks.filter((task) => Boolean(task.due)).length;
    const progress =
      tasks.length === 0 ? project?.progress ?? 0 : Math.round((completedTasks.length / tasks.length) * 100);

    return { openTasks, completedTasks, dueSoon, progress };
  }, [tasks, project]);

  const assignableProjectPeople = useMemo(() => {
    return collaborators
      .map((collaborator) => collaborator.people)
      .filter(Boolean) as PeopleSearchPerson[];
  }, [collaborators]);

  const collaboratorPeopleById = useMemo(() => {
    return new Map(
      assignableProjectPeople.map((person) => [person.id, person])
    );
  }, [assignableProjectPeople]);

  const sectionGroups = useMemo(() => {
    return sections.map((section) => {
      const sectionTasks = tasks.filter((task) => task.section_id === section.id);
      const openTasks = sectionTasks.filter((task) => !task.complete);
      const completedTasks = sectionTasks.filter((task) => task.complete);

      return {
        section,
        leader: section.leader_person_id
          ? collaboratorPeopleById.get(section.leader_person_id) || null
          : null,
        tasks: sectionTasks,
        openTasks,
        completedTasks,
        progress:
          sectionTasks.length === 0
            ? 0
            : Math.round((completedTasks.length / sectionTasks.length) * 100),
      };
    });
  }, [sections, tasks, collaboratorPeopleById]);

  const unsectionedTasks = useMemo(() => {
    return tasks.filter((task) => !task.section_id);
  }, [tasks]);

  const updateSectionTaskDraft = (
    sectionId: string,
    patch: Partial<{ title: string; due: string; assigned_person_id: string }>
  ) => {
    setSectionTaskDrafts((current) => ({
      ...current,
      [sectionId]: {
        title: "",
        due: "",
        assigned_person_id: "",
        ...(current[sectionId] || {}),
        ...patch,
      },
    }));
  };

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

  const openNewSection = () => {
    if (!projectSectionsAvailable) {
      toast.error("Project Sections need the new Supabase migration before they can be added.");
      return;
    }

    setEditingSection({
      name: "",
      description: "",
      leader_person_id: null,
      status: "Active",
      sort_order: sections.length,
    });
  };

  const saveSection = async () => {
    if (!editingSection || !project || !user) return;

    if (!projectSectionsAvailable) {
      toast.error("Project Sections need the new Supabase migration before they can be saved.");
      return;
    }

    const nextName = editingSection.name?.trim() || "";

    if (!nextName) {
      toast.error("Section name is required");
      return;
    }

    setSavingSection(true);

    const payload = {
      name: nextName,
      description: editingSection.description || "",
      leader_person_id: editingSection.leader_person_id || null,
      status: editingSection.status || "Active",
      sort_order: Number(editingSection.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await upsertProjectSection({
      sectionId: editingSection.id,
      userId: user.id,
      projectId: project.id,
      payload,
    });

    setSavingSection(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logProjectActivity(
      editingSection.id ? "section_updated" : "section_added",
      editingSection.id ? "Section updated" : "Section added",
      nextName,
      { section_id: editingSection.id || null }
    );

    toast.success(editingSection.id ? "Section updated" : "Section added");
    setEditingSection(null);
    load();
  };

  const deleteSection = async (section: ProjectSection) => {
    const confirmed = window.confirm(
      `Delete "${section.name}"? Its tasks will stay on the project without a section.`
    );

    if (!confirmed) return;

    const { error } = await deleteProjectSection(section.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logProjectActivity(
      "section_deleted",
      "Section deleted",
      section.name,
      { section_id: section.id }
    );

    toast.success("Section deleted");
    load();
  };

  const addProjectAction = async (sectionId: string, event?: React.FormEvent) => {
    event?.preventDefault();

    const draft = sectionTaskDrafts[sectionId] || {
      title: "",
      due: "",
      assigned_person_id: "",
    };

    if (!draft.title.trim() || !user || !project) return;

    const { error } = await createProjectActionTask({
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      user_id: user.id,
      project: project.name,
      project_id: project.id,
      section_id: sectionId,
      context: "General",
      priority: "Medium",
      energy: "Medium",
      minutes: 15,
      complete: false,
      notes: "",
      person: "",
      location: "",
      tags: [],
      assigned_person_id: draft.assigned_person_id || null,
      due: draft.due || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsById(project.id);
    await logProjectActivity(
      "task_added",
      "Task added",
      draft.title.trim(),
      { due: draft.due || null, section_id: sectionId }
    );
    setSectionTaskDrafts((current) => ({
      ...current,
      [sectionId]: { title: "", due: "", assigned_person_id: "" },
    }));
    toast.success("Next action added");
    load();
  };

  const toggleTask = async (task: any) => {
    const nextComplete = !task.complete;

    const { error } = await updateProjectTaskCompletion({
      taskId: task.id,
      complete: nextComplete,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsById(task.project_id);
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

    const { error } = await deleteProjectActionTask(id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsById(targetTask?.project_id);
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

    const previousTask = tasks.find((task) => task.id === editingTask.id);
    const previousProjectId = previousTask?.project_id || project?.id || null;

    setSavingTask(true);

    const taskPayload: Record<string, unknown> = {
      title: editingTask.title || "",
      notes: editingTask.notes || "",
      project: editingTask.project || "",
      project_id: editingTask.project_id || project?.id || null,
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
    };

    if (projectSectionsAvailable) {
      taskPayload.section_id = editingTask.section_id || null;
    }

    const { error } = await updateProjectActionTask({
      taskId: editingTask.id,
      payload: taskPayload,
    });

    setSavingTask(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsForIds([previousProjectId, editingTask.project_id || project?.id]);
    await logProjectActivity(
      "task_updated",
      "Task updated",
      editingTask.title || "Project task updated",
      { task_id: editingTask.id, previous_project: previousTask?.project || "", next_project: editingTask.project }
    );

    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const saveNotes = async () => {
    if (!project) return;

    const { error } = await updateProjectNotes({
      projectId: project.id,
      notes: notesDraft,
    });

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
    const { error } = await deleteProject(targetProject.id);

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

    const { error } = await addProjectCollaborators({
      userId: user.id,
      projectId: project.id,
      personIds: selectedPersonIds,
      role: collaboratorRole.trim() || "Collaborator",
    });

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
    const { error } = await removeProjectCollaborator({
      collaboratorId,
      userId: user?.id,
    });

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
      const { error } = await updateProject(editingProject.id, {
          name: nextName,
          area: editingProject.area || "General",
          status: editingProject.status || "In Progress",
          notes: editingProject.notes || "",
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      if (previousName !== nextName) {
        const { error: taskError } = await updateProjectNameOnTasks({
          projectId: project.id,
          name: nextName,
        });

        if (taskError) throw taskError;
      }

      await syncProjectStatsById(project.id);
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

  if (loading && !project) {
    return (
      <div>
        <PageHeader eyebrow="Tasks" title="Project" subtitle="Loading project..." />

        <div className="actsix-page-body">
          <Card className="actsix-panel p-6 sm:p-7">
            <div className="actsix-loading-state min-h-[16rem]">
              Loading project details...
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if ((loadError || !project) && !loading) {
    return (
      <div>
        <PageHeader
          eyebrow="Tasks"
          title="Project"
          subtitle="We could not load this project."
        />

        <div className="actsix-page-body">
          <Card className="actsix-panel flex max-w-2xl flex-col items-start gap-4 p-6 sm:p-7">
            <div>
              <p className="text-base font-semibold text-foreground">
                This project is unavailable right now.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try again to load project details, collaborators, and tasks.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={load}>
                Retry
              </Button>
              <Button asChild type="button" className="actsix-btn-soft rounded-xl">
                <Link to="/tasks/projects">Back to Projects</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title={project.name}
        subtitle={project.area || "General"}
      />

      <div className="w-full space-y-5 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel overflow-hidden">
          <div className="border-b border-border/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  Project Summary
                </div>

                <div className="mt-3">
                  <span className={`chip ${statusClass(project.status)}`}>
                    {project.status || "In Progress"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-1">
                  <div className="flex -space-x-2">
                    {collaborators.slice(0, 5).map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="group relative rounded-full"
                        title={`${collaborator.people?.display_name || "Person"} - ${collaborator.role || "Collaborator"}`}
                      >
                        <PersonAvatar
                          name={collaborator.people?.display_name}
                          avatarUrl={collaborator.people?.avatar_url}
                          size="sm"
                          className="border-2 border-background shadow-sm ring-1 ring-border"
                        />

                        <button
                          type="button"
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/25"
                          onClick={() => removeCollaborator(collaborator.id)}
                          aria-label="Remove collaborator"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <span className="text-xs font-extrabold text-muted-foreground">
                    {collaborators.length === 0
                      ? "No collaborators"
                      : `${collaborators.length} collaborator${collaborators.length === 1 ? "" : "s"}`}
                  </span>

                  {collaborators.length > 5 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-extrabold text-muted-foreground">
                      +{collaborators.length - 5}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg px-2.5"
                  onClick={() => setAddCollaboratorOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Collaborator
                </Button>

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

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {project.notes || "Add notes to describe this project, its goal, and what success looks like."}
            </p>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-extrabold">Progress</p>
                <p className="font-extrabold">{stats.progress}%</p>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-brand-teal rounded-full"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
            </div>

            <div className="actsix-panel-soft mt-5 grid gap-px overflow-hidden md:grid-cols-3">
              <div className="bg-background/55 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-brand-teal mx-auto mb-1" />
                <div className="text-xl font-extrabold">{stats.openTasks.length}</div>
                <p className="text-[11px] text-muted-foreground">Open Actions</p>
              </div>

              <div className="bg-background/55 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 text-brand-sage mx-auto mb-1" />
                <div className="text-xl font-extrabold">{stats.completedTasks.length}</div>
                <p className="text-[11px] text-muted-foreground">Completed</p>
              </div>

              <div className="bg-background/55 p-3 text-center">
                <Clock3 className="h-5 w-5 text-brand-amber mx-auto mb-1" />
                <div className="text-xl font-extrabold">{stats.dueSoon}</div>
                <p className="text-[11px] text-muted-foreground">Due Soon</p>
              </div>
            </div>
          </div>

          <div className="border-b border-border/70 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-extrabold">Sections & Tasks</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Group project actions by workstream and assign a leader from collaborators.
                </p>
              </div>

              <div className="grid w-full grid-cols-[1fr_auto] items-center gap-2 sm:w-auto sm:flex">
                <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                  {sections.length} section{sections.length === 1 ? "" : "s"}
                </span>
                <Button
                  type="button"
                  className="actsix-btn-primary rounded-lg sm:w-auto"
                  onClick={openNewSection}
                  disabled={!projectSectionsAvailable}
                >
                  <Plus className="h-4 w-4" />
                  Add Section
                </Button>
              </div>
            </div>

            {!projectSectionsAvailable && (
              <div className="mb-4 rounded-lg border border-brand-amber/30 bg-brand-amber/10 p-4 text-sm text-brand-amber">
                Project Sections are ready in the app, but the Supabase migration has not been applied to this database yet.
                Existing project tasks are shown below.
              </div>
            )}

            {sections.length === 0 && (
              <div className="actsix-empty-state min-h-[8rem] text-left">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ListChecks className="h-4 w-4 text-brand-teal" />
                  No project sections yet.
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add sections like Worship, Media, Logistics, or Follow-up, then add tasks inside each section.
                </p>
              </div>
            )}

            {sectionGroups.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                {sectionGroups.map(({ section, leader, openTasks, completedTasks, progress }) => {
                  const draft = sectionTaskDrafts[section.id] || {
                    title: "",
                    due: "",
                    assigned_person_id: "",
                  };
                  const isSectionOpen = Boolean(openSectionIds[section.id]);
                  const taskCount = openTasks.length + completedTasks.length;

                  return (
                    <div
                      key={section.id}
                      className="overflow-hidden rounded-xl border border-border/70 bg-background/65 transition hover:border-brand-teal/25 hover:bg-background"
                    >
                      <div className="flex items-center gap-2 p-3">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                          aria-expanded={isSectionOpen}
                          onClick={() => toggleSection(section.id)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-teal/15 bg-brand-teal/10 text-brand-teal">
                            <ListChecks className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="truncate font-extrabold">{section.name}</h4>
                              <span className={`chip shrink-0 ${statusClass(section.status)}`}>
                                {section.status || "Active"}
                              </span>
                            </div>

                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
                              <span>{openTasks.length} open</span>
                              <span>{completedTasks.length} done</span>
                              <span>{progress}%</span>
                              {leader && (
                                <span className="inline-flex min-w-0 items-center gap-1">
                                  <PersonAvatar
                                    name={leader.display_name}
                                    avatarUrl={leader.avatar_url}
                                    size="xs"
                                  />
                                  <span className="max-w-[120px] truncate">{leader.display_name}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                              isSectionOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <div className="flex shrink-0 items-center gap-1">
                          <span className="hidden rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground sm:inline-flex">
                            {taskCount}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            title="Edit section"
                            aria-label="Edit section"
                            onClick={() => setEditingSection({ ...section })}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
                            title="Delete section"
                            aria-label="Delete section"
                            onClick={() => deleteSection(section)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {isSectionOpen && (
                        <div className="border-t border-border/70 bg-background/45 p-3">
                          {section.description && (
                            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                              {section.description}
                            </p>
                          )}

                          <form
                            onSubmit={(event) => addProjectAction(section.id, event)}
                            className="rounded-xl border border-border/70 bg-background p-3"
                          >
                            <Input
                              value={draft.title}
                              onChange={(event) =>
                                updateSectionTaskDraft(section.id, { title: event.target.value })
                              }
                              placeholder={`Add task to ${section.name}...`}
                              className="h-11 border-border/70 bg-background"
                            />

                            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                              <PeopleSearchSelect
                                people={assignableProjectPeople}
                                selectedPersonId={draft.assigned_person_id}
                                onSelect={(personId) =>
                                  updateSectionTaskDraft(section.id, {
                                    assigned_person_id: personId,
                                  })
                                }
                                placeholder="Assign..."
                                emptyText="No project collaborators found."
                                showAllOnFocus
                              />

                              <Input
                                type="date"
                                value={draft.due}
                                onChange={(event) =>
                                  updateSectionTaskDraft(section.id, { due: event.target.value })
                                }
                                className="h-11 border-border/70 bg-background"
                              />

                              <Button type="submit" className="actsix-btn-primary h-11 rounded-lg px-4">
                                Add
                              </Button>
                            </div>
                          </form>

                          <div className="mt-3 space-y-1.5 rounded-xl border border-border/70 bg-background p-2">
                            {openTasks.length === 0 && completedTasks.length === 0 && (
                              <div className="actsix-empty-state min-h-[6.5rem] gap-2 p-3 text-left text-sm">
                                <ListChecks className="h-4 w-4 text-brand-teal" />
                                No tasks in this section yet.
                              </div>
                            )}

                            {openTasks.map((task) => (
                              <CompactTaskRow
                                key={task.id}
                                task={task}
                                showAssignee
                                onToggle={toggleTask}
                                onEdit={(task) => setEditingTask({ ...task })}
                                onDelete={(task) => removeTask(task.id)}
                              />
                            ))}

                            {completedTasks.length > 0 && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs font-extrabold text-muted-foreground transition hover:bg-brand-teal/5"
                                  aria-expanded={Boolean(openCompletedSectionIds[section.id])}
                                  onClick={() => toggleCompletedSection(section.id)}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-sage" />
                                    Completed
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    {completedTasks.length}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openCompletedSectionIds[section.id] ? "rotate-180" : ""}`} />
                                  </span>
                                </button>

                                {openCompletedSectionIds[section.id] && (
                                  <div className="mt-1 space-y-1.5">
                                    {completedTasks.map((task) => (
                                      <CompactTaskRow
                                        key={task.id}
                                        task={task}
                                        showAssignee
                                        onToggle={toggleTask}
                                        onEdit={(task) => setEditingTask({ ...task })}
                                        onDelete={(task) => removeTask(task.id)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {unsectionedTasks.length > 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-background/65 p-3">
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
                  aria-expanded={isUnsectionedOpen}
                  onClick={() => setIsUnsectionedOpen((open) => !open)}
                >
                  <span className="min-w-0">
                    <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                      <ListChecks className="h-4 w-4 text-brand-teal" />
                      General
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Tasks not assigned to a section yet.
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-border/70 bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    {unsectionedTasks.length}
                  </span>
                </button>

                {isUnsectionedOpen && (
                  <div className="mt-2 space-y-1.5">
                    {unsectionedTasks.map((task) => (
                      <CompactTaskRow
                        key={task.id}
                        task={task}
                        showAssignee
                        onToggle={toggleTask}
                        onEdit={(task) => setEditingTask({ ...task })}
                        onDelete={(task) => removeTask(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-b border-border/70 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold">Activity Log</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activityLogs.length} recent change{activityLogs.length === 1 ? "" : "s"} recorded.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-2.5"
                aria-expanded={isActivityOpen}
                onClick={() => setIsActivityOpen((open) => !open)}
              >
                <History className="h-3.5 w-3.5" />
                {isActivityOpen ? "Hide" : "Show"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isActivityOpen ? "rotate-180" : ""}`} />
              </Button>
            </div>

            {isActivityOpen && activityLogs.length === 0 && (
              <div className="actsix-empty-state min-h-[7rem] text-left">
                Project updates, task changes, and collaborator activity will appear here.
              </div>
            )}

            {isActivityOpen && activityLogs.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
                {activityLogs.map((activity) => (
                  <div key={activity.id} className="flex gap-3 px-4 py-3">
                    <PersonAvatar
                      name={activity.people?.display_name || "ACTSIX"}
                      avatarUrl={activity.people?.avatar_url}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-extrabold">
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
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-extrabold">Notes</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/45 px-4 backdrop-blur-sm">
          <Card className="actsix-panel relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-visible">
            <form onSubmit={addCollaborator} className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 p-6">
                <div>
                  <p className="label-eyebrow">Project Collaborators</p>
                  <h2 className="text-xl font-extrabold leading-tight">
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
                    showAllOnFocus
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

              <div className="relative z-10 flex shrink-0 justify-end gap-2 border-t border-border/70 bg-background/95 p-6">
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

      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/45 p-0 backdrop-blur-sm sm:items-center sm:px-4">
          <Card className="actsix-panel max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-b-none sm:rounded-xl">
            <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4 sm:p-6">
              <div className="min-w-0">
                <p className="label-eyebrow">Project Sections</p>
                <h2 className="text-xl font-extrabold leading-tight">
                  {editingSection.id ? "Edit Section" : "Add Section"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sections group related tasks and can have one leader from the project collaborators.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditingSection(null)}
              >
                Close
              </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              <div>
                <label className="label-eyebrow">Section name</label>
                <Input
                  value={editingSection.name || ""}
                  onChange={(event) =>
                    setEditingSection({ ...editingSection, name: event.target.value })
                  }
                  placeholder="Worship, Media, Logistics..."
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Leader</label>
                  <select
                    value={editingSection.leader_person_id || ""}
                    onChange={(event) =>
                      setEditingSection({
                        ...editingSection,
                        leader_person_id: event.target.value || null,
                      })
                    }
                    className="mt-2 h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option value="">No leader</option>
                    {assignableProjectPeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Add someone as a collaborator before making them a section leader.
                  </p>
                </div>

                <div>
                  <label className="label-eyebrow">Status</label>
                  <select
                    value={editingSection.status || "Active"}
                    onChange={(event) =>
                      setEditingSection({ ...editingSection, status: event.target.value })
                    }
                    className="mt-2 h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option>Not started</option>
                    <option>Active</option>
                    <option>Blocked</option>
                    <option>Complete</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Description</label>
                <textarea
                  value={editingSection.description || ""}
                  onChange={(event) =>
                    setEditingSection({
                      ...editingSection,
                      description: event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Optional notes for this workstream..."
                  className="mt-2 w-full rounded-lg border border-border/70 bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border/70 bg-background/95 p-4 sm:flex sm:justify-end sm:p-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="actsix-btn-primary rounded-xl"
                onClick={saveSection}
                disabled={savingSection}
              >
                <Plus className="h-4 w-4" />
                {savingSection
                  ? "Saving..."
                  : editingSection.id
                    ? "Save Section"
                    : "Add Section"}
              </Button>
            </div>
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

export default ProjectDetailPage;
