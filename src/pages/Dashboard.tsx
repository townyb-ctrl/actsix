import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpRight, Computer, Phone, Church, Brain, ShoppingBag, Home, Users } from "lucide-react";
import { Link } from "react-router-dom";

const contextIcon: Record<string, any> = {
  Computer, Calls: Phone, Church, "Deep Work": Brain, Errands: ShoppingBag, Home, Meetups: Users,
};
const CONTEXTS = ["Computer", "Calls", "Church", "Deep Work", "Errands", "Home", "Meetups"];

const KpiCard = ({ label, value, hint, to }: { label: string; value: number; hint: string; to: string }) => (
  <Link to={to}>
    <Card className="p-5 shadow-card border-border/70 bg-card hover:border-brand-teal/40 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="label-eyebrow">{label}</div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-teal transition-colors" />
      </div>
      <div className="mt-4 text-5xl font-extrabold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </Card>
  </Link>
);

const PriorityChip = ({ p }: { p: string }) => {
  const map: Record<string, string> = {
    Low: "bg-secondary text-secondary-foreground",
    Medium: "bg-brand-amber/15 text-brand-amber",
    High: "bg-brand-coral/15 text-brand-coral",
    Urgent: "bg-brand-coral text-white",
  };
  return <span className={`chip ${map[p] ?? map.Medium}`}>{p}</span>;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState({ inbox: 0, next: 0, projects: 0, waiting: 0 });
  const [topTasks, setTopTasks] = useState<any[]>([]);
  const [contextCounts, setContextCounts] = useState<Record<string, number>>({});
  const [contextNext, setContextNext] = useState<Record<string, any>>({});
  const [contextProjects, setContextProjects] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [inbox, next, projects, waiting, openTasks, projAll] = await Promise.all([
        supabase.from("inbox_items").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("complete", false),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("waiting_items").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("*").eq("complete", false).order("priority", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("projects").select("area"),
      ]);
      setKpis({
        inbox: inbox.count ?? 0,
        next: next.count ?? 0,
        projects: projects.count ?? 0,
        waiting: waiting.count ?? 0,
      });
      const tasks = openTasks.data ?? [];
      // top 3 by priority order
      const order = ["Urgent", "High", "Medium", "Low"];
      const sorted = [...tasks].sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
      setTopTasks(sorted.slice(0, 3));

      const counts: Record<string, number> = {};
      const nexts: Record<string, any> = {};
      CONTEXTS.forEach((c) => (counts[c] = 0));
      tasks.forEach((t: any) => {
        if (CONTEXTS.includes(t.context)) {
          counts[t.context] = (counts[t.context] ?? 0) + 1;
          if (!nexts[t.context]) nexts[t.context] = t;
        }
      });
      setContextCounts(counts);
      setContextNext(nexts);

      const projCounts: Record<string, number> = {};
      CONTEXTS.forEach((c) => (projCounts[c] = 0));
      (projAll.data ?? []).forEach((p: any) => {
        if (CONTEXTS.includes(p.area)) projCounts[p.area] = (projCounts[p.area] ?? 0) + 1;
      });
      setContextProjects(projCounts);
    })();
  }, [user]);

  const maxContext = Math.max(1, ...Object.values(contextCounts));

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        subtitle="A calm command center for tasks, ministry, family, and creative work. Same familiar layout, fully aligned to your brand system."
      />

      <div className="px-8 pb-12 max-w-7xl space-y-8">
        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Inbox" value={kpis.inbox} hint={`${kpis.inbox} unprocessed`} to="/inbox" />
          <KpiCard label="Next Actions" value={kpis.next} hint={`${kpis.next} ready`} to="/tasks" />
          <KpiCard label="Projects" value={kpis.projects} hint={`${kpis.projects} open`} to="/projects" />
          <KpiCard label="Waiting For" value={kpis.waiting} hint={`${kpis.waiting} delegated`} to="/waiting" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Today Focus */}
          <Card className="lg:col-span-3 p-7 shadow-card border-border/70 bg-card">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Today Focus</h2>
                <p className="text-sm text-muted-foreground mt-1">Top three priorities selected from active next actions.</p>
              </div>
              <span className="chip bg-secondary text-secondary-foreground">Top 3</span>
            </div>
            <div className="space-y-3">
              {topTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                  Capture a task to begin focusing your day.
                </div>
              )}
              {topTasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{t.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="chip bg-brand-teal/15 text-brand-teal">{t.context}</span>
                        <PriorityChip p={t.priority} />
                        <span className="chip bg-secondary text-secondary-foreground">Energy: {t.energy}</span>
                        <span className="chip bg-secondary text-secondary-foreground font-mono">{t.minutes} min</span>
                        {t.due && <span className="chip bg-secondary text-secondary-foreground">{new Date(t.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                      </div>
                      {t.project && <div className="mt-2 text-xs text-muted-foreground">↳ {t.project}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Focus Dynamics */}
          <Card className="lg:col-span-2 p-7 shadow-card border-border/70 bg-card">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Focus Dynamics</h2>
                <p className="text-sm text-muted-foreground mt-1">Active work distributed across contexts.</p>
              </div>
              <span className="chip bg-secondary text-secondary-foreground">This week</span>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-3">
              <span>Context</span>
              <span>0 — {maxContext} open</span>
            </div>
            <div className="space-y-3">
              {CONTEXTS.map((ctx) => {
                const c = contextCounts[ctx] ?? 0;
                const pct = (c / maxContext) * 100;
                return (
                  <div key={ctx} className="grid grid-cols-[110px_1fr_24px] items-center gap-3">
                    <div>
                      <div className="text-sm font-semibold">{ctx}</div>
                      <div className="text-[10px] text-muted-foreground">{c} open action{c === 1 ? "" : "s"}</div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-brand-teal rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-sm font-mono font-semibold tabular-nums text-right">{c}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Contexts */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Contexts</h2>
              <p className="text-sm text-muted-foreground mt-1">Jump into a focused view for tasks, projects, and weekly routines by context.</p>
            </div>
            <span className="chip bg-secondary text-secondary-foreground">Focus lanes</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CONTEXTS.map((ctx) => {
              const Icon = contextIcon[ctx] ?? Computer;
              const c = contextCounts[ctx] ?? 0;
              const next = contextNext[ctx];
              const projCount = contextProjects[ctx] ?? 0;
              return (
                <Card key={ctx} className="relative overflow-hidden p-5 shadow-card border-border/70 bg-card hover:border-brand-teal/40 transition-colors group">
                  <div className="absolute -right-4 -bottom-6 text-[120px] leading-none font-extrabold text-brand-teal/[0.04] select-none pointer-events-none">
                    {ctx[0]}
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="chip bg-secondary text-secondary-foreground">{c} open</span>
                  </div>
                  <div className="font-extrabold text-lg">{ctx}</div>
                  <div className="mt-2 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {next ? <>Next: {next.title}</> : "No actions queued"}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{projCount} project{projCount === 1 ? "" : "s"} · 0 weekly</span>
                    <ArrowUpRight className="h-4 w-4 group-hover:text-brand-teal transition-colors" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
