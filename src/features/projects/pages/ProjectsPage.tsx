import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Edit3,
  FolderKanban,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import TaskEditorModal from "@/components/TaskEditorModal";
import ProjectEditorModal from "@/features/projects/components/ProjectEditorModal";
import CompactTaskRow from "@/components/CompactTaskRow";
import { syncProjectStatsById, syncProjectStatsForIds } from "@/lib/syncProjectStats";
import {
  addProjectCollaborators,
  createProject,
  createProjectActionTask,
  deleteProject,
  deleteProjectActionTask,
  getProjects,
  getProjectTasks,
  getWorkspacePersonOptions,
  updateProject,
  updateProjectActionTask,
  updateProjectNameOnTasks,
  updateProjectNotes,
  updateProjectTaskCompletion,
  upsertProjectCalendarEvent,
} from "@/features/projects/api/projectsApi";

type Project = {
  id: string;
  name: string;
  user_id: string;
  owner_person_id?: string | null;
  area?: string | null;
  status?: string | null;
  notes?: string | null;
  due_date?: string | null;
  is_event?: boolean | null;
  event_start_at?: string | null;
  event_end_at?: string | null;
  calendar_event_id?: string | null;
  add_to_calendar?: boolean;
  next_action?: string | null;
  progress?: number | null;
  open_tasks?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Task = {
  id: string;
  title: string;
  user_id: string;
  project?: string | null;
  context?: string | null;
  priority?: string | null;
  energy?: string | null;
  minutes?: number | null;
  notes?: string | null;
  project_id?: string | null;
  tags?: string[] | null;
  due?: string | null;
  complete?: boolean | null;
  completed_at?: string | null;
  created_at?: string | null;
  assigned_person_id?: string | null;
  assignedPersonName?: string;
};

type PersonOption = {
  id: string;
  user_id?: string | null;
  auth_user_id?: string | null;
  display_name: string;
  email?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
};

const statusClass = (status?: string | null) => {
  const clean = (status || "Active").toLowerCase();

  if (clean.includes("hold")) return "bg-brand-amber/15 text-brand-amber";
  if (clean.includes("planning")) return "bg-brand-teal-soft text-brand-teal";
  if (clean.includes("complete")) return "bg-brand-sage/10 text-brand-sage";

  return "bg-brand-teal/15 text-brand-teal";
};

const projectIconClass = (index: number) => {
  const classes = [
    "bg-brand-teal/10 text-brand-teal",
    "bg-brand-sage-soft text-brand-sage",
    "bg-brand-teal-soft text-brand-teal",
    "bg-brand-amber/10 text-brand-amber",
    "bg-brand-sage/10 text-brand-sage",
    "bg-brand-bronze/10 text-brand-bronze",
  ];

  return classes[index % classes.length];
};

const getInitials = (name?: string | null) => {
  if (!name) return "AS";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
};

const formatDate = (date?: string | null) => {
  if (!date) return "No date";

  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getProjectStats = (project: Project, tasks: Task[]) => {
  const projectTasks = tasks.filter(
    (task) => task.project_id === project.id || (!task.project_id && task.project === project.name)
  );
  const openTasks = projectTasks.filter((task) => !task.complete);
  const completedTasks = projectTasks.filter((task) => task.complete);
  const dueSoon = openTasks.filter((task) => Boolean(task.due)).length;

  const calculatedProgress =
    projectTasks.length === 0
      ? project.progress ?? 0
      : Math.round((completedTasks.length / projectTasks.length) * 100);

  return {
    projectTasks,
    openTasks,
    completedTasks,
    dueSoon,
    progress: calculatedProgress,
    nextAction: openTasks[0]?.title || project.next_action || "",
  };
};

const isProjectComplete = (
  project: Project,
  stats?: ReturnType<typeof getProjectStats>
) => stats?.progress === 100 || project.status?.toLowerCase().includes("complete");

const toIsoDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const ProjectsPage = () => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDue, setNewActionDue] = useState("");
  const [search, setSearch] = useState("");
  const [projectView, setProjectView] = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [newProjectCollaboratorIds, setNewProjectCollaboratorIds] = useState<string[]>([]);
  const [isCompletedProjectsOpen, setIsCompletedProjectsOpen] = useState(false);

  const projectStats = useMemo(() => {
    return projects.reduce<Record<string, ReturnType<typeof getProjectStats>>>(
      (acc, project) => {
        acc[project.id] = getProjectStats(project, tasks);
        return acc;
      },
      {}
    );
  }, [projects, tasks]);

  const totalProjects = projects.length;

  const completedProjects = projects.filter((project) => {
    const stats = projectStats[project.id];
    return isProjectComplete(project, stats);
  }).length;

  const needsActionProjects = projects.filter((project) => {
    const stats = projectStats[project.id];
    return stats && stats.openTasks.length === 0 && stats.progress < 100;
  }).length;

  const activeProjects = Math.max(totalProjects - completedProjects, 0);

  const averageProgress =
    totalProjects === 0
      ? 0
      : Math.round(
          projects.reduce(
            (sum, project) => sum + (projectStats[project.id]?.progress ?? 0),
            0
          ) / totalProjects
        );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = projects.filter((project) => {
      const stats = projectStats[project.id];

      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        (project.area || "").toLowerCase().includes(q) ||
        (project.status || "").toLowerCase().includes(q) ||
        (project.notes || "").toLowerCase().includes(q) ||
        (stats?.nextAction || "").toLowerCase().includes(q);

      const matchesView =
        projectView === "all" ||
        (projectView === "active" && (stats?.progress ?? 0) < 100) ||
        (projectView === "needs-action" &&
          Boolean(stats && stats.openTasks.length === 0 && stats.progress < 100)) ||
        (projectView === "completed" && isProjectComplete(project, stats));

      return matchesSearch && matchesView;
    });

    return [...filtered].sort((a, b) => {
      return (
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
      );
    });
  }, [projects, projectStats, search, projectView]);

  const hasActiveFilters = Boolean(search.trim()) || projectView !== "all";

  const projectOwnerByProjectId = useMemo(() => {
    return projects.reduce<Record<string, PersonOption | null>>((acc, project) => {
      acc[project.id] =
        people.find((person) => person.id === project.owner_person_id) ||
        people.find((person) => person.auth_user_id === project.user_id) ||
        null;
      return acc;
    }, {});
  }, [people, projects]);

  const visibleActiveProjects = useMemo(
    () =>
      filteredProjects.filter((project) =>
        projectView === "completed"
          ? false
          : !isProjectComplete(project, projectStats[project.id])
      ),
    [filteredProjects, projectStats, projectView]
  );

  const visibleCompletedProjects = useMemo(
    () =>
      filteredProjects.filter((project) =>
        isProjectComplete(project, projectStats[project.id])
      ),
    [filteredProjects, projectStats]
  );

  const clearFilters = () => {
    setSearch("");
    setProjectView("all");
  };

  const selectedProject =
    filteredProjects.find((project) => project.id === selectedProjectId) ??
    filteredProjects[0] ??
    projects[0];

  const selectedStats = selectedProject ? projectStats[selectedProject.id] : null;

  useEffect(() => {
    if (selectedProject) {
      setNotesDraft(selectedProject.notes || "");
    }
  }, [selectedProject?.id]);

  useEffect(() => {
    if (projectView === "completed") {
      setIsCompletedProjectsOpen(true);
    }
  }, [projectView]);

  const load = async () => {
    if (!user) return;

    const [
      { data: projectData, error: projectError },
      { data: taskData, error: taskError },
      { data: peopleData, error: peopleError },
    ] =
      await Promise.all([
        getProjects(),
        getProjectTasks(),
        getWorkspacePersonOptions(currentPerson?.workspace_id),
      ]);

    if (projectError) {
      toast.error(projectError.message);
      return;
    }

    if (taskError) {
      toast.error(taskError.message);
      return;
    }

    if (peopleError) {
      toast.error(peopleError.message);
      return;
    }

    const peopleById = new Map(
      (peopleData ?? []).map((person: PersonOption) => [person.id, person])
    );

    const enrichedTasks = (taskData ?? []).map((task: Task) => ({
      ...task,
      assignedPersonName: task.assigned_person_id
        ? peopleById.get(task.assigned_person_id)?.display_name || ""
        : "",
    }));

    setProjects(projectData ?? []);
    setTasks(enrichedTasks);
    setPeople(peopleData ?? []);

    if (!selectedProjectId && projectData && projectData.length > 0) {
      setSelectedProjectId(projectData[0].id);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user, currentPerson?.workspace_id]);

  const addProjectAction = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!newActionTitle.trim() || !user || !selectedProject) return;

    const { error } = await createProjectActionTask({
      id: crypto.randomUUID(),
      title: newActionTitle.trim(),
      user_id: user.id,
      project: selectedProject.name,
      project_id: selectedProject.id,
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

    await syncProjectStatsById(selectedProject.id);
    setNewActionTitle("");
    setNewActionDue("");
    toast.success("Next action added");
    load();
  };

  const toggleTask = async (task: Task) => {
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
    toast.success("Action deleted");
    load();
  };

  const removeProject = async (project: Project) => {
    const { error } = await deleteProject(project.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Project deleted");

    if (selectedProjectId === project.id) {
      setSelectedProjectId(null);
    }

    load();
  };

  const saveNotes = async () => {
    if (!selectedProject) return;

    const { error } = await updateProjectNotes({
      projectId: selectedProject.id,
      notes: notesDraft,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Project notes saved");
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    const previousTask = tasks.find((task) => task.id === editingTask.id);
    const previousProjectId = previousTask?.project_id || null;

    setSavingTask(true);

    const { error } = await updateProjectActionTask({
      taskId: editingTask.id,
      payload: {
        title: editingTask.title || "",
        notes: editingTask.notes || "",
        project: editingTask.project || "",
        project_id: editingTask.project_id || null,
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
      },
    });

    setSavingTask(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsForIds([previousProjectId, editingTask.project_id]);

    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const saveProject = async () => {
    if (!editingProject || !user) return;

    const previousProject = projects.find(
      (project) => project.id === editingProject.id
    );

    const previousName = previousProject?.name || "";
    const nextName = editingProject.name?.trim() || "";

    if (!nextName) {
      toast.error("Project name is required");
      return;
    }

    setSavingProject(true);

    try {
      const isNewProject = !previousProject;

      const projectPayload = {
        id: editingProject.id,
        user_id: user.id,
        owner_person_id: editingProject.owner_person_id || currentPerson?.id || null,
        name: nextName,
        area: editingProject.area || "General",
        status: editingProject.status || "In Progress",
        notes: editingProject.notes || "",
        due_date: editingProject.due_date || null,
        is_event: Boolean(editingProject.is_event),
        event_start_at: toIsoDateTime(editingProject.event_start_at),
        event_end_at: toIsoDateTime(editingProject.event_end_at),
        calendar_event_id: editingProject.calendar_event_id || null,
        next_action: editingProject.next_action || "",
        progress: editingProject.progress || 0,
        open_tasks: editingProject.open_tasks || 0,
        updated_at: new Date().toISOString(),
      };

      if (
        (editingProject as any).add_to_calendar &&
        !projectPayload.due_date &&
        !projectPayload.event_start_at
      ) {
        toast.error("Add a complete-by date or event start before adding it to the calendar.");
        return;
      }

      const { error } = isNewProject
        ? await createProject({
            ...projectPayload,
            created_at: editingProject.created_at || new Date().toISOString(),
          })
        : await updateProject(editingProject.id, projectPayload);

      if (error) throw error;

      if ((editingProject as any).add_to_calendar && currentPerson?.workspace_id) {
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

      if (isNewProject && newProjectCollaboratorIds.length > 0) {
        const { error: collaboratorError } = await addProjectCollaborators({
          userId: user.id,
          projectId: editingProject.id,
          personIds: newProjectCollaboratorIds,
        });

        if (collaboratorError) throw collaboratorError;
      }

      if (!isNewProject && previousName && previousName !== nextName) {
        const { error: taskError } = await updateProjectNameOnTasks({
          projectId: editingProject.id,
          name: nextName,
        });

        if (taskError) throw taskError;
      }

      await syncProjectStatsById(editingProject.id);

      toast.success(previousProject ? "Project updated" : "Project created");
      setSelectedProjectId(editingProject.id);
      setEditingProject(null);
      setNewProjectCollaboratorIds([]);
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update project";
      toast.error(message);
    } finally {
      setSavingProject(false);
    }
  };

  const openNewProjectModal = () => {
    if (!user) return;

    const now = new Date().toISOString();

    setEditingProject({
      id: crypto.randomUUID(),
      user_id: user.id,
      name: "",
      area: "General",
      status: "In Progress",
      notes: "",
      owner_person_id: currentPerson?.id || null,
      due_date: null,
      is_event: false,
      event_start_at: null,
      event_end_at: null,
      calendar_event_id: null,
      add_to_calendar: false,
      next_action: "",
      progress: 0,
      open_tasks: 0,
      created_at: now,
      updated_at: now,
    });
    setNewProjectCollaboratorIds([]);
  };

  const projectViews = [
    { value: "all", label: "All", count: totalProjects },
    { value: "active", label: "Active", count: activeProjects },
    { value: "needs-action", label: "Needs Action", count: needsActionProjects },
    { value: "completed", label: "Completed", count: completedProjects },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Tasks"
        title="Projects"
        subtitle="Track progress and keep every outcome moving."
        actions={
          <>
            <div className="actsix-search-field sm:w-48 lg:w-56">
              <Search className="actsix-search-icon" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects..."
                className="actsix-search-input"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="actsix-btn-primary h-9"
              onClick={openNewProjectModal}
            >
              <Plus className="h-4 w-4" />
              Add Project
            </Button>
          </>
        }
      />

      <div className="w-full min-w-0 space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">

        <div className="actsix-panel-soft grid gap-px overflow-hidden md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                <FolderKanban className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">Total Projects</p>
                <div className="mt-1 text-xl font-extrabold">{totalProjects}</div>
              </div>
            </div>
          </div>

          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-sage/10 text-brand-sage">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">Active Projects</p>
                <div className="mt-1 text-xl font-extrabold">{activeProjects}</div>
              </div>
            </div>
          </div>

          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-amber/10 text-brand-amber">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">Needs Action</p>
                <div className="mt-1 text-xl font-extrabold">{needsActionProjects}</div>
              </div>
            </div>
          </div>

          <div className="bg-background/55 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="label-eyebrow">Completion Rate</p>
                <div className="mt-1 text-xl font-extrabold">{averageProgress}%</div>
              </div>
            </div>
          </div>
        </div>

        <div className="-mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="truncate">
              Showing {filteredProjects.length} of {projects.length} projects
              {hasActiveFilters ? " with filters applied" : ""}
            </span>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 self-start px-2.5 text-xs text-muted-foreground hover:text-foreground sm:self-auto"
              onClick={clearFilters}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        <div className="actsix-filter-pills">
            {projectViews.map((view) => {
              const active = projectView === view.value;

              return (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => setProjectView(view.value)}
                  className={`actsix-filter-pill ${
                    active
                      ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {view.label}
                  <span
                    className={`actsix-filter-pill-count ${
                      active
                        ? "bg-brand-teal/15 text-brand-teal"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {view.count}
                  </span>
                </button>
              );
            })}
        </div>

        <div className="md:hidden">
          <div className="space-y-3">
            {filteredProjects.length === 0 && (
              <Card className="actsix-empty-state p-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-extrabold">No projects match this view.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clear filters or add a project to keep ministry work moving.
                </p>
              </Card>
            )}

            {(projectView === "completed" ? visibleCompletedProjects : visibleActiveProjects).map((project, index) => {
              const stats = projectStats[project.id];
              const owner = projectOwnerByProjectId[project.id];

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/tasks/projects/${project.id}`)}
                  className="actsix-interactive-tile w-full p-3.5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${projectIconClass(
                        index
                      )}`}
                    >
                      <FolderKanban className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-extrabold tracking-tight">
                            {project.name}
                          </h2>
                          <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                            {project.area || "General"} · {owner?.display_name || "Creator"}
                          </p>
                        </div>

                        <span className={`chip shrink-0 ${statusClass(project.status)}`}>
                          {project.status || "In Progress"}
                        </span>
                      </div>

                      <div className="actsix-interactive-row mt-2.5 border-border/60 bg-background/60 p-2.5">
                        <p className="label-eyebrow">Next Action</p>
                        <p className="mt-1 line-clamp-2 text-sm font-bold text-foreground">
                          {stats?.nextAction || "No next action set"}
                        </p>
                        {stats?.openTasks[0]?.due && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(stats.openTasks[0].due)}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-brand-teal"
                              style={{ width: `${stats?.progress ?? 0}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-extrabold text-muted-foreground">
                          {stats?.progress ?? 0}%
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">
                          {stats?.openTasks.length ?? 0} open
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {visibleCompletedProjects.length > 0 && projectView !== "completed" && (
              <Card className="actsix-panel overflow-hidden">
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isCompletedProjectsOpen}
                  onClick={() => setIsCompletedProjectsOpen((open) => !open)}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                    <CheckCircle2 className="h-4 w-4 text-brand-sage" />
                    Complete
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    {visibleCompletedProjects.length}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isCompletedProjectsOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {isCompletedProjectsOpen && (
                  <div className="space-y-3 border-t border-border/70 p-3">
                    {visibleCompletedProjects.map((project, index) => {
                      const stats = projectStats[project.id];
                      const owner = projectOwnerByProjectId[project.id];

                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => navigate(`/tasks/projects/${project.id}`)}
                          className="actsix-interactive-tile w-full p-3.5"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${projectIconClass(index)}`}>
                              <FolderKanban className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex min-w-0 items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h2 className="truncate text-base font-extrabold tracking-tight">{project.name}</h2>
                                  <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                                    {project.area || "General"} · {owner?.display_name || "Creator"}
                                  </p>
                                </div>
                                <span className={`chip shrink-0 ${statusClass(project.status)}`}>
                                  {project.status || "Completed"}
                                </span>
                              </div>
                              <div className="mt-2.5 flex items-center justify-between gap-3">
                                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-brand-teal" style={{ width: `${stats?.progress ?? 0}%` }} />
                                </div>
                                <span className="shrink-0 text-xs font-extrabold text-muted-foreground">
                                  {stats?.progress ?? 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        <div className="hidden md:block">
          <Card className="actsix-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/20 text-left">
                    <th className="px-4 py-3 label-eyebrow">Project</th>
                    <th className="px-4 py-3 label-eyebrow">Area</th>
                    <th className="px-4 py-3 label-eyebrow">Status</th>
                    <th className="px-4 py-3 label-eyebrow">Next Action</th>
                    <th className="px-4 py-3 label-eyebrow">Progress</th>
                    <th className="px-4 py-3 label-eyebrow">Schedule</th>
                    <th className="px-4 py-3 label-eyebrow">Owner</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No projects match this view.
                      </td>
                    </tr>
                  )}

                  {(projectView === "completed" ? visibleCompletedProjects : visibleActiveProjects).map((project, index) => {
                    const stats = projectStats[project.id];
                    const isSelected = selectedProject?.id === project.id;
                    const owner = projectOwnerByProjectId[project.id];
                    const ownerInitials = getInitials(owner?.display_name || project.name);

                    return (
                      <tr
                        key={project.id}
                        className={`border-b border-border/60 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-brand-teal/5 shadow-[inset_3px_0_0_hsl(var(--brand-teal))]"
                            : "hover:bg-muted/30"
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open project ${project.name}`}
                        onClick={() => navigate(`/tasks/projects/${project.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(`/tasks/projects/${project.id}`);
                          }
                        }}
                      >
                        <td className="px-4 py-3 min-w-[260px]">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center ${projectIconClass(
                                index
                              )}`}
                            >
                              <FolderKanban className="h-5 w-5" />
                            </div>

                            <div>
                              <div className="font-extrabold tracking-tight">{project.name}</div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {project.notes || "No description yet"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {project.area || "General"}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`chip ${statusClass(project.status)}`}>
                            {project.status || "In Progress"}
                          </span>
                        </td>

                        <td className="px-4 py-3 min-w-[220px]">
                          {stats?.nextAction ? (
                            <div>
                              <div className="font-semibold line-clamp-1">{stats.nextAction}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(stats.openTasks[0]?.due)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No next action</span>
                          )}
                        </td>

                        <td className="px-4 py-3 min-w-[150px]">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-teal rounded-full"
                                style={{ width: `${stats?.progress ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground">
                              {stats?.progress ?? 0}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-muted-foreground">
                          {project.is_event && project.event_start_at ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatDate(project.event_start_at)}
                            </span>
                          ) : project.due_date ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              Due {formatDate(project.due_date)}
                            </span>
                          ) : (
                            "No date"
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                              {ownerInitials}
                            </div>
                            <span className="max-w-[9rem] truncate text-xs font-semibold text-muted-foreground">
                              {owner?.display_name || "Creator"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {visibleCompletedProjects.length > 0 && projectView !== "completed" && (
                    <>
                      <tr className="border-b border-border/70 bg-muted/20">
                        <td colSpan={7} className="p-0">
                          <button
                            type="button"
                            className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                            aria-expanded={isCompletedProjectsOpen}
                            onClick={() => setIsCompletedProjectsOpen((open) => !open)}
                          >
                            <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                              <CheckCircle2 className="h-4 w-4 text-brand-sage" />
                              Complete
                            </span>
                            <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
                              {visibleCompletedProjects.length}
                              <ChevronDown className={`h-4 w-4 transition-transform ${isCompletedProjectsOpen ? "rotate-180" : ""}`} />
                            </span>
                          </button>
                        </td>
                      </tr>

                      {isCompletedProjectsOpen &&
                        visibleCompletedProjects.map((project, index) => {
                          const stats = projectStats[project.id];
                          const owner = projectOwnerByProjectId[project.id];
                          const ownerInitials = getInitials(owner?.display_name || project.name);

                          return (
                            <tr
                              key={project.id}
                              className="cursor-pointer border-b border-border/60 bg-background/60 transition-colors hover:bg-muted/30"
                              role="button"
                              tabIndex={0}
                              aria-label={`Open project ${project.name}`}
                              onClick={() => navigate(`/tasks/projects/${project.id}`)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  navigate(`/tasks/projects/${project.id}`);
                                }
                              }}
                            >
                              <td className="min-w-[260px] px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${projectIconClass(index)}`}>
                                    <FolderKanban className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <div className="font-extrabold tracking-tight">{project.name}</div>
                                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                      {project.notes || "No description yet"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{project.area || "General"}</td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className={`chip ${statusClass(project.status)}`}>{project.status || "Completed"}</span>
                              </td>
                              <td className="min-w-[220px] px-4 py-3 text-muted-foreground">Complete</td>
                              <td className="min-w-[150px] px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-brand-teal" style={{ width: `${stats?.progress ?? 0}%` }} />
                                  </div>
                                  <span className="font-mono text-xs text-muted-foreground">{stats?.progress ?? 0}%</span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">
                                {project.is_event && project.event_start_at
                                  ? formatDate(project.event_start_at)
                                  : project.due_date
                                    ? `Due ${formatDate(project.due_date)}`
                                    : "No date"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                    {ownerInitials}
                                  </div>
                                  <span className="max-w-[9rem] truncate text-xs font-semibold text-muted-foreground">
                                    {owner?.display_name || "Creator"}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <ProjectEditorModal
        project={editingProject}
        saving={savingProject}
        people={people.filter((person) => person.id !== currentPerson?.id)}
        selectedCollaboratorIds={newProjectCollaboratorIds}
        onCollaboratorChange={setNewProjectCollaboratorIds}
        showCollaborators={Boolean(editingProject && !projects.some((project) => project.id === editingProject.id))}
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

export default ProjectsPage;
