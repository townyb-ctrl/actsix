import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TaskEditorModal from "@/components/TaskEditorModal";
import { syncProjectStats, syncProjectStatsForNames } from "@/lib/syncProjectStats";

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

  const add = async (event: React.FormEvent) => {
    event.preventDefault();

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

  const remove = async (id: string) => {
    const targetTask = tasks.find((task) => task.id === id);

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(targetTask?.project, user?.id);
    toast.success("Task deleted");
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    const previousProject =
      tasks.find((task) => task.id === editingTask.id)?.project || "";

    setSaving(true);

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

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsForNames([previousProject, editingTask.project], user?.id);
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
              onChange={(event) => setTitle(event.target.value)}
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
                  variant="outline"
                  size="sm"
                  className="rounded-full opacity-0 group-hover:opacity-100"
                  onClick={() => setEditingTask({ ...task })}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  Edit
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
                    variant="outline"
                    size="sm"
                    className="rounded-full opacity-0 group-hover:opacity-100"
                    onClick={() => setEditingTask({ ...task })}
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                    Edit
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

      <TaskEditorModal
        task={editingTask}
        saving={saving}
        eyebrow="Edit Next Action"
        description="Select a project and context from your ACTSIX lists."
        onChange={setEditingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
        onDelete={
          editingTask
            ? () => {
                remove(editingTask.id);
                setEditingTask(null);
              }
            : undefined
        }
        onRefreshOptions={load}
      />
    </div>
  );
};

export default Tasks;
