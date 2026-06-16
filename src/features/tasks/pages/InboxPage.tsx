import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
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
  ChevronDown,
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

const destinationOptions: Array<{
  value: Exclude<ProcessTarget, "">;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    value: "task",
    label: "Task",
    description: "Something you need to do",
    icon: CheckCircle2,
  },
  {
    value: "project",
    label: "Project",
    description: "Something with multiple steps",
    icon: FolderKanban,
  },
  {
    value: "meeting",
    label: "Meeting",
    description: "Something to discuss or schedule",
    icon: UsersRound,
  },
  {
    value: "waiting",
    label: "Person / People",
    description: "Contact or pastoral follow-up",
    icon: Clock,
  },
  {
    value: "someday",
    label: "Someday",
    description: "Not now, maybe later",
    icon: Archive,
  },
];

const primaryActionLabels: Record<Exclude<ProcessTarget, "">, string> = {
  task: "Save as task",
  project: "Create project",
  waiting: "Save person follow-up",
  someday: "Move to someday",
  meeting: "Create meeting",
};

const footerReadyLabels: Record<Exclude<ProcessTarget, "">, string> = {
  task: "Ready to save as task.",
  project: "Ready to create project.",
  waiting: "Ready to save person follow-up.",
  someday: "Ready to move to someday.",
  meeting: "Ready to create meeting.",
};

