import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const Projects = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");

  const load = async () => {
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const id = crypto.randomUUID();
    const { error } = await supabase.from("projects").insert({ id, name: name.trim(), user_id: user.id });
    if (error) toast.error(error.message);
    else { setName(""); load(); }
  };

  return (
    <div>
      <PageHeader eyebrow="Workflow" title="Projects" subtitle="Multi-step endeavors and the next move on each." />
      <div className="px-8 pb-12 max-w-7xl space-y-6">
        <Card className="p-3 shadow-card border-border/70 bg-card">
          <form onSubmit={add} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name a new project…" className="border-transparent bg-muted/40" />
            <Button type="submit" className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-full px-5"><Plus className="h-4 w-4" /></Button>
          </form>
        </Card>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
          {items.map((p) => (
            <Card key={p.id} className="p-5 shadow-card border-border/70 bg-card hover:border-brand-teal/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <span className="chip bg-brand-teal/15 text-brand-teal">{p.area}</span>
                <span className="chip bg-secondary text-secondary-foreground">{p.status}</span>
              </div>
              <div className="text-xl font-extrabold tracking-tight mt-3 leading-tight">{p.name}</div>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-mono">
                  <span>{p.open_tasks} open</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-brand-teal rounded-full" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
              {p.next_action && <p className="mt-4 text-sm text-muted-foreground">→ {p.next_action}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Projects;
