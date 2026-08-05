import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { syncProjectStatsById } from "@/lib/syncProjectStats";
import { createProject, defaultProjectPayload } from "@/features/projects/api/projectsApi";
import InboxProcessDialog, {
  targetLabels,
  type ProcessTarget,
} from "@/features/tasks/components/InboxProcessDialog";

export type InboxItem = {
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
  created_at?: string | null;
};

const InboxPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [title, setTitle] = useState("");
  const [editingItem, setEditingItem] = useState<InboxItem | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoadingItems(false);
      return;
    }

    try {
      const { data: inboxData, error: inboxError } = await supabase
        .from("inbox_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (inboxError) throw inboxError;

      setItems(inboxData ?? []);
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
  };

  const closeEditor = () => {
    setEditingItem(null);
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
    const confirmed = window.confirm(`Delete "${item.title}"? This can't be undone.`);
    if (!confirmed) return;

    const deleted = await removeInboxItem(item.id);

    if (deleted) {
      toast.success("Removed from inbox");
      load();
    }
  };

  const processItem = async (target: Exclude<ProcessTarget, "">) => {
    if (!editingItem || !user) return;

    setProcessing(true);

    try {
      const saved = await saveInboxItem(false);
      if (!saved) return;

      if (target === "task") {
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

      if (target === "project") {
        const { error } = await createProject(
          defaultProjectPayload({
            name: editingItem.title,
            user_id: user.id,
            notes: editingItem.notes || "",
          })
        );

        if (error) throw error;
      }

      if (target === "waiting") {
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

      if (target === "someday") {
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

      toast.success(`Moved to ${targetLabels[target]}`);
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
              className="actsix-btn-primary min-h-10 rounded-lg px-5"
              aria-label="Add to inbox"
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
                  className="h-9 w-9 max-sm:min-w-11 rounded-xl"
                  title="Clarify"
                  aria-label="Clarify"
                  onClick={() => openEditor(item)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 max-sm:min-w-11 rounded-xl text-muted-foreground hover:text-destructive"
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
          <InboxProcessDialog
            key={editingItem.id}
            item={editingItem}
            saving={saving}
            processing={processing}
            onChangeItem={setEditingItem}
            onClose={closeEditor}
            onSaveDraft={() => saveInboxItem(true)}
            onProcess={processItem}
            onRefreshOptions={load}
          />
        )}
      </Dialog>
    </div>
  );
};

export default InboxPage;
