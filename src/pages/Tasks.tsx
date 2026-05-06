import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PriorityChip = ({ p }: { p: string }) => {
  const map: Record<string, string> = {
    Low: "bg-secondary text-secondary-foreground",
    Medium: "bg-brand-amber/15 text-brand-amber",
    High: "bg-brand-coral/15 text-brand-coral",
    Urgent: "bg-brand-coral text-white",
  };
  return <span className={`chip ${map[p] ?? map.Medium}`}>{p}</span>;
};

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  const load = async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    setTasks(data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    const id = crypto.randomUUID();
    const { error } = await supabase.from("tasks").insert({ id, title: title.trim(), user_id: user.id });
    if (error) toast.error(error.message);
    else { setTitle(""); load(); }
  };

  const toggle = async (t: any) => {
    await supabase.from("tasks")
      .update({ complete: !t.complete, completed_at: !t.complete ? new Date().toISOString() : null })
      .eq("id", t.id);
    load();
  };
  const remove = async (id: string) => { await supabase.from("tasks").delete().eq("id", id); load(); };

  const open = tasks.filter((t) => !t.complete);
  const done = tasks.filter((t) => t.complete);

  return (
    <div>
      <PageHeader eyebrow="Workflow" title="Next Actions" subtitle="Capture, attend, complete. The next thing to do, in any context." />
      <div className="px-8 pb-12 max-w-5xl space-y-6">
        <Card className="p-3 shadow-card border-border/70 bg-card">
          <form onSubmit={add} className="flex gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Capture a task…" className="border-transparent bg-muted/40 focus-visible:bg-background" />
            <Button type="submit" className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-full px-5"><Plus className="h-4 w-4" /></Button>
          </form>
        </Card>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-extrabold tracking-tight">Open <span className="text-muted-foreground font-normal text-base">· {open.length}</span></h2>
          </div>
          <Card className="divide-y divide-border shadow-card border-border/70 bg-card">
            {open.length === 0 && <div className="p-6 text-sm text-muted-foreground">All clear.</div>}
            {open.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-4 group hover:bg-muted/30">
                <Checkbox checked={t.complete} onCheckedChange={() => toggle(t)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{t.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-brand-teal/15 text-brand-teal">{t.context}</span>
                    <PriorityChip p={t.priority} />
                    <span className="chip bg-secondary text-secondary-foreground">Energy: {t.energy}</span>
                    <span className="chip bg-secondary text-secondary-foreground font-mono">{t.minutes}m</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => remove(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="text-xl font-extrabold tracking-tight text-muted-foreground mb-3">Completed <span className="font-normal text-base">· {done.length}</span></h2>
            <Card className="divide-y divide-border shadow-card border-border/70 bg-card opacity-70">
              {done.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-4 group">
                  <Checkbox checked onCheckedChange={() => toggle(t)} />
                  <div className="flex-1 truncate line-through text-muted-foreground">{t.title}</div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => remove(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Card>
          </section>
        )}
      </div>
    </div>
  );
};

export default Tasks;
