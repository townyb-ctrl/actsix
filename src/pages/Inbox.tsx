import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  FolderKanban,
  Plus,
  Save,
  Tags,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { syncProjectStats } from "@/lib/syncProjectStats";
import ProjectSelect from "@/components/ProjectSelect";
import ContextSelect from "@/components/ContextSelect";
import NextActionFields from "@/components/NextActionFields";

type InboxItem = {
  id: string;
  title: string;
  user_id: string;
  context?: string | null;
  minutes?: number | null;
  priority?: string | null;
  energy?: string | null;
  notes?: string | null;
  project?: string | null;
  assigned_person_id?: string | null;
  tags?: string[] | null;
  due?: string | null;
  waiting_person?: string | null;
  waiting_follow_up?: string | null;
  someday_category?: string | null;
  meeting_time?: string | null;
  meeting_location?: string | null;
  created_at?: string | null;
};

type ProjectOption = {
  id: string;
  name: string;
};

type ContextOption = {
  id: string;
  name: string;
};

const fallbackContexts = [
  "General",
  "Calls",
  "Computer",
  "Church",
  "Errands",
  "Home",
  "Waiting",
];

type ProcessTarget = "" | "task" | "project" | "waiting" | "someday" | "meeting";

const targetLabels: Record<Exclude<ProcessTarget, "">, string> = {
  task: "Next Action",
  project: "Project",
  waiting: "Waiting For",
  someday: "Someday / Maybe",
  meeting: "Meeting",
};

