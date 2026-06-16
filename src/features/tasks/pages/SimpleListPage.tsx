import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Cfg = {
  table: "inbox_items" | "waiting_items" | "someday_items";
  titleCol: "title" | "item";
  eyebrow: string;
  title: string;
  subtitle: string;
};

export const SimpleListPage = ({ cfg }: { cfg: Cfg }) => {
  const { user } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [val, setVal] = useState("");
  const [extra, setExtra] = useState("");
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async ({ showLoading = false } = {}) => {
    if (!user) {
      setItems([]);
      setProjects([]);
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    setLoadError(null);

    const { data, error } = await supabase
      .from(cfg.table)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setItems([]);
      setLoading(false);
      setLoadError(error.message);
      toast.error(error.message);
      return;
    }

    setItems(data ?? []);

    if (cfg.table === "waiting_items") {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (projectError) {
        setProjects([]);
        setLoading(false);
        setLoadError(projectError.message);
        toast.error(projectError.message);
        return;
      }

      setProjects(projectData ?? []);
    } else {
      setProjects([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user) load({ showLoading: true });
  }, [user, cfg.table]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!val.trim() || !user) return;

    const id = crypto.randomUUID();

    const payload: any = {
      id,
      user_id: user.id,
      [cfg.titleCol]: val.trim(),
    };

    if (cfg.table === "waiting_items") {
      payload.person = extra.trim() || "Someone";
      payload.follow_up_date = null;
      payload.project = "";
    }

    if (cfg.table === "someday_items") {
      payload.category = extra.trim() || "General";
    }

    const { error } = await supabase.from(cfg.table).insert(payload);

    if (error) {
      toast.error(error.message);
      return;
    }

    setVal("");
    setExtra("");
    toast.success("Item added");
    load();
  };

  const remove = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from(cfg.table)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Item deleted");
    await load();
  };

  const saveEdit = async () => {
    if (!editingItem || !user) return;

    setSaving(true);

    const payload: any = {
      [cfg.titleCol]: editingItem[cfg.titleCol] || "",
    };

    if (cfg.table === "waiting_items") {
      payload.person = editingItem.person || "";
      payload.follow_up_date = editingItem.follow_up_date || null;
      payload.project = editingItem.project || "";
    }

    if (cfg.table === "someday_items") {
      payload.category = editingItem.category || "General";
      payload.notes = editingItem.notes || "";
    }

    const { error } = await supabase
      .from(cfg.table)
      .update(payload)
      .eq("id", editingItem.id)
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Changes saved");
    setEditingItem(null);
    load();
  };

  return (
    <div>
      <PageHeader eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} />

      <div className="w-full space-y-5 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel-soft p-3">
          <form onSubmit={add} className="flex flex-wrap gap-2">
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Capture..."
              className="min-w-[200px] flex-1 border-border/70 bg-background"
            />

            {cfg.table === "waiting_items" && (
              <Input
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="From whom?"
                className="w-44 border-border/70 bg-background"
              />
            )}

            {cfg.table === "someday_items" && (
              <Input
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="Category"
                className="w-44 border-border/70 bg-background"
              />
            )}

            <Button
              type="submit"
              className="actsix-btn-primary rounded-lg px-5"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        <Card className="actsix-panel divide-y divide-border/70 overflow-hidden">
          {loading && (
            <div className="actsix-loading-state min-h-[10rem]">
              Loading {cfg.title.toLowerCase()}...
            </div>
          )}

          {!loading && loadError && (
            <div className="flex min-h-[8rem] flex-col items-start justify-center gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Could not load this list
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try again to refresh your saved items.
                </p>
              </div>
              <Button type="button" variant="outline" className="rounded-xl" onClick={load}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !loadError && items.length === 0 && (
            <div className="actsix-empty-state m-3 min-h-[9rem] text-left">
              Nothing here yet.
            </div>
          )}

          {!loading && !loadError && items.map((it) => (
            <div
              key={it.id}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-brand-teal" />

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it[cfg.titleCol]}</div>

                {cfg.table === "waiting_items" && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Waiting for {it.person || "Someone"}</span>
                    <span>|</span>
                    <span>
                      Follow up:{" "}
                      {it.follow_up_date
                        ? new Date(it.follow_up_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "No date"}
                    </span>
                    {it.project && (
                      <>
                        <span>|</span>
                        <span className="chip bg-brand-teal/10 text-brand-teal border-brand-teal/20">
                          {it.project}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {cfg.table === "someday_items" && (
                  <div className="mt-1 space-y-1">
                    <span className="chip bg-secondary text-secondary-foreground">
                      {it.category || "General"}
                    </span>

                    {it.notes && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {it.notes}
                      </p>
                    )}
                  </div>
                )}

                {cfg.table === "inbox_items" && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {it.context} | {it.minutes}m
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="opacity-70 hover:opacity-100"
                title="Edit"
                aria-label="Edit"
                onClick={() => setEditingItem({ ...it })}
              >
                <Edit3 className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="opacity-70 hover:opacity-100 text-muted-foreground hover:text-destructive"
                title="Delete"
                aria-label="Delete"
                onClick={() => remove(it.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 bg-brand-ink/45 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="actsix-panel w-full max-w-xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-4 sm:p-5 border-b border-border/70">
              <div>
                <p className="label-eyebrow">Edit Item</p>
                <h2 className="text-xl font-extrabold tracking-tight mt-1">
                  {cfg.title}
                </h2>
              </div>

              <Button variant="outline" className="rounded-xl" onClick={() => setEditingItem(null)}>
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="actsix-panel-soft p-4">
                <label className="label-eyebrow">
                  {cfg.table === "waiting_items" ? "Waiting for" : "Title"}
                </label>
                <Input
                  value={editingItem[cfg.titleCol] || ""}
                  onChange={(event) =>
                    setEditingItem({
                      ...editingItem,
                      [cfg.titleCol]: event.target.value,
                    })
                  }
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              {cfg.table === "waiting_items" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="actsix-panel-soft p-4">
                    <label className="label-eyebrow">Who are you waiting for?</label>
                    <Input
                      value={editingItem.person || ""}
                      onChange={(event) =>
                        setEditingItem({
                          ...editingItem,
                          person: event.target.value,
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
                      value={editingItem.follow_up_date || ""}
                      onChange={(event) =>
                        setEditingItem({
                          ...editingItem,
                          follow_up_date: event.target.value,
                        })
                      }
                      className="mt-2 border-border/70 bg-background"
                    />
                  </div>

                  <div className="actsix-panel-soft p-4 md:col-span-2">
                    <label className="label-eyebrow">Related project</label>
                    <select
                      value={editingItem.project || ""}
                      onChange={(event) =>
                        setEditingItem({
                          ...editingItem,
                          project: event.target.value,
                        })
                      }
                      className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {cfg.table === "someday_items" && (
                <>
                  <div className="actsix-panel-soft p-4">
                    <label className="label-eyebrow">Category</label>
                    <Input
                      value={editingItem.category || ""}
                      onChange={(event) =>
                        setEditingItem({
                          ...editingItem,
                          category: event.target.value,
                        })
                      }
                      className="mt-2 border-border/70 bg-background"
                      placeholder="General, Idea, Future Project..."
                    />
                  </div>

                  <div className="actsix-panel-soft p-4">
                    <label className="label-eyebrow">Notes</label>
                    <textarea
                      value={editingItem.notes || ""}
                      onChange={(event) =>
                        setEditingItem({
                          ...editingItem,
                          notes: event.target.value,
                        })
                      }
                      className="mt-2 min-h-28 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Add thoughts, references, or future possibilities..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-background/95 p-4">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  await remove(editingItem.id);
                  setEditingItem(null);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>

                <Button
                  disabled={saving}
                  variant="outline"
                  className="rounded-xl actsix-btn-soft font-bold"
                  onClick={saveEdit}
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

export const Waiting = () => (
  <SimpleListPage
    cfg={{
      table: "waiting_items",
      titleCol: "item",
      eyebrow: "ACTSIX: Tasks",
      title: "Waiting For",
      subtitle: "What you're waiting on, and from whom.",
    }}
  />
);

export const Someday = () => (
  <SimpleListPage
    cfg={{
      table: "someday_items",
      titleCol: "title",
      eyebrow: "ACTSIX: Tasks",
      title: "Someday / Maybe",
      subtitle: "Ideas without a deadline.",
    }}
  />
);
