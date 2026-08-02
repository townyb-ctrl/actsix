import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  CheckCircle2,
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
import ProjectSummaryCard from "@/features/projects/components/ProjectSummaryCard";
import CompletedProjectRow from "@/features/projects/components/CompletedProjectRow";
import { type TeamMember } from "@/features/projects/components/CollaboratorAvatars";
import { isProjectComplete, needsAction } from "@/features/projects/lib/projectStatus";
import { uploadProjectCover } from "@/features/projects/lib/uploadProjectCover";
import CompactTaskRow from "@/components/CompactTaskRow";
import { syncProjectStatsById, syncProjectStatsForIds } from "@/lib/syncProjectStats";
import {
  addProjectCollaborators,
  createProject,
  createProjectActionTask,
  deleteProject,
  deleteProjectActionTask,
  getCollaboratorsForProjects,
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
  cover_image_url?: string | null;
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
  const [loading, setLoading] = useState(true);
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
  const [collaboratorsByProjectId, setCollaboratorsByProjectId] = useState<
    Record<string, TeamMember[]>
  >({});
  const [coverTargetProject, setCoverTargetProject] = useState<Project | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const openCoverPicker = (project: Project) => {
    setCoverTargetProject(project);
    coverInputRef.current?.click();
  };

  const handleCoverSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first, so re-picking the same file still fires a change event.
    event.target.value = "";

    if (!file || !coverTargetProject) return;

    const target = coverTargetProject;
    setCoverTargetProject(null);
    toast.info("Uploading cover...");

    const result = await uploadProjectCover({
      file,
      workspaceId: currentPerson?.workspace_id,
      userId: user?.id,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const { error } = await updateProject(target.id, {
      cover_image_url: result.url,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === target.id ? { ...project, cover_image_url: result.url } : project
      )
    );
    toast.success("Cover updated");
  };


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

  const needsActionProjects = projects.filter((project) =>
    needsAction(project, projectStats[project.id])
  ).length;

  const activeProjects = Math.max(totalProjects - completedProjects, 0);

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
        (projectView === "active" && !isProjectComplete(project, stats)) ||
        (projectView === "needs-action" && needsAction(project, stats)) ||
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


  const ownerByProjectId = useMemo(() => {
    return projects.reduce<Record<string, TeamMember | null>>((acc, project) => {
      const person =
        people.find((candidate) => candidate.id === project.owner_person_id) ||
        people.find((candidate) => candidate.auth_user_id === project.user_id) ||
        null;

      acc[project.id] = person
        ? {
            id: person.id,
            display_name: person.display_name,
            avatar_url: person.avatar_url,
          }
        : null;

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

  // Collaborators are a secondary detail: a failure here dims the avatar stacks
  // but must not take the page down with it.
  const loadCollaborators = async (projectIds: string[]) => {
    if (projectIds.length === 0) {
      setCollaboratorsByProjectId({});
      return;
    }

    const { data, error } = await getCollaboratorsForProjects(projectIds);

    if (error) {
      setCollaboratorsByProjectId({});
      return;
    }

    const rows = (data ?? []) as Array<{
      project_id: string;
      people?: { id: string; display_name: string; avatar_url?: string | null } | null;
    }>;

    const grouped = rows.reduce<Record<string, TeamMember[]>>((acc, row) => {
      const person = row.people;
      if (!person?.id) return acc;

      const existing = acc[row.project_id] || [];
      if (existing.some((member) => member.id === person.id)) return acc;

      acc[row.project_id] = [
        ...existing,
        {
          id: person.id,
          display_name: person.display_name,
          avatar_url: person.avatar_url,
        },
      ];

      return acc;
    }, {});

    setCollaboratorsByProjectId(grouped);
  };

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

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
      setLoading(false);
      return;
    }

    if (taskError) {
      toast.error(taskError.message);
      setLoading(false);
      return;
    }

    if (peopleError) {
      toast.error(peopleError.message);
      setLoading(false);
      return;
    }

    const peopleById = new Map<string, PersonOption>(
      (peopleData ?? []).map((person: PersonOption): [string, PersonOption] => [person.id, person])
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
    void loadCollaborators((projectData ?? []).map((project: Project) => project.id));

    if (!selectedProjectId && projectData && projectData.length > 0) {
      setSelectedProjectId(projectData[0].id);
    }

    setLoading(false);
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
    const confirmed = window.confirm(
      `Delete "${project.name}"? Its sections, activity history, and links to tasks will be removed. This can't be undone.`
    );

    if (!confirmed) return;

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
      />

      <div className="w-full min-w-0 space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Pills, search and Add Project share one control row and one height
            (h-6), so the page reads as a single band of controls rather than
            three stacked ones. */}
        <div className="flex flex-wrap items-center gap-2">
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
                      ? "actsix-filter-pill-active"
                      : "actsix-filter-pill-idle"
                  }`}
                >
                  {view.label}
                  <span
                    className={`actsix-filter-pill-count ${
                      active
                        ? "actsix-filter-pill-count-active"
                        : "actsix-filter-pill-count-idle"
                    }`}
                  >
                    {view.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="actsix-search-field w-40 lg:w-52">
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
              className="actsix-btn-primary actsix-btn-primary-compact h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
              onClick={openNewProjectModal}
            >
              <Plus className="h-3 w-3" />
              Add Project
            </Button>
          </div>
        </div>

        {loading && (
          <Card className="p-4">
            <div className="actsix-loading-state" role="status">
              Loading projects...
            </div>
          </Card>
        )}

        {!loading && filteredProjects.length === 0 && (
          <Card className="actsix-empty-state p-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
              <FolderKanban className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-extrabold">No projects match this view.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clear filters or add a project to keep ministry work moving.
            </p>
          </Card>
        )}

        {/* One grid at every breakpoint. The desktop table this replaced needed
            ~1240px of column minimums, so it clipped its own last column on a
            laptop; cards reflow instead of overflowing. */}
        {!loading && visibleActiveProjects.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActiveProjects.map((project, index) => (
              <ProjectSummaryCard
                key={project.id}
                project={project}
                stats={projectStats[project.id]}
                owner={ownerByProjectId[project.id]}
                collaborators={collaboratorsByProjectId[project.id]}
                index={index}
                onOpen={() => navigate(`/tasks/projects/${project.id}`)}
                onChangeCover={() => openCoverPicker(project)}
              />
            ))}
          </div>
        )}

        {visibleCompletedProjects.length > 0 && projectView !== "completed" && (
          <div>
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-1 py-2 text-left transition-colors hover:text-foreground"
              aria-expanded={isCompletedProjectsOpen}
              onClick={() => setIsCompletedProjectsOpen((open) => !open)}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-sage" />
              <span className="text-sm font-extrabold">Complete</span>
              <span className="actsix-filter-pill-count actsix-filter-pill-count-idle">
                {visibleCompletedProjects.length}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  isCompletedProjectsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isCompletedProjectsOpen && (
              <div className="mt-1 space-y-0.5">
                {visibleCompletedProjects.map((project, index) => (
                  <CompletedProjectRow
                    key={project.id}
                    project={project}
                    owner={ownerByProjectId[project.id]}
                    collaborators={collaboratorsByProjectId[project.id]}
                    index={index}
                    onOpen={() => navigate(`/tasks/projects/${project.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {projectView === "completed" && !loading && (
          <div className="space-y-0.5">
            {visibleCompletedProjects.map((project, index) => (
              <CompletedProjectRow
                key={project.id}
                project={project}
                owner={ownerByProjectId[project.id]}
                collaborators={collaboratorsByProjectId[project.id]}
                index={index}
                onOpen={() => navigate(`/tasks/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverSelected}
      />

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
