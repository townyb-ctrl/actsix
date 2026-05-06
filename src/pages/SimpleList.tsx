import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

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
  const [val, setVal] = useState("");
  const [extra, setExtra] = useState("");

  const load = async () => {
    const { data } = await supabase.from(cfg.table).select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user, cfg.table]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim() || !user) return;
    const id = crypto.randomUUID();
    const payload: any = { id, user_id: user.id, [cfg.titleCol]: val.trim() };
    if (cfg.table === "waiting_items") payload.person = extra.trim() || "Someone";
    await supabase.from(cfg.table).insert(payload);
    setVal(""); setExtra(""); load();
  };
  const remove = async (id: string) => { await supabase.from(cfg.table).delete().eq("id", id); load(); };

  return (
    <div>
      <PageHeader eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} />
      <div className="px-8 pb-12 max-w-4xl space-y-6">
        <Card className="p-3 shadow-card border-border/70 bg-card">
          <form onSubmit={add} className="flex gap-2 flex-wrap">
            <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Capture…" className="flex-1 min-w-[200px] border-transparent bg-muted/40" />
            {cfg.table === "waiting_items" && (
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="From whom?" className="w-44 border-transparent bg-muted/40" />
            )}
            <Button type="submit" className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-full px-5"><Plus className="h-4 w-4" /></Button>
          </form>
        </Card>

        <Card className="divide-y divide-border shadow-card border-border/70 bg-card">
          {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nothing here yet.</div>}
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 p-4 group hover:bg-muted/30">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it[cfg.titleCol]}</div>
                {cfg.table === "waiting_items" && <div className="text-xs text-muted-foreground mt-0.5">From {it.person}</div>}
                {cfg.table === "someday_items" && <div className="mt-1"><span className="chip bg-secondary text-secondary-foreground">{it.category}</span></div>}
                {cfg.table === "inbox_items" && <div className="text-xs text-muted-foreground mt-0.5">{it.context} · {it.minutes}m</div>}
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

export const Inbox = () => (
  <SimpleListPage cfg={{ table: "inbox_items", titleCol: "title", eyebrow: "Workflow", title: "Inbox", subtitle: "Everything you've captured, awaiting a decision." }} />
);
export const Waiting = () => (
  <SimpleListPage cfg={{ table: "waiting_items", titleCol: "item", eyebrow: "Workflow", title: "Waiting For", subtitle: "What you're waiting on, and from whom." }} />
);
export const Someday = () => (
  <SimpleListPage cfg={{ table: "someday_items", titleCol: "title", eyebrow: "Workflow", title: "Someday / Maybe", subtitle: "Ideas without a deadline. Treat them gently." }} />
);
