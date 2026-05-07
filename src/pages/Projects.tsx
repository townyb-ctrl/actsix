import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Filter,
  FolderKanban,
  ListChecks,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import TaskEditorModal from "@/components/TaskEditorModal";
import { syncProjectStats, syncProjectStatsForNames } from "@/lib/syncProjectStats";

type Project = {
  id: string;
  name: string;
  user_id: string;
  area?: string | null;
  status?: string | null;
  notes?: string | null;
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
  tags?: string[] | null;
  due?: string | null;
  complete?: boolean | null;
  completed_at?: string | null;
  created_at?: string | null;
};

const statusClass = (status?: string | null) => {
  const clean = (status || "Active").toLowerCase();

  if (clean.includes("hold")) return "bg-brand-amber/15 text-brand-amber";
  if (clean.includes("planning")) return "bg-blue-500/10 text-blue-600";
  if (clean.includes("complete")) return "bg-emerald-500/10 text-emerald-600";

  return "bg-brand-teal/15 text-brand-teal";
};

const projectIconClass = (index: number) => {
  const classes = [
    "bg-brand-teal/10 text-brand-teal",
    "bg-purple-500/10 text-purple-600",
    "bg-blue-500/10 text-blue-600",
    "bg-brand-amber/10 text-brand-amber",
    "bg-emerald-500/10 text-emerald-600",
    "bg-orange-500/10 text-orange-600",
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
  const projectTasks = tasks.filter((task) => task.project === project.name);
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

const Projects = () => {
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newActionTitle, setNewActionTitle] = useState("");
  const [quickCapture, setQuickCapture] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("All Projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [savingTask, setSavingTask] = useState(false);

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
    return stats?.progress === 100 || project.status?.toLowerCase().includes("complete");
  }).length;

  const stalledProjects = projects.filter((project) => {
    const stats = projectStats[project.id];
    return stats && stats.openTasks.length === 0 && stats.progress < 100;
  }).length;

  const activeProjects = Math.max(totalProjects - completedProjects, 0);

  const averageProgress =
    totalProjects === 0
      ? 0
      : Math.round(
          projects.reduce((sum, project) => sum + (projectStats[project.id]?.progress ?? 0), 0) /
            totalProjects
        );

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const stats = projectStats[project.id];
      const q = search.trim().toLowerCase();

      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        (project.area || "").toLowerCase().includes(q) ||
        (stats?.nextAction || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (view === "Active") return (stats?.progress ?? 0) < 100;
      if (view === "Stalled") return Boolean(stats && stats.openTasks.length === 0 && stats.progress < 100);
      if (view === "Completed") return (stats?.progress ?? 0) === 100;

      return true;
    });
  }, [projects, projectStats, search, view]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0] ?? projects[0];

  const selectedStats = selectedProject ? projectStats[selectedProject.id] : null;

  useEffect(() => {
    if (selectedProject) {
      setNotesDraft(selectedProject.notes || "");
    }
  }, [selectedProject?.id]);

  const load = async () => {
    if (!user) return;

    const [{ data: projectData, error: projectError }, { data: taskData, error: taskError }] =
      await Promise.all([
        supabase.from("projects").select("*").order("updated_at", { ascending: false }),
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      ]);

    if (projectError) {
      toast.error(projectError.message);
      return;
    }

    if (taskError) {
      toast.error(taskError.message);
      return;
    }

    setProjects(projectData ?? []);
    setTasks(taskData ?? []);

    if (!selectedProjectId && projectData && projectData.length > 0) {
      setSelectedProjectId(projectData[0].id);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const addProject = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newProjectName.trim() || !user) return;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        id: crypto.randomUUID(),
        name: newProjectName.trim(),
        user_id: user.id,
        area: "General",
        status: "In Progress",
        progress: 0,
        open_tasks: 0,
        next_action: "",
        notes: "",
      })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setNewProjectName("");
    toast.success("Project added");

    if (data) {
      setSelectedProjectId(data.id);
    }

    load();
  };

  const addProjectAction = async (event?: React.FormEvent) => {
    event?.preventDefault();

    if (!newActionTitle.trim() || !user || !selectedProject) return;

    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      title: newActionTitle.trim(),
      user_id: user.id,
      project: selectedProject.name,
      context: "General",
      priority: "Medium",
      energy: "Medium",
      minutes: 15,
      complete: false,
      notes: "",
      person: "",
      location: "",
      tags: [],
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(selectedProject.name, user.id);
    setNewActionTitle("");
    toast.success("Next action added");
    load();
  };

  const addQuickCapture = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!quickCapture.trim() || !selectedProject || !user) return;

    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      title: quickCapture.trim(),
      user_id: user.id,
      project: selectedProject.name,
      context: "General",
      priority: "Medium",
      energy: "Medium",
      minutes: 15,
      complete: false,
      notes: "",
      tags: [],
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(selectedProject.name, user.id);
    setQuickCapture("");
    toast.success("Captured to project");
    load();
  };

  const toggleTask = async (task: Task) => {
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
    load();
  };

  const removeTask = async (id: string) => {
    const targetTask = tasks.find((task) => task.id === id);

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(targetTask?.project, user?.id);
    toast.success("Action deleted");
    load();
  };

  const removeProject = async (project: Project) => {
    const { error } = await supabase.from("projects").delete().eq("id", project.id);

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

    const { error } = await supabase
      .from("projects")
      .update({
        notes: notesDraft,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedProject.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Project notes saved");
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
    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Projects"
        subtitle="Track progress. Advance the mission."
      />

      <div className="px-8 pb-12 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <form onSubmit={addProject} className="flex gap-2 max-w-2xl w-full">
            <div className="relative flex-1">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-teal" />
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Add a new project..."
                className="pl-10 border-border/70 bg-card h-12 shadow-soft"
              />
            </div>

            <Button
              type="submit"
              className="h-12 actsix-btn-primary rounded-xl px-6"
            >
              Add Project
            </Button>
          </form>

          <div className="flex items-center gap-2">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects..."
                className="pl-10 border-border/70 bg-card h-11"
              />
            </div>

            <Button variant="outline" className="h-11 rounded-xl">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-5 border-border/70 bg-card shadow-card">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
                <FolderKanban className="h-6 w-6" />
              </div>
              <div>
                <p className="label-eyebrow">Total Projects</p>
                <div className="text-3xl font-extrabold tracking-tight mt-1">{totalProjects}</div>
                <p className="text-sm text-muted-foreground">All ministry initiatives</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="label-eyebrow">Active Projects</p>
                <div className="text-3xl font-extrabold tracking-tight mt-1">{activeProjects}</div>
                <p className="text-sm text-muted-foreground">In progress</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-brand-amber/10 text-brand-amber flex items-center justify-center">
                <Clock3 className="h-6 w-6" />
              </div>
              <div>
                <p className="label-eyebrow">Stalled Projects</p>
                <div className="text-3xl font-extrabold tracking-tight mt-1">{stalledProjects}</div>
                <p className="text-sm text-muted-foreground">Need next action</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 rounded-full bg-brand-teal/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-brand-teal" />
              </div>
              <div>
                <p className="label-eyebrow">Completion Rate</p>
                <div className="text-3xl font-extrabold tracking-tight mt-1">{averageProgress}%</div>
                <p className="text-sm text-muted-foreground">Avg. project completion</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid 2xl:grid-cols-[minmax(0,1fr)_430px] gap-6 items-start">
          <Card className="border-border/70 bg-card shadow-card overflow-hidden">
            <div className="p-4 border-b border-border/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">View</span>
                <select
                  value={view}
                  onChange={(event) => setView(event.target.value)}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm"
                >
                  <option>All Projects</option>
                  <option>Active</option>
                  <option>Stalled</option>
                  <option>Completed</option>
                </select>
              </div>

              <p className="text-sm text-muted-foreground">
                Showing {filteredProjects.length} of {projects.length} projects
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/20 text-left">
                    <th className="px-4 py-3 label-eyebrow">Project</th>
                    <th className="px-4 py-3 label-eyebrow">Area</th>
                    <th className="px-4 py-3 label-eyebrow">Status</th>
                    <th className="px-4 py-3 label-eyebrow">Next Action</th>
                    <th className="px-4 py-3 label-eyebrow">Progress</th>
                    <th className="px-4 py-3 label-eyebrow">Owner</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No projects match this view.
                      </td>
                    </tr>
                  )}

                  {filteredProjects.map((project, index) => {
                    const stats = projectStats[project.id];
                    const isSelected = selectedProject?.id === project.id;
                    const ownerInitials = getInitials(project.name);

                    return (
                      <tr
                        key={project.id}
                        className={`border-b border-border/60 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-brand-teal/5 shadow-[inset_3px_0_0_hsl(var(--brand-teal))]"
                            : "hover:bg-muted/30"
                        }`}
                        onClick={() => setSelectedProjectId(project.id)}
                      >
                        <td className="px-4 py-4 min-w-[260px]">
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
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {project.notes || "No description yet"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                          {project.area || "General"}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`chip ${statusClass(project.status)}`}>
                            {project.status || "In Progress"}
                          </span>
                        </td>

                        <td className="px-4 py-4 min-w-[220px]">
                          {stats?.nextAction ? (
                            <div>
                              <div className="font-semibold">{stats.nextAction}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(stats.openTasks[0]?.due)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No next action</span>
                          )}
                        </td>

                        <td className="px-4 py-4 min-w-[150px]">
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

                        <td className="px-4 py-4">
                          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                            {ownerInitials}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedProject && selectedStats && (
            <Card className="border-border/70 bg-card shadow-card overflow-hidden sticky top-6">
              <div className="p-6 border-b border-border/70">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserRound className="h-4 w-4" />
                      {selectedProject.area || "General"}
                    </div>

                    <h2 className="text-3xl font-extrabold tracking-tight mt-3 leading-tight">
                      {selectedProject.name}
                    </h2>

                    <div className="mt-3">
                      <span className={`chip ${statusClass(selectedProject.status)}`}>
                        {selectedProject.status || "In Progress"}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProject(selectedProject)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                  {selectedProject.notes ||
                    "Add notes to describe this project, its goal, and what success looks like."}
                </p>

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-extrabold tracking-tight">Progress</p>
                    <p className="font-extrabold tracking-tight">{selectedStats.progress}%</p>
                  </div>

                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-teal rounded-full"
                      style={{ width: `${selectedStats.progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  <div className="rounded-2xl border border-border/70 p-3 text-center">
                    <CheckCircle2 className="h-5 w-5 text-brand-teal mx-auto mb-1" />
                    <div className="text-xl font-extrabold">{selectedStats.openTasks.length}</div>
                    <p className="text-[11px] text-muted-foreground">Open Actions</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-3 text-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                    <div className="text-xl font-extrabold">
                      {selectedStats.completedTasks.length}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Completed</p>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-3 text-center">
                    <Clock3 className="h-5 w-5 text-brand-amber mx-auto mb-1" />
                    <div className="text-xl font-extrabold">{selectedStats.dueSoon}</div>
                    <p className="text-[11px] text-muted-foreground">Due Soon</p>
                  </div>
                </div>
              </div>

              <div className="p-5 border-b border-border/70">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold tracking-tight">Next Actions</h3>
                  <span className="text-xs text-brand-teal font-bold">
                    {selectedStats.openTasks.length} open
                  </span>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/10 p-2">
                  {selectedStats.projectTasks.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      No actions attached yet.
                    </div>
                  )}

                  {selectedStats.projectTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="action-row flex items-center gap-3 p-3 mb-2 last:mb-0"
                    >
                      <Checkbox
                        checked={Boolean(task.complete)}
                        onCheckedChange={() => toggleTask(task)}
                      />

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-semibold truncate ${
                            task.complete ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {task.title}
                        </div>
                      </div>

                      <span className="chip bg-brand-coral/10 text-brand-coral border-brand-coral/20 whitespace-nowrap normal-case tracking-normal">
                        {task.due ? formatDate(task.due).replace(",", "") : ""}
                      </span>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingTask({ ...task })}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeTask(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <form onSubmit={addProjectAction} className="flex gap-2 mt-4">
                  <Input
                    value={newActionTitle}
                    onChange={(event) => setNewActionTitle(event.target.value)}
                    placeholder="What needs to be done?"
                    className="border-border/70 bg-background"
                  />

                  <Button
                    type="submit"
                    className="actsix-btn-primary rounded-xl"
                  >
                    Add
                  </Button>
                </form>
              </div>

              <div className="p-5 border-b border-border/70">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold tracking-tight">Notes</h3>
                  <Button variant="ghost" size="sm" className="text-brand-teal" onClick={saveNotes}>
                    Save
                  </Button>
                </div>

                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-border/70 bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Add project notes..."
                />
              </div>

              <div className="p-5">
                <h3 className="font-extrabold tracking-tight mb-3">Quick Capture</h3>

                <form onSubmit={addQuickCapture} className="flex gap-2">
                  <Input
                    value={quickCapture}
                    onChange={(event) => setQuickCapture(event.target.value)}
                    placeholder="Add a note, idea, or action..."
                    className="border-border/70 bg-background"
                  />

                  <Button
                    type="submit"
                    size="icon"
                    className="actsix-btn-primary rounded-xl"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>

                <div className="mt-5">
                  <p className="label-eyebrow mb-2">Project Team</p>
                  <div className="flex items-center gap-2">
                    {[selectedProject.name, selectedProject.area || "General", "ACTSIX"].map(
                      (item) => (
                        <div
                          key={item}
                          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold"
                        >
                          {getInitials(item)}
                        </div>
                      )
                    )}
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

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

export default Projects;
