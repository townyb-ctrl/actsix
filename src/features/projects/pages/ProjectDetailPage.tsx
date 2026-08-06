import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { type PeopleSearchPerson } from "@/components/people/PeopleSearchSelect";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskEditorModal from "@/components/TaskEditorModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormDialog } from "@/components/ui/form-dialog";
import ProjectEditorModal from "@/features/projects/components/ProjectEditorModal";
import ProjectSectionEditorModal, {
  type ProjectSection,
} from "@/features/projects/components/ProjectSectionEditorModal";
import ProjectDetailHero from "@/features/projects/components/ProjectDetailHero";
import ProjectDetailSidebar from "@/features/projects/components/ProjectDetailSidebar";
import ProjectSectionRail from "@/features/projects/components/ProjectSectionRail";
import ProjectTaskPane, { type TaskFilter } from "@/features/projects/components/ProjectTaskPane";
import { type NewTaskDraft } from "@/features/projects/components/ProjectAddTaskRow";
import { uploadProjectCover } from "@/features/projects/lib/uploadProjectCover";
import { syncProjectStatsById, syncProjectStatsForIds } from "@/lib/syncProjectStats";
import { logActivity } from "@/lib/activityLog";
import { friendlyErrorMessage } from "@/lib/friendlyError";
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
  updateProjectTaskCompletion,
  upsertProjectCalendarEvent,
  upsertProjectSection,
} from "@/features/projects/api/projectsApi";

type Person = {
  id: string;
  user_id: string;
  auth_user_id?: string | null;
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

const isMissingProjectSectionsSchema = (error?: { message?: string; code?: string } | null) => {
  const message = error?.message || "";

  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("project_sections") ||
    message.includes("section_id")
  );
};

const ALL_TASKS_ID = "__all";
const GENERAL_SECTION_ID = "__general";
const DUE_SOON_DAYS = 7;

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const toIsoDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const daysUntilDue = (due?: string | null) => {
  if (!due) return null;

  const parsed = new Date(due);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
};

const isDueSoon = (task: any) => {
  if (task.complete) return false;

  const days = daysUntilDue(task.due);
  return days !== null && days <= DUE_SOON_DAYS;
};

/** Open work first, soonest due first, then oldest. Completed sinks to the bottom. */
const sortProjectTasks = (tasks: any[]) => {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.complete) !== Boolean(b.complete)) return a.complete ? 1 : -1;

    if (a.complete && b.complete) {
      return (
        new Date(b.completed_at || b.updated_at || 0).getTime() -
        new Date(a.completed_at || a.updated_at || 0).getTime()
      );
    }

    const aDue = a.due ? new Date(a.due).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due ? new Date(b.due).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
};

