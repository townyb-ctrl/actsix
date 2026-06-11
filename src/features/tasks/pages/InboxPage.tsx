import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { syncProjectStatsById } from "@/lib/syncProjectStats";
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
  project_id?: string | null;
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

const InboxPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contexts, setContexts] = useState<ContextOption[]>([]);
  const [title, setTitle] = useState("");
  const [editingItem, setEditingItem] = useState<InboxItem | null>(null);
  const [processTarget, setProcessTarget] = useState<ProcessTarget>("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  const contextNames = useMemo(() => {
    const fromDb = contexts.map((context) => context.name).filter(Boolean);
    return Array.from(new Set([...fallbackContexts, ...fromDb]));
  }, [contexts]);

  const load = useCallback(async () => {
    if (!user) {
      setLoadingItems(false);
      return;
    }

    try {
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

      if (inboxError) throw inboxError;
      if (projectError) throw projectError;
      if (contextError) throw contextError;

      setItems(inboxData ?? []);
      setProjects(projectData ?? []);
      setContexts(contextData ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load inbox.";
      toast.error(message);
    } finally {
      setLoadingItems(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [load, user]);

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
          project_id: editingItem.project_id || null,
          tags: editingItem.tags || [],
          assigned_person_id: editingItem.assigned_person_id || null,
          due: editingItem.due || null,
          complete: false,
        });

        if (error) throw error;

        await syncProjectStatsById(editingItem.project_id);
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

      <div className="actsix-page-body actsix-page-stack">
        <Card className="actsix-panel-soft p-3">
          <form onSubmit={add} className="flex gap-2">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Brain dump anything..."
              className="border-border/70 bg-background"
            />

            <Button
              type="submit"
              className="actsix-btn-primary rounded-lg px-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <Card className="actsix-panel space-y-2 overflow-hidden p-2">
          {loadingItems && (
            <div className="actsix-loading-state" role="status">
              Loading inbox...
            </div>
          )}

          {!loadingItems && items.length === 0 && (
            <div className="actsix-empty-state min-h-[9rem]">
              Inbox clear. Capture something when it has your attention.
            </div>
          )}

          {!loadingItems && items.map((item) => (
            <div
              key={item.id}
              className="action-row group flex items-center gap-2 px-3 py-2"
            >
              <button
                type="button"
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                onClick={() => openEditor(item)}
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {item.title}
                  </div>

                  {item.notes && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1.5 opacity-85 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  title="Clarify"
                  aria-label="Clarify"
                  onClick={() => openEditor(item)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
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

      <Dialog
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        {editingItem && (
          <DialogContent className="flex h-[92svh] max-w-4xl flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:h-[88vh] sm:rounded-xl">
            <DialogHeader className="border-b border-border/70 p-4 pr-12 text-left sm:p-6 sm:pr-14">
              <div>
                <p className="label-eyebrow">Clarify Inbox Item</p>
                <DialogTitle className="mt-1 text-2xl font-extrabold tracking-tight">
                  Inbox details
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Choose where this belongs first. ACTSIX will only show the fields that matter.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Archive className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">Destination</h3>
                </div>

                <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-4">
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
                <div className="actsix-panel-soft p-4">
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

                <div className="actsix-panel-soft p-4">
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
                    <div className="actsix-panel-soft p-4">
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

                    <div className="actsix-panel-soft p-4">
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

                    <div className="actsix-panel-soft p-4">
                      <label className="label-eyebrow">Project</label>
                      <ProjectSelect
                        value={editingItem.project ?? ""}
                        onChange={(project) =>
                          setEditingItem({ ...editingItem, project })
                        }
                        onProjectChange={(project) =>
                          setEditingItem({
                            ...editingItem,
                            project: project?.name ?? editingItem.project ?? "",
                            project_id: project?.id ?? null,
                          })
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
                    <div className="actsix-panel-soft p-4">
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

                    <div className="actsix-panel-soft p-4">
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
                    <div className="actsix-panel-soft p-4">
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

                    <div className="actsix-panel-soft p-4">
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

                    <div className="actsix-panel-soft p-4">
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

                    <div className="actsix-panel-soft p-4">
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

                  <div className="actsix-empty-state p-4 text-left">
                    <p className="text-sm text-muted-foreground">
                      This will create a project using the title above as the project name and the notes as the project description.
                    </p>
                  </div>
                </section>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background/95 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {processTarget
                  ? `Ready to process this as: ${targetLabels[processTarget]}`
                  : "Choose a destination before processing."}
              </p>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
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
                  className="col-span-2 rounded-xl actsix-btn-soft font-bold sm:col-span-1"
                  onClick={processItem}
                >
                  Process
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default InboxPage;
