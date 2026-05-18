import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  ListChecks,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompactTaskRow from "@/components/CompactTaskRow";
import TaskEditorModal from "@/components/TaskEditorModal";
import ProjectEditorModal from "@/components/ProjectEditorModal";
import { syncProjectStats, syncProjectStatsForNames } from "@/lib/syncProjectStats";
import { toast } from "sonner";

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

  const [project, setProject] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);
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

    setProject(projectData);
    setNotesDraft(projectData.notes || "");
    setTasks(taskData ?? []);
    setPeople(peopleData ?? []);
    setCollaborators(collaboratorData ?? []);
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
      due: newActionDue || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(project.name, user.id);
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
                    {collaborator.people?.avatar_url ? (
                      <img
                        src={collaborator.people.avatar_url}
                        alt={collaborator.people.display_name}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                        <UserRound className="h-3.5 w-3.5" />
                      </span>
                    )}

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