const toProgress = (tasks: any[]) => {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.complete).length / tasks.length) * 100);
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
  const [activeSectionId, setActiveSectionId] = useState<string>(ALL_TASKS_ID);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("open");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [editingSection, setEditingSection] = useState<Partial<ProjectSection> | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [collaboratorRole, setCollaboratorRole] = useState("Collaborator");
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  type PendingDelete =
    | { kind: "project"; project: any }
    | { kind: "section"; section: ProjectSection }
    | { kind: "collaborator"; collaboratorId: string; label: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const load = async ({ showLoading = false } = {}) => {
    if (!user || !projectId || !currentPerson?.workspace_id) return;

    if (showLoading) {
      setLoading(true);
    }
    setLoadError(null);

    const { data: projectData, error: projectError } = await getProject(projectId);

    if (projectError) {
      setLoadError(projectError.message || "Could not load this project.");
      setLoading(false);
      toast.error(friendlyErrorMessage(projectError));
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
      toast.error(friendlyErrorMessage(taskError));
      return;
    }

    if (peopleError) {
      setLoadError(peopleError.message || "Could not load project people.");
      setLoading(false);
      toast.error(friendlyErrorMessage(peopleError));
      return;
    }

    if (collaboratorError) {
      setLoadError(collaboratorError.message || "Could not load project collaborators.");
      setLoading(false);
      toast.error(friendlyErrorMessage(collaboratorError));
      return;
    }

    if (sectionError) {
      if (isMissingProjectSectionsSchema(sectionError)) {
        setProjectSectionsAvailable(false);
        setSections([]);
      } else {
        setLoadError(sectionError.message || "Could not load project sections.");
        setLoading(false);
        toast.error(friendlyErrorMessage(sectionError));
        return;
      }
    } else {
      setProjectSectionsAvailable(true);
    }

    if (activityError) {
      setLoadError(activityError.message || "Could not load project activity.");
      setLoading(false);
      toast.error(friendlyErrorMessage(activityError));
      return;
    }

    const peopleById = new Map<string, Person>(
      (peopleData ?? []).map((person: Person): [string, Person] => [person.id, person])
    );

    const enrichedTasks = (taskData ?? []).map((task: any) => ({
      ...task,
      assignedPersonName: task.assigned_person_id
        ? peopleById.get(task.assigned_person_id)?.display_name || ""
        : "",
    }));

    const actorPersonIds: string[] = Array.from(
      new Set(
        (activityData ?? [])
          .map((activity: ActivityLog) => activity.actor_person_id)
          .filter((id: string | null): id is string => Boolean(id))
      )
    );

    let actorPeople: { id: string; display_name: string; avatar_url: string | null }[] = [];

    if (actorPersonIds.length > 0) {
      const { data: actorPeopleData, error: actorPeopleError } = await getPeopleByIds({
        workspaceId: currentPerson.workspace_id,
        personIds: actorPersonIds,
      });

      if (actorPeopleError) {
        toast.error(friendlyErrorMessage(actorPeopleError));
      }

      actorPeople = actorPeopleData || [];
    }

    const enrichedActivityLogs = (activityData ?? []).map((activity: ActivityLog) => ({
      ...activity,
      people:
        actorPeople.find((person) => person.id === activity.actor_person_id) || null,
    }));

    setProject(projectData);
    setTasks(enrichedTasks);
    setSections(sectionError ? [] : sectionData ?? []);
    setPeople(peopleData ?? []);
    setCollaborators(collaboratorData ?? []);
    setActivityLogs(enrichedActivityLogs);
    setLoading(false);
  };

  useEffect(() => {
    if (currentPersonLoading) {
      setLoading(true);
      return;
    }

    if (user && projectId && currentPerson?.workspace_id) {
      load({ showLoading: true });
      return;
    }

    if (!user || !projectId || !currentPerson?.workspace_id) {
      setLoading(false);
      setLoadError("Workspace context is required to load this project.");
    }
  }, [user, projectId, currentPerson?.workspace_id, currentPersonLoading]);

  const unsectionedTasks = useMemo(
    () => tasks.filter((task) => !task.section_id),
    [tasks]
  );

  // A deleted section must not leave the pane pointing at nothing.
  useEffect(() => {
    if (activeSectionId === ALL_TASKS_ID || activeSectionId === GENERAL_SECTION_ID) return;
    if (sections.some((section) => section.id === activeSectionId)) return;

    setActiveSectionId(ALL_TASKS_ID);
  }, [sections, activeSectionId]);

  const stats = useMemo(() => {
    const openTasks = tasks.filter((task) => !task.complete);
    const completedTasks = tasks.filter((task) => task.complete);
    const progress = tasks.length === 0 ? project?.progress ?? 0 : toProgress(tasks);

    return { openTasks, completedTasks, progress };
  }, [tasks, project]);

  const projectOwner = useMemo(() => {
    if (!project) return null;

    return (
      people.find((person) => person.id === project.owner_person_id) ||
      people.find((person) => person.auth_user_id === project.user_id) ||
      null
    );
  }, [people, project]);

  const assignableProjectPeople = useMemo(() => {
    const collaboratorPeople = collaborators
      .map((collaborator) => collaborator.people)
      .filter(Boolean) as PeopleSearchPerson[];

    if (!projectOwner) return collaboratorPeople;

    return [
      projectOwner,
      ...collaboratorPeople.filter((person) => person.id !== projectOwner.id),
    ];
  }, [collaborators, projectOwner]);

  const collaboratorPeopleById = useMemo(() => {
    return new Map(assignableProjectPeople.map((person) => [person.id, person]));
  }, [assignableProjectPeople]);

  const sectionNameById = useMemo(() => {
    return new Map(sections.map((section) => [section.id, section.name]));
  }, [sections]);

  const railSections = useMemo(() => {
    const entries = sections.map((section) => ({
      id: section.id,
      name: section.name,
      openCount: tasks.filter((task) => task.section_id === section.id && !task.complete)
        .length,
    }));

    // General only earns a row once something is actually sitting outside a
    // section, or when the project has no sections to sit in yet. It sits
    // right under All tasks, ahead of the named sections, since it's the
    // catch-all rather than a workstream someone chose to create.
    if (unsectionedTasks.length > 0 || sections.length === 0) {
      entries.unshift({
        id: GENERAL_SECTION_ID,
        name: "General",
        openCount: unsectionedTasks.filter((task) => !task.complete).length,
      });
    }

    return entries;
  }, [sections, tasks, unsectionedTasks]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) || null,
    [sections, activeSectionId]
  );

  const paneTasks = useMemo(() => {
    if (activeSectionId === ALL_TASKS_ID) return tasks;
    if (activeSectionId === GENERAL_SECTION_ID) return unsectionedTasks;

    return tasks.filter((task) => task.section_id === activeSectionId);
  }, [tasks, unsectionedTasks, activeSectionId]);

  const paneCounts = useMemo(() => {
    return {
      all: paneTasks.length,
      open: paneTasks.filter((task) => !task.complete).length,
      mine: paneTasks.filter(
        (task) =>
          !task.complete &&
          Boolean(currentPerson?.id) &&
          task.assigned_person_id === currentPerson?.id
      ).length,
      due: paneTasks.filter(isDueSoon).length,
      done: paneTasks.filter((task) => task.complete).length,
    } satisfies Record<TaskFilter, number>;
  }, [paneTasks, currentPerson?.id]);

  const visibleTasks = useMemo(() => {
    const matchesFilter = (task: any) => {
      if (taskFilter === "all") return true;
      if (taskFilter === "open") return !task.complete;
      if (taskFilter === "done") return Boolean(task.complete);
      if (taskFilter === "due") return isDueSoon(task);

      return (
        !task.complete &&
        Boolean(currentPerson?.id) &&
        task.assigned_person_id === currentPerson?.id
      );
    };

    const filtered = paneTasks.filter(matchesFilter);

    const sorted = sortProjectTasks(filtered);

    // Only the cross-section view needs to say which section a task belongs to.
    if (activeSectionId !== ALL_TASKS_ID) return sorted;

    return sorted.map((task) => ({
      ...task,
      section_name: sectionNameById.get(task.section_id) || "",
    }));
  }, [paneTasks, taskFilter, currentPerson?.id, activeSectionId, sectionNameById]);

  const paneHeading =
    activeSectionId === ALL_TASKS_ID
      ? "All tasks"
      : activeSectionId === GENERAL_SECTION_ID
        ? "General"
        : activeSection?.name || "Section";

  const paneDescription =
    activeSectionId === GENERAL_SECTION_ID ? null : activeSection?.description || null;

  const paneEmptyMessage =
    taskFilter === "done"
      ? "Nothing completed here yet."
      : taskFilter === "mine"
        ? "Nothing here is assigned to you."
        : taskFilter === "due"
          ? "Nothing is due in the next week."
          : "No tasks here yet. Add the first one below.";

  const addTargetSectionId =
    activeSectionId === ALL_TASKS_ID || activeSectionId === GENERAL_SECTION_ID
      ? null
      : activeSectionId;

  const sidebarCollaborators = useMemo(() => {
    return collaborators.map((collaborator) => ({
      id: collaborator.id,
      role: collaborator.role,
      person: collaborator.people
        ? {
            id: collaborator.people.id,
            display_name: collaborator.people.display_name,
            avatar_url: collaborator.people.avatar_url,
          }
        : null,
    }));
  }, [collaborators]);

  const sidebarActivity = useMemo(() => {
    return activityLogs.map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      created_at: activity.created_at,
      person: activity.people
        ? {
            id: activity.actor_person_id || activity.id,
            display_name: activity.people.display_name,
            avatar_url: activity.people.avatar_url,
          }
        : null,
    }));
  }, [activityLogs]);

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

  const handleBannerSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first, so re-picking the same file still fires a change event.
    event.target.value = "";

    if (!file || !project) return;

    toast.info("Uploading banner...");

    const result = await uploadProjectCover({
      file,
      workspaceId: currentPerson?.workspace_id,
      userId: user?.id,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const { error } = await updateProject(project.id, {
      banner_image_url: result.url,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setProject((current: any) =>
      current ? { ...current, banner_image_url: result.url } : current
    );
    toast.success("Banner updated");
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
      toast.error(friendlyErrorMessage(error));
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

  const requestDeleteSection = (section: ProjectSection) => setPendingDelete({ kind: "section", section });

  const doDeleteSection = async (section: ProjectSection) => {
    const { error } = await deleteProjectSection(section.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    await logProjectActivity("section_deleted", "Section deleted", section.name, {
      section_id: section.id,
    });

    setActiveSectionId(ALL_TASKS_ID);
    toast.success("Section deleted");
    load();
  };

  const addProjectAction = async (sectionId: string | null, draft: NewTaskDraft) => {
    if (!draft.title || !user || !project) return;

    const { error } = await createProjectActionTask({
      id: crypto.randomUUID(),
      title: draft.title,
      user_id: user.id,
      project: project.name,
      project_id: project.id,
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
      ...(projectSectionsAvailable && sectionId ? { section_id: sectionId } : {}),
    });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    await syncProjectStatsById(project.id);
    await logProjectActivity("task_added", "Task added", draft.title, {
      due: draft.due || null,
      section_id: sectionId,
    });
    toast.success("Task added");
    load();
  };

  const toggleTask = async (task: any) => {
    const nextComplete = !task.complete;

    const { error } = await updateProjectTaskCompletion({
      taskId: task.id,
      complete: nextComplete,
    });

    if (error) {
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
      return;
    }

    await syncProjectStatsById(targetTask?.project_id);
    await logProjectActivity(
      "task_deleted",
      "Task deleted",
      targetTask?.title || "Project task deleted",
      { task_id: id }
    );
    toast.success("Task deleted");
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
      toast.error(friendlyErrorMessage(error));
      return;
    }

    await syncProjectStatsForIds([previousProjectId, editingTask.project_id || project?.id]);
    await logProjectActivity("task_updated", "Task updated", editingTask.title || "Project task updated", {
      task_id: editingTask.id,
      previous_project: previousTask?.project || "",
      next_project: editingTask.project,
    });

    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const requestDeleteProject = (targetProject: any) => setPendingDelete({ kind: "project", project: targetProject });

  const doDeleteProject = async (targetProject: any) => {
    const { error } = await deleteProject(targetProject.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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

  const requestRemoveCollaborator = (collaboratorId: string) => {
    const label =
      collaborators.find((collaborator) => collaborator.id === collaboratorId)?.people?.display_name ||
      "this person";
    setPendingDelete({ kind: "collaborator", collaboratorId, label });
  };

  const doRemoveCollaborator = async (collaboratorId: string) => {
    const { error } = await removeProjectCollaborator({
      collaboratorId,
      userId: user?.id,
    });

    if (error) {
      toast.error(friendlyErrorMessage(error));
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

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    setPendingDelete(null);

    if (pendingDelete.kind === "project") return doDeleteProject(pendingDelete.project);
    if (pendingDelete.kind === "section") return doDeleteSection(pendingDelete.section);
    return doRemoveCollaborator(pendingDelete.collaboratorId);
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
      const projectPayload = {
        ...editingProject,
        name: nextName,
        notes: editingProject.notes || "",
        due_date: editingProject.due_date || null,
        is_event: Boolean(editingProject.is_event),
        event_start_at: toIsoDateTime(editingProject.event_start_at),
        event_end_at: toIsoDateTime(editingProject.event_end_at),
        calendar_event_id: editingProject.calendar_event_id || null,
      };

      if (
        editingProject.add_to_calendar &&
        !projectPayload.due_date &&
        !projectPayload.event_start_at
      ) {
        toast.error("Add a complete-by date or event start before adding it to the calendar.");
        return;
      }

      const { error } = await updateProject(editingProject.id, {
        name: nextName,
        area: editingProject.area || "General",
        status: editingProject.status || "In Progress",
        notes: editingProject.notes || "",
        owner_person_id:
          editingProject.owner_person_id || projectOwner?.id || currentPerson?.id || null,
        due_date: editingProject.due_date || null,
        is_event: Boolean(editingProject.is_event),
        event_start_at: toIsoDateTime(editingProject.event_start_at),
        event_end_at: toIsoDateTime(editingProject.event_end_at),
        calendar_event_id: editingProject.calendar_event_id || null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      if (editingProject.add_to_calendar && currentPerson?.workspace_id) {
        const { data: calendarEvent, error: calendarError } =
          await upsertProjectCalendarEvent({
            project: projectPayload,
            userId: user.id,
            workspaceId: currentPerson.workspace_id,
          });

        if (calendarError) throw calendarError;

        if (calendarEvent?.id && calendarEvent.id !== projectPayload.calendar_event_id) {
          const { error: calendarProjectError } = await updateProject(editingProject.id, {
            calendar_event_id: calendarEvent.id,
            updated_at: new Date().toISOString(),
          });

          if (calendarProjectError) throw calendarProjectError;
        }
      }

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
      toast.error(friendlyErrorMessage(error as { message?: string }, "Could not update project"));
    } finally {
      setSavingProject(false);
    }
  };

  if (loading && !project) {
    return (
      <div>
        <PageHeader eyebrow="Tasks" title="Project" subtitle="Loading project..." />

        <div className="actsix-page-body">
          <Card className="actsix-panel p-4 sm:p-5">
            <div className="actsix-loading-state min-h-[12rem]">
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
          <Card className="actsix-panel flex max-w-2xl flex-col items-start gap-4 p-4 sm:p-5">
            <div>
              <p className="text-base font-semibold text-foreground">
                This project is unavailable right now.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try again to load project details, collaborators, and tasks.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => load()}>
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
    <div className="min-w-0">
      <PageHeader eyebrow="Tasks" title={project.name} subtitle={project.area || "General"} />

      <div className="actsix-page-body space-y-3">
        <ProjectDetailHero
          project={project}
          owner={projectOwner}
          progress={stats.progress}
          openCount={stats.openTasks.length}
          doneCount={stats.completedTasks.length}
          onChangeBanner={() => bannerInputRef.current?.click()}
          onEditProject={() =>
            setEditingProject({
              ...project,
              event_start_at: toLocalDateTimeInput(project.event_start_at),
              event_end_at: toLocalDateTimeInput(project.event_end_at),
              add_to_calendar: Boolean(project.calendar_event_id),
            })
          }
          onDeleteProject={() => requestDeleteProject(project)}
        />

        {!projectSectionsAvailable && (
          <div className="rounded-lg border border-brand-amber/30 bg-brand-amber/10 p-3 text-sm text-brand-amber">
            Project Sections are ready in the app, but the Supabase migration has not been
            applied to this database yet. Existing project tasks are shown below.
          </div>
        )}

        <div className="grid min-w-0 gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_18rem]">
          <ProjectSectionRail
            sections={railSections}
            activeId={activeSectionId}
            allId={ALL_TASKS_ID}
            allOpenCount={stats.openTasks.length}
            onSelect={setActiveSectionId}
            onAddSection={projectSectionsAvailable ? openNewSection : undefined}
          />

          <ProjectTaskPane
            heading={paneHeading}
            description={paneDescription}
            status={activeSection?.status}
            leader={
              activeSection?.leader_person_id
                ? collaboratorPeopleById.get(activeSection.leader_person_id) || null
                : null
            }
            filter={taskFilter}
            onFilterChange={setTaskFilter}
            counts={paneCounts}
            tasks={visibleTasks}
            emptyMessage={paneEmptyMessage}
            addTargetName={activeSectionId === ALL_TASKS_ID ? "this project" : paneHeading}
            addPeople={assignableProjectPeople}
            onAddTask={(draft) => addProjectAction(addTargetSectionId, draft)}
            onToggleTask={toggleTask}
            onEditTask={(task) => setEditingTask({ ...task })}
            onDeleteTask={(task) => removeTask(task.id)}
            onEditSection={activeSection ? () => setEditingSection({ ...activeSection }) : undefined}
            onDeleteSection={activeSection ? () => requestDeleteSection(activeSection) : undefined}
          />

          <div className="min-w-0">
            <ProjectDetailSidebar
              owner={projectOwner}
              collaborators={sidebarCollaborators}
              onAddCollaborator={() => setAddCollaboratorOpen(true)}
              onRemoveCollaborator={requestRemoveCollaborator}
              activity={sidebarActivity}
            />
          </div>
        </div>
      </div>

      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBannerSelected}
      />

      <FormDialog
        open={addCollaboratorOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPersonIds([]);
            setCollaboratorRole("Collaborator");
          }
          setAddCollaboratorOpen(open);
        }}
        eyebrow="Project Collaborators"
        title="Add Collaborators"
        description="Choose People profiles to connect to this project."
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setAddCollaboratorOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="add-collaborators-form"
              className="actsix-btn-primary min-h-10 rounded-xl"
              disabled={selectedPersonIds.length === 0}
            >
              <Plus className="h-4 w-4" />
              {selectedPersonIds.length > 1
                ? `Add ${selectedPersonIds.length} Collaborators`
                : "Add Collaborator"}
            </Button>
          </>
        }
      >
        <form id="add-collaborators-form" onSubmit={addCollaborator} className="space-y-4">
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
        </form>
      </FormDialog>

      <ProjectSectionEditorModal
        section={editingSection}
        saving={savingSection}
        assignablePeople={assignableProjectPeople}
        onChange={setEditingSection}
        onClose={() => setEditingSection(null)}
        onSave={saveSection}
      />

      <ProjectEditorModal
        project={editingProject}
        saving={savingProject}
        onChange={setEditingProject}
        onClose={() => setEditingProject(null)}
        onSave={saveProject}
        onDelete={
          editingProject
            ? () => {
                requestDeleteProject(editingProject);
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
        projectSections={projectSectionsAvailable ? sections : undefined}
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === "project"
            ? `Delete "${pendingDelete.project.name}"?`
            : pendingDelete?.kind === "section"
              ? `Delete "${pendingDelete.section.name}"?`
              : `Remove ${pendingDelete?.kind === "collaborator" ? pendingDelete.label : ""}?`
        }
        description={
          pendingDelete?.kind === "project"
            ? "Its sections, activity history, and links to tasks will be removed. This can't be undone."
            : pendingDelete?.kind === "section"
              ? "Its tasks will stay on the project without a section."
              : "They'll lose access to this project's tasks and details."
        }
        confirmLabel={
          pendingDelete?.kind === "project"
            ? "Delete Project"
            : pendingDelete?.kind === "section"
              ? "Delete Section"
              : "Remove"
        }
        onConfirm={confirmPendingDelete}
      />
    </div>
  );
};

export default ProjectDetailPage;
