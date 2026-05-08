import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, Computer, Phone, Church, Brain, ShoppingBag, Home, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CompactTaskRow from "@/components/CompactTaskRow";
import { syncProjectStats } from "@/lib/syncProjectStats";

const contextIcon: Record<string, any> = {
  Computer,
  Calls: Phone,
  Church,
  "Deep Work": Brain,
  Errands: ShoppingBag,
  Home,
  Meetups: Users,
};

const CONTEXTS = ["Computer", "Calls", "Church", "Deep Work", "Errands", "Home", "Meetups"];

const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const parseLocalDate = (value?: string | null) => {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const isToday = (value?: string | null) => {
  const due = parseLocalDate(value);
  if (!due) return false;

  return due.getTime() === startOfToday().getTime();
};

const isThisWeek = (value?: string | null) => {
  const due = parseLocalDate(value);
  if (!due) return false;

  const today = startOfToday();
  const end = new Date(today);
  end.setDate(today.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return due >= today && due <= end;
};

const isOverdue = (value?: string | null) => {
  const due = parseLocalDate(value);
  if (!due) return false;

  return due < startOfToday();
};

const KpiCard = ({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: number;
  hint: string;
  to: string;
}) => (
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

const Dashboard = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState({ inbox: 0, next: 0, projects: 0, waiting: 0 });
  const [openTasks, setOpenTasks] = useState<any[]>([]);
  const [contextCounts, setContextCounts] = useState<Record<string, number>>({});
  const [contextNext, setContextNext] = useState<Record<string, any>>({});
  const [contextProjects, setContextProjects] = useState<Record<string, number>>({});

  const load = async () => {
    if (!user) return;

    const [inbox, next, projects, waiting, taskResult, projAll] = await Promise.all([
      supabase.from("inbox_items").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("complete", false),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("waiting_items").select("id", { count: "exact", head: true }),
      supabase
        .from("tasks")
        .select("*")
        .eq("complete", false)
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("area"),
    ]);

    setKpis({
      inbox: inbox.count ?? 0,
      next: next.count ?? 0,
      projects: projects.count ?? 0,
      waiting: waiting.count ?? 0,
    });

    const tasks = taskResult.data ?? [];
    setOpenTasks(tasks);

    const counts: Record<string, number> = {};
    const nexts: Record<string, any> = {};
    CONTEXTS.forEach((c) => (counts[c] = 0));

    tasks.forEach((task: any) => {
      if (CONTEXTS.includes(task.context)) {
        counts[task.context] = (counts[task.context] ?? 0) + 1;
        if (!nexts[task.context]) nexts[task.context] = task;
      }
    });

    setContextCounts(counts);
    setContextNext(nexts);

    const projCounts: Record<string, number> = {};
    CONTEXTS.forEach((c) => (projCounts[c] = 0));

    (projAll.data ?? []).forEach((project: any) => {
      if (CONTEXTS.includes(project.area)) {
        projCounts[project.area] = (projCounts[project.area] ?? 0) + 1;
      }
    });

    setContextProjects(projCounts);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const toggleTask = async (task: any) => {
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

  const sortedTasks = useMemo(() => {
    return [...openTasks].sort((a, b) => {
      const priorityDiff =
        (priorityWeight[b.priority || "Medium"] || 0) -
        (priorityWeight[a.priority || "Medium"] || 0);

      if (priorityDiff !== 0) return priorityDiff;

      const aOverdue = isOverdue(a.due) ? 1 : 0;
      const bOverdue = isOverdue(b.due) ? 1 : 0;

      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      const aDue = parseLocalDate(a.due)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDue = parseLocalDate(b.due)?.getTime() ?? Number.POSITIVE_INFINITY;

      return aDue - bDue;
    });
  }, [openTasks]);

  const focusTasks = useMemo(() => {
    return sortedTasks.slice(0, 5);
  }, [sortedTasks]);

  const maxContext = Math.max(1, ...Object.values(contextCounts));

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        subtitle="A calm command center for tasks, ministry, family, and creative work."
      />

      <div className="px-8 pb-12 max-w-7xl space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Inbox" value={kpis.inbox} hint={`${kpis.inbox} unprocessed`} to="/inbox" />
          <KpiCard label="Next Actions" value={kpis.next} hint={`${kpis.next} ready`} to="/tasks" />
          <KpiCard label="Projects" value={kpis.projects} hint={`${kpis.projects} open`} to="/projects" />
          <KpiCard label="Waiting For" value={kpis.waiting} hint={`${kpis.waiting} delegated`} to="/waiting" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3 p-6 shadow-card border-border/70 bg-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Today Focus</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Compact focus list drawn from active next actions.
                </p>
              </div>
              <span className="chip bg-secondary text-secondary-foreground">
                Highest Priority
              </span>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/10 p-2 space-y-1.5">
              {focusTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                  No active next actions yet.
                </div>
              )}

              {focusTasks.map((task) => (
                <CompactTaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                />
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2 p-7 shadow-card border-border/70 bg-card">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Focus Dynamics</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Active work distributed across contexts.
                </p>
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
                      <div className="text-[10px] text-muted-foreground">
                        {c} open action{c === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-teal rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="text-sm font-mono font-semibold tabular-nums text-right">
                      {c}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Contexts</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Jump into focused lanes for tasks, projects, and routines.
              </p>
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
                <Card
                  key={ctx}
                  className="relative overflow-hidden p-5 shadow-card border-border/70 bg-card hover:border-brand-teal/40 transition-colors group"
                >
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