const looksLikeSimpleAction = (title?: string | null) => {
  const clean = String(title || "").trim();
  if (!clean || clean.includes("?") || clean.length > 80) return false;

  return /^(call|cook|prepare|send|write|email|text|buy|pick up|fetch|confirm|follow up|review|schedule|book|create|finish|fix|update|plan|ask)\b/i.test(clean);
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
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [choosingDestination, setChoosingDestination] = useState(true);

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
    setMoreOptionsOpen(false);
    setChoosingDestination(true);
  };

  const closeEditor = () => {
    setEditingItem(null);
    setProcessTarget("");
    setMoreOptionsOpen(false);
    setChoosingDestination(true);
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
  const selectedDestination = processTarget
    ? destinationOptions.find((option) => option.value === processTarget)
    : null;
  const suggestedTask = editingItem ? looksLikeSimpleAction(editingItem.title) : false;

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
            <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
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
            <DialogHeader className="border-b border-border/70 px-4 py-3 pr-12 text-left sm:px-5 sm:py-3 sm:pr-14">
              <div>
                <p className="label-eyebrow text-[0.65rem]">Process Inbox Item</p>
                <DialogTitle className="mt-0.5 text-lg font-extrabold tracking-tight">
                  Process inbox item
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm">
                  Decide what this should become.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
              <section className="rounded-xl border border-border/70 bg-card px-3 py-2 shadow-sm">
                <label className="label-eyebrow text-[0.65rem]">
                  {selectedDestination
                    ? processTarget === "project"
                      ? "Project name"
                      : "Title"
                    : "Inbox item"}
                </label>

                {selectedDestination ? (
                  <Input
                    value={editingItem.title ?? ""}
                    onChange={(event) =>
                      setEditingItem({ ...editingItem, title: event.target.value })
                    }
                    className="mt-1 h-9 rounded-xl border-border/70 bg-background"
                    placeholder={
                      processTarget === "project"
                        ? "Name the project"
                        : "What has your attention?"
                    }
                  />
                ) : (
                  <p className="mt-0.5 text-base font-bold leading-snug text-foreground">
                    “{editingItem.title || "Untitled inbox item"}”
                  </p>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold tracking-tight">What should this become?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedDestination && !choosingDestination
                        ? "You can change the type if this is not quite right."
                        : "Choose what this item should become."}
                    </p>
                  </div>

                  {!processTarget && suggestedTask && (
                    <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                      Task looks likely
                    </span>
                  )}
                </div>

                {selectedDestination && !choosingDestination ? (
                  <div className="rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal text-white">
                          <selectedDestination.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold">{selectedDestination.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {selectedDestination.description}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 shrink-0 rounded-xl px-3"
                        onClick={() => setChoosingDestination(true)}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {destinationOptions.map((option) => {
                      const Icon = option.icon;
                      const selected = processTarget === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setProcessTarget(option.value);
                            setMoreOptionsOpen(false);
                            setChoosingDestination(false);
                          }}
                          className={[
                            "group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-teal/40 hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/35",
                            selected
                              ? "border-brand-teal bg-brand-teal/10 shadow-sm"
                              : "border-border/70 bg-card",
                          ].join(" ")}
                          aria-pressed={selected}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={[
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                                selected
                                  ? "border-brand-teal/30 bg-brand-teal text-white"
                                  : "border-border/70 bg-background text-brand-teal",
                              ].join(" ")}
                            >
                              <Icon className="h-4 w-4" />
                            </span>

                            <span className="min-w-0">
                              <span className="block text-sm font-extrabold">{option.label}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {option.description}
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {selectedDestination && (
                <>
                  {processTarget === "task" && (
                    <NextActionFields
                      item={editingItem}
                      onChange={setEditingItem}
                      onRefreshOptions={load}
                      showOrganization={false}
                      variant="inbox"
                    />
                  )}

                  {processTarget === "waiting" && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-brand-teal" />
                        <h3 className="font-extrabold tracking-tight">Person follow-up details</h3>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="actsix-panel-soft p-4">
                          <label className="label-eyebrow">Person or team</label>
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
                      <div className="mb-3 flex items-center gap-2">
                        <Archive className="h-4 w-4 text-brand-teal" />
                        <h3 className="font-extrabold tracking-tight">Someday details</h3>
                      </div>

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
                    </section>
                  )}

                  {processTarget === "meeting" && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <UsersRound className="h-4 w-4 text-brand-teal" />
                        <h3 className="font-extrabold tracking-tight">Meeting details</h3>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
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

                      <p className="mt-2 text-xs text-muted-foreground">
                        Meeting details can be captured here, but moving to Meetings needs the Meetings table first.
                      </p>
                    </section>
                  )}

                  {processTarget === "project" && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-brand-teal" />
                        <h3 className="font-extrabold tracking-tight">Project details</h3>
                      </div>

                      <div className="actsix-empty-state p-4 text-left">
                        <p className="text-sm text-muted-foreground">
                          This will create a project using the title above as the project name.
                        </p>
                      </div>
                    </section>
                  )}

                  <section className="rounded-xl border border-border/70 bg-card">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setMoreOptionsOpen((open) => !open)}
                      aria-expanded={moreOptionsOpen}
                    >
                        <span>
                          <span className="block text-sm font-extrabold">More options</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Add notes or extra context.
                          </span>
                        </span>
                      <ChevronDown
                        className={[
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          moreOptionsOpen ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    </button>

                    {moreOptionsOpen && (
                      <div className="grid gap-3 border-t border-border/70 p-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="label-eyebrow flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            Notes
                          </label>
                          <textarea
                            value={editingItem.notes ?? ""}
                            onChange={(event) =>
                              setEditingItem({ ...editingItem, notes: event.target.value })
                            }
                            className="mt-2 min-h-24 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Add details, links, thoughts, or next-step context..."
                          />
                        </div>

                        {processTarget === "task" && (
                          <div className="rounded-xl border border-brand-teal/20 bg-white p-4 shadow-sm md:col-span-2">
                            <label className="label-eyebrow flex items-center gap-2">
                              <Tags className="h-3.5 w-3.5" />
                              Tags
                            </label>
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
                              className="mt-2 h-10 rounded-xl border-brand-teal/20 bg-white shadow-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                              placeholder="Worship, Admin, Follow-up"
                            />
                            <p className="mt-2 text-xs text-muted-foreground">
                              Separate tags with commas.
                            </p>
                          </div>
                        )}

                        {processTarget !== "task" && (
                          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
                            No additional fields are required for this type.
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background/95 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {processTarget
                  ? footerReadyLabels[processTarget]
                  : "Choose what this should become before saving."}
              </p>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Button variant="outline" className="rounded-xl" onClick={closeEditor}>
                  Cancel
                </Button>

                {processTarget && (
                  <Button
                    disabled={saving}
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => saveInboxItem(true)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save draft"}
                  </Button>
                )}

                <Button
                  disabled={!canProcess}
                  className="col-span-2 rounded-xl actsix-btn-primary font-bold sm:col-span-1"
                  onClick={processItem}
                >
                  {processTarget ? primaryActionLabels[processTarget] : "Choose type to continue"}
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