const Inbox = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contexts, setContexts] = useState<ContextOption[]>([]);
  const [title, setTitle] = useState("");
  const [editingItem, setEditingItem] = useState<InboxItem | null>(null);
  const [processTarget, setProcessTarget] = useState<ProcessTarget>("");
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  const contextNames = useMemo(() => {
    const fromDb = contexts.map((context) => context.name).filter(Boolean);
    return Array.from(new Set([...fallbackContexts, ...fromDb]));
  }, [contexts]);

  const load = async () => {
    if (!user) return;

    const [
      { data: inboxData, error: inboxError },
      { data: projectData, error: projectError },
      { data: contextData, error: contextError },
    ] = await Promise.all([
      supabase
        .from("inbox_items")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("contexts")
        .select("id, name")
        .order("position", { ascending: true }),
    ]);

    if (inboxError) {
      toast.error(inboxError.message);
      return;
    }

    if (projectError) {
      toast.error(projectError.message);
      return;
    }

    if (contextError) {
      toast.error(contextError.message);
      return;
    }

    setItems(inboxData ?? []);
    setProjects(projectData ?? []);
    setContexts(contextData ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !user) return;

    const { error } = await supabase.from("inbox_items").insert({
      id: crypto.randomUUID(),
      title: title.trim(),
      user_id: user.id,
      notes: "",
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTitle("");
    toast.success("Captured to inbox");
    load();
  };

  const openEditor = (item: InboxItem) => {
    setEditingItem({ ...item });
    setProcessTarget("");
  };

  const closeEditor = () => {
    setEditingItem(null);
    setProcessTarget("");
  };

  const saveInboxItem = async (showToast = true) => {
    if (!editingItem) return false;

    setSaving(true);

    const { error } = await supabase
      .from("inbox_items")
      .update({
        title: editingItem.title || "",
        notes: editingItem.notes || "",
        project: editingItem.project || "",
        context: editingItem.context || "General",
        priority: editingItem.priority || "Medium",
        energy: editingItem.energy || "Medium",
        minutes: Number(editingItem.minutes) || 15,
        due: editingItem.due || null,
        waiting_person: editingItem.waiting_person || "",
        waiting_follow_up: editingItem.waiting_follow_up || null,
        someday_category: editingItem.someday_category || "General",
        tags: Array.isArray(editingItem.tags) ? editingItem.tags : [],
        assigned_person_id: editingItem.assigned_person_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingItem.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return false;
    }

    if (showToast) toast.success("Inbox item updated");
    await load();
    return true;
  };

  const removeInboxItem = async (id: string) => {
    const { error } = await supabase.from("inbox_items").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return false;
    }

    return true;
  };

  const quickDelete = async (item: InboxItem) => {
    const deleted = await removeInboxItem(item.id);

    if (deleted) {
      toast.success("Removed from inbox");
      load();
    }
  };

  const processItem = async () => {
    if (!editingItem || !user || !processTarget) return;

    if (processTarget === "meeting") {
      toast.error("Meeting processing needs a meetings table first. We can build that next.");
      return;
    }

    setProcessing(true);

    try {
      const saved = await saveInboxItem(false);
      if (!saved) return;

      if (processTarget === "task") {
        const { error } = await supabase.from("tasks").insert({
          id: crypto.randomUUID(),
          title: editingItem.title,
          user_id: user.id,
          context: editingItem.context || "General",
          priority: editingItem.priority || "Medium",
          energy: editingItem.energy || "Medium",
          minutes: editingItem.minutes || 15,
          notes: editingItem.notes || "",
          project: editingItem.project || "",
          tags: editingItem.tags || [],
          assigned_person_id: editingItem.assigned_person_id || null,
          due: editingItem.due || null,
          complete: false,
        });

        if (error) throw error;

        await syncProjectStats(editingItem.project, user.id);
      }

      if (processTarget === "project") {
        const { error } = await supabase.from("projects").insert({
          id: crypto.randomUUID(),
          name: editingItem.title,
          user_id: user.id,
          area: "General",
          status: "Active",
          progress: 0,
          open_tasks: 0,
          next_action: "",
          notes: editingItem.notes || "",
        });

        if (error) throw error;
      }

      if (processTarget === "waiting") {
        const { error } = await supabase.from("waiting_items").insert({
          id: crypto.randomUUID(),
          item: editingItem.title,
          user_id: user.id,
          person: editingItem.waiting_person || "Someone",
          follow_up: editingItem.waiting_follow_up || null,
          notes: editingItem.notes || "",
          project: editingItem.project || "",
        });

        if (error) throw error;
      }

      if (processTarget === "someday") {
        const { error } = await supabase.from("someday_items").insert({
          id: crypto.randomUUID(),
          title: editingItem.title,
          user_id: user.id,
          category: editingItem.someday_category || "General",
          notes: editingItem.notes || "",
        });

        if (error) throw error;
      }

      const deleted = await removeInboxItem(editingItem.id);
      if (!deleted) return;

      toast.success(`Moved to ${targetLabels[processTarget]}`);
      closeEditor();
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not process this inbox item";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const canProcess = Boolean(processTarget) && !saving && !processing;

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Inbox"
        subtitle="Quickly capture what has your attention. Clarify it later."
      />

      <div className="w-full space-y-6 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="p-3 shadow-card border-border/70 bg-card">
          <form onSubmit={add} className="flex gap-2">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Brain dump anything..."
              className="border-transparent bg-muted/40 focus-visible:bg-background"
            />

            <Button
              type="submit"
              className="actsix-btn-primary rounded-full px-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <Card className="p-2 space-y-2 shadow-card border-border/70 bg-card">
          {items.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Inbox clear. Capture something when it has your attention.
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="action-row group flex items-center gap-3 px-4 py-3"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-brand-teal shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">
                  {item.title}
                </div>

                {item.notes && (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {item.notes}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Clarify"
                  aria-label="Clarify"
                  onClick={() => openEditor(item)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => quickDelete(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-brand-ink/45 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl shadow-card border-border/70 bg-card h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border/70">
              <div>
                <p className="label-eyebrow">Clarify Inbox Item</p>
                <h2 className="text-2xl font-extrabold tracking-tight mt-1">
                  Inbox details
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose where this belongs first. ACTSIX will only show the fields that matter.
                </p>
              </div>

              <Button variant="outline" className="rounded-xl" onClick={closeEditor}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-5">
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Archive className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">Destination</h3>
                </div>

                <div className="rounded-2xl border border-brand-teal/30 bg-brand-teal/5 p-4 shadow-soft">
                  <label className="label-eyebrow">Where should this go?</label>
                  <select
                    value={processTarget}
                    onChange={(event) => setProcessTarget(event.target.value as ProcessTarget)}
                    className="mt-2 h-11 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option value="">Choose destination...</option>
                    <option value="task">Next Action</option>
                    <option value="project">Project</option>
                    <option value="waiting">Waiting For</option>
                    <option value="someday">Someday / Maybe</option>
                    <option value="meeting">Meeting</option>
                  </select>

                  {!processTarget && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Choose a destination to reveal the relevant details and enable processing.
                    </p>
                  )}

                  {processTarget === "meeting" && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Meeting fields are shown, but moving to Meetings needs the Meetings table first.
                    </p>
                  )}
                </div>
              </section>

              <section className="grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                  <label className="label-eyebrow">
                    {processTarget === "project" ? "Project name" : "Title"}
                  </label>
                  <Input
                    value={editingItem.title ?? ""}
                    onChange={(event) =>
                      setEditingItem({ ...editingItem, title: event.target.value })
                    }
                    className="mt-2 border-border/70 bg-background"
                    placeholder={
                      processTarget === "project"
                        ? "Name the project"
                        : "What has your attention?"
                    }
                  />
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                  <label className="label-eyebrow flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Notes
                  </label>
                  <textarea
                    value={editingItem.notes ?? ""}
                    onChange={(event) =>
                      setEditingItem({ ...editingItem, notes: event.target.value })
                    }
                    className="mt-2 min-h-28 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Add details, links, thoughts, or next-step context..."
                  />
                </div>
              </section>

              {processTarget === "task" && (
                <NextActionFields
                  item={editingItem}
                  onChange={setEditingItem}
                  onRefreshOptions={load}
                />
              )}

              {processTarget === "waiting" && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-brand-teal" />
                    <h3 className="font-extrabold tracking-tight">Waiting For details</h3>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Who are you waiting for?</label>
                      <Input
                        value={editingItem.waiting_person ?? ""}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            waiting_person: event.target.value,
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                        placeholder="Person or team"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Follow-up date</label>
                      <Input
                        type="date"
                        value={editingItem.waiting_follow_up ?? ""}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            waiting_follow_up: event.target.value || null,
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Project</label>
                                            <ProjectSelect
                        value={editingItem.project ?? ""}
                        onChange={(project) =>
                          setEditingItem({ ...editingItem, project })
                        }
                        onCreated={load}
                      />
                    </div>
                  </div>
                </section>
              )}

              {processTarget === "someday" && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Archive className="h-4 w-4 text-brand-teal" />
                    <h3 className="font-extrabold tracking-tight">Someday / Maybe details</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Category</label>
                      <Input
                        value={editingItem.someday_category ?? "General"}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            someday_category: event.target.value,
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                        placeholder="Idea, Future, Ministry..."
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Tags</label>
                      <Input
                        value={Array.isArray(editingItem.tags) ? editingItem.tags.join(", ") : ""}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            tags: event.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                        placeholder="Future, Idea, Maybe"
                      />
                    </div>
                  </div>
                </section>
              )}

              {processTarget === "meeting" && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <UsersRound className="h-4 w-4 text-brand-teal" />
                    <h3 className="font-extrabold tracking-tight">Meeting details</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Meeting with</label>
                      <Input
                        value={editingItem.waiting_person ?? ""}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            waiting_person: event.target.value,
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                        placeholder="Person, team, or group"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Meeting date</label>
                      <Input
                        type="date"
                        value={editingItem.due ?? ""}
                        onChange={(event) =>
                          setEditingItem({ ...editingItem, due: event.target.value || null })
                        }
                        className="mt-2 border-border/70 bg-background"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Meeting time</label>
                      <Input
                        type="time"
                        value={editingItem.meeting_time ?? ""}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            meeting_time: event.target.value || null,
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                      />
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                      <label className="label-eyebrow">Location</label>
                      <Input
                        value={editingItem.meeting_location ?? ""}
                        onChange={(event) =>
                          setEditingItem({
                            ...editingItem,
                            meeting_location: event.target.value,
                          })
                        }
                        className="mt-2 border-border/70 bg-background"
                        placeholder="Office, auditorium, coffee shop..."
                      />
                    </div>
                  </div>
                </section>
              )}

              {processTarget === "project" && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban className="h-4 w-4 text-brand-teal" />
                    <h3 className="font-extrabold tracking-tight">Project details</h3>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      This will create a project using the title above as the project name and the notes as the project description.
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 p-4 border-t border-border/70 bg-card/95">
              <p className="text-xs text-muted-foreground">
                {processTarget
                  ? `Ready to process this as: ${targetLabels[processTarget]}`
                  : "Choose a destination before processing."}
              </p>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-xl" onClick={closeEditor}>
                  Cancel
                </Button>

                <Button
                  disabled={saving}
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => saveInboxItem(true)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save details"}
                </Button>

                <Button
                  disabled={!canProcess}
                  variant="outline"
                  className="rounded-xl actsix-btn-soft font-bold"
                  onClick={processItem}
                >
                  Process
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Inbox;
