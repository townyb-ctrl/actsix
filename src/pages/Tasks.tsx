import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  Edit3,
  FileText,
  MapPin,
  Plus,
  Save,
  Tags,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

const PriorityChip = ({ p }: { p?: string | null }) => {
  const priority = p || "Medium";

  const map: Record<string, string> = {
    Low: "bg-secondary text-secondary-foreground",
    Medium: "bg-brand-amber/15 text-brand-amber",
    High: "bg-brand-coral/15 text-brand-coral",
    Urgent: "bg-brand-coral text-white",
  };

  return <span className={`chip ${map[priority] ?? map.Medium}`}>{priority}</span>;
};

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks(data ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !user) return;

    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      title: title.trim(),
      user_id: user.id,
      context: "General",
      priority: "Medium",
      energy: "Medium",
      minutes: 15,
      complete: false,
      notes: "",
      project: "",
      person: "",
      location: "",
      tags: [],
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTitle("");
    toast.success("Task added");
    load();
  };

  const toggle = async (task: any) => {
    const nextComplete = !task.complete;

    const { error } = await supabase
      .from("tasks")
      .update({
        complete: nextComplete,
        completed_at: nextComplete ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Task deleted");
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    setSaving(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editingTask.title || "",
        notes: editingTask.notes || "",
        project: editingTask.project || "",
        due: editingTask.due || null,
        start_time: editingTask.start_time || null,
        person: editingTask.person || "",
        location: editingTask.location || "",
        context: editingTask.context || "General",
        energy: editingTask.energy || "Medium",
        priority: editingTask.priority || "Medium",
        minutes: Number(editingTask.minutes) || 15,
        tags: Array.isArray(editingTask.tags) ? editingTask.tags : [],
        complete: Boolean(editingTask.complete),
        completed_at: editingTask.complete
          ? editingTask.completed_at || new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingTask.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const open = tasks.filter((task) => !task.complete);
  const done = tasks.filter((task) => task.complete);

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Next Actions"
        subtitle="Capture, attend, complete. The next thing to do, in any context."
      />

      <div className="px-8 pb-12 max-w-5xl space-y-6">
        <Card className="p-3 shadow-card border-border/70 bg-card">
          <form onSubmit={add} className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Capture a task…"
              className="border-transparent bg-muted/40 focus-visible:bg-background"
            />
            <Button
              type="submit"
              className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-full px-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-extrabold tracking-tight">
              Open{" "}
              <span className="text-muted-foreground font-normal text-base">
                · {open.length}
              </span>
            </h2>
          </div>

          <Card className="divide-y divide-border shadow-card border-border/70 bg-card">
            {open.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">All clear.</div>
            )}

            {open.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-4 group hover:bg-muted/30"
              >
                <Checkbox
                  checked={task.complete}
                  onCheckedChange={() => toggle(task)}
                  className="mt-1"
                />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{task.title}</div>

                  {task.notes && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.notes}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-brand-teal/15 text-brand-teal">
                      {task.context || "General"}
                    </span>
                    <PriorityChip p={task.priority} />
                    <span className="chip bg-secondary text-secondary-foreground">
                      Energy: {task.energy || "Medium"}
                    </span>
                    <span className="chip bg-secondary text-secondary-foreground font-mono">
                      {task.minutes || 15}m
                    </span>
                    {task.project && (
                      <span className="chip bg-secondary text-secondary-foreground">
                        {task.project}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => setEditingTask({ ...task })}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => remove(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="text-xl font-extrabold tracking-tight text-muted-foreground mb-3">
              Completed{" "}
              <span className="font-normal text-base">· {done.length}</span>
            </h2>

            <Card className="divide-y divide-border shadow-card border-border/70 bg-card opacity-70">
              {done.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-4 group">
                  <Checkbox checked onCheckedChange={() => toggle(task)} />
                  <div className="flex-1 truncate line-through text-muted-foreground">
                    {task.title}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => setEditingTask({ ...task })}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => remove(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>

      {editingTask && (
        <div className="fixed inset-0 z-50 bg-brand-ink/45 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl shadow-card border-border/70 bg-card max-h-[92vh] overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border/70">
              <div>
                <p className="label-eyebrow">Edit Task</p>
                <h2 className="text-2xl font-extrabold tracking-tight mt-1">
                  Task details
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Update the properties that help this action move forward.
                </p>
              </div>

              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditingTask(null)}
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(92vh-155px)] space-y-5">
              <section className="grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                  <label className="label-eyebrow">Title</label>
                  <Input
                    value={editingTask.title ?? ""}
                    onChange={(event) =>
                      setEditingTask({ ...editingTask, title: event.target.value })
                    }
                    className="mt-2 border-border/70 bg-background"
                    placeholder="What needs to be done?"
                  />
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                  <label className="label-eyebrow flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Notes
                  </label>
                  <textarea
                    value={editingTask.notes ?? ""}
                    onChange={(event) =>
                      setEditingTask({ ...editingTask, notes: event.target.value })
                    }
                    className="mt-2 min-h-28 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Add details, links, thoughts, or next-step context..."
                  />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">Planning</h3>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Project</label>
                    <Input
                      value={editingTask.project ?? ""}
                      onChange={(event) =>
                        setEditingTask({ ...editingTask, project: event.target.value })
                      }
                      className="mt-2 border-border/70 bg-background"
                      placeholder="Linked project"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Context</label>
                    <Input
                      value={editingTask.context ?? ""}
                      onChange={(event) =>
                        setEditingTask({ ...editingTask, context: event.target.value })
                      }
                      className="mt-2 border-border/70 bg-background"
                      placeholder="Calls, Computer, Church..."
                    />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Status</label>
                    <select
                      value={editingTask.complete ? "Complete" : "Open"}
                      onChange={(event) =>
                        setEditingTask({
                          ...editingTask,
                          complete: event.target.value === "Complete",
                          completed_at:
                            event.target.value === "Complete"
                              ? new Date().toISOString()
                              : null,
                        })
                      }
                      className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                    >
                      <option>Open</option>
                      <option>Complete</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Priority</label>
                    <select
                      value={editingTask.priority ?? "Medium"}
                      onChange={(event) =>
                        setEditingTask({ ...editingTask, priority: event.target.value })
                      }
                      className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Energy</label>
                    <select
                      value={editingTask.energy ?? "Medium"}
                      onChange={(event) =>
                        setEditingTask({ ...editingTask, energy: event.target.value })
                      }
                      className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      Duration
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={editingTask.minutes ?? 15}
                      onChange={(event) =>
                        setEditingTask({
                          ...editingTask,
                          minutes: Number(event.target.value) || 15,
                        })
                      }
                      className="mt-2 border-border/70 bg-background"
                      placeholder="Minutes"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">Scheduling</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Due date</label>
                    <Input
                      type="date"
                      value={editingTask.due ?? ""}
                      onChange={(event) =>
                        setEditingTask({
                          ...editingTask,
                          due: event.target.value || null,
                        })
                      }
                      className="mt-2 border-border/70 bg-background"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Start time</label>
                    <Input
                      type="time"
                      value={editingTask.start_time ?? ""}
                      onChange={(event) =>
                        setEditingTask({
                          ...editingTask,
                          start_time: event.target.value || null,
                        })
                      }
                      className="mt-2 border-border/70 bg-background"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <UserRound className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">People & place</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow">Person</label>
                    <Input
                      value={editingTask.person ?? ""}
                      onChange={(event) =>
                        setEditingTask({ ...editingTask, person: event.target.value })
                      }
                      className="mt-2 border-border/70 bg-background"
                      placeholder="Who this relates to"
                    />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                    <label className="label-eyebrow flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </label>
                    <Input
                      value={editingTask.location ?? ""}
                      onChange={(event) =>
                        setEditingTask({ ...editingTask, location: event.target.value })
                      }
                      className="mt-2 border-border/70 bg-background"
                      placeholder="Where this happens"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Tags className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">Organization</h3>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                  <label className="label-eyebrow">Tags</label>
                  <Input
                    value={
                      Array.isArray(editingTask.tags)
                        ? editingTask.tags.join(", ")
                        : ""
                    }
                    onChange={(event) =>
                      setEditingTask({
                        ...editingTask,
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                    className="mt-2 border-border/70 bg-background"
                    placeholder="Worship, Admin, Follow-up"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Separate tags with commas.
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold tracking-tight">Advanced</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created:{" "}
                      {editingTask.created_at
                        ? new Date(editingTask.created_at).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      remove(editingTask.id);
                      setEditingTask(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete task
                  </Button>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-between gap-3 p-4 border-t border-border/70 bg-card/95">
              <p className="text-xs text-muted-foreground">
                Save changes to update this task across ACTSIX.
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </Button>

                <Button
                  disabled={saving}
                  className="rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white"
                  onClick={saveTask}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Tasks;
