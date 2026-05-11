import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Headphones,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  Mic2,
  PlayCircle,
  ScrollText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const ModuleCard = ({
  title,
  description,
  icon: Icon,
  to,
  status = "coming",
  meta,
}: {
  title: string;
  description: string;
  icon: any;
  to?: string;
  status?: "live" | "coming";
  meta?: string;
}) => {
  const content = (
    <Card className="group relative overflow-hidden p-5 border-border/70 bg-card shadow-card hover:border-brand-teal/40 transition-colors min-h-[180px]">
      <div className="absolute -right-6 -bottom-8 text-[120px] leading-none font-extrabold text-brand-teal/[0.035] select-none pointer-events-none">
        {title[0]}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="h-11 w-11 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            status === "live"
              ? "border-brand-teal/25 bg-brand-teal/10 text-brand-teal"
              : "border-border/70 bg-muted/40 text-muted-foreground"
          }`}
        >
          {status === "live" ? "Live" : "Coming soon"}
        </span>
      </div>

      <div className="mt-5">
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
        <span>{meta || "Part of the ACTSIX family"}</span>
        {to && (
          <ArrowUpRight className="h-4 w-4 group-hover:text-brand-teal transition-colors" />
        )}
      </div>
    </Card>
  );

  return to ? <Link to={to}>{content}</Link> : content;
};

const Dashboard = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [taskResult, projectResult] = await Promise.all([
        supabase.from("tasks").select("*").eq("complete", false),
        supabase.from("projects").select("id", { count: "exact", head: true }),
      ]);

      setTasks(taskResult.data ?? []);
      setProjectCount(projectResult.count ?? 0);
    })();
  }, [user]);

  const urgentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const priorityDiff =
          (priorityWeight[b.priority || "Medium"] || 0) -
          (priorityWeight[a.priority || "Medium"] || 0);

        if (priorityDiff !== 0) return priorityDiff;

        const aDue = a.due ? new Date(a.due).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due ? new Date(b.due).getTime() : Number.POSITIVE_INFINITY;

        return aDue - bDue;
      })
      .slice(0, 3);
  }, [tasks]);

  const modules = [
    {
      title: "ACTSIX: Tasks",
      description:
        "Capture, clarify, organize, and act. Your GTD-inspired ministry workflow system.",
      icon: ListChecks,
      to: "/tasks",
      status: "live" as const,
      meta: `${tasks.length} open actions · ${projectCount} projects`,
    },
    {
      title: "Meetings",
      description:
        "Agenda planning, minutes, attendees, decisions, and action points for church meetings.",
      icon: UsersRound,
    },
    {
      title: "Service Planning",
      description:
        "Plan worship services, roles, teams, songs, readings, liturgy, and production notes.",
      icon: CalendarDays,
    },
    {
      title: "Sermon Prep",
      description:
        "Organize sermon ideas, manuscripts, illustrations, outlines, research, and delivery notes.",
      icon: Mic2,
    },
    {
      title: "Scripture Tools",
      description:
        "Format Scripture readings, compare passages, prepare service readings, and structure Bible content.",
      icon: ScrollText,
    },
    {
      title: "Media Tools",
      description:
        "Manage downloads, audio prep, song analysis, media assets, and creative production workflows.",
      icon: PlayCircle,
    },
    {
      title: "People Care",
      description:
        "Track pastoral care, follow-ups, prayer needs, visits, and delegated care responsibilities.",
      icon: HeartHandshake,
    },
    {
      title: "Worship Resources",
      description:
        "Song library, keys, tempos, chord notes, biblical review, and team preparation resources.",
      icon: Headphones,
    },
    {
      title: "Documents",
      description:
        "Policies, ministry documents, templates, training guides, and repeatable admin resources.",
      icon: FileText,
    },
    {
      title: "ACTSIX Labs",
      description:
        "Experimental tools and future ideas for ministry workflows, automation, and productivity.",
      icon: Sparkles,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX"
        title="Homebase"
        subtitle="A family-level command center for ministry work. Open a module to enter its dedicated dashboard and tools."
      />

      <div className="px-8 pb-12 max-w-7xl space-y-8">
        <Card className="p-6 border-border/70 bg-card shadow-card">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <div>
              <div className="flex items-center gap-2 text-brand-teal font-bold text-sm">
                <LayoutDashboard className="h-4 w-4" />
                Organize the work. Serve the Word.
              </div>

              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                Welcome to ACTSIX
              </h2>

              <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Homebase gives you key signals from across the ACTSIX family.
                To work inside a specific area, open that module first.
              </p>

              <div className="mt-5">
                <Button asChild className="actsix-btn-primary rounded-xl">
                  <Link to="/tasks">Open ACTSIX: Tasks</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold tracking-tight">
                  Key Signals
                </h3>
                <span className="chip bg-secondary text-secondary-foreground">
                  Homebase
                </span>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                  <div className="label-eyebrow">Most urgent tasks</div>
                  <div className="mt-2 space-y-1">
                    {urgentTasks.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No active task signals yet.
                      </p>
                    )}

                    {urgentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="truncate font-semibold">{task.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {task.priority || "Medium"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                    <div className="label-eyebrow">Projects</div>
                    <div className="mt-1 text-2xl font-extrabold">
                      {projectCount}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                    <div className="label-eyebrow">Open Tasks</div>
                    <div className="mt-1 text-2xl font-extrabold">
                      {tasks.length}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                  Upcoming service, next sermon, and pastoral care signals will
                  appear here as those ACTSIX modules are built.
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                ACTSIX Family
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select a module to enter its dedicated workspace.
              </p>
            </div>

            <span className="chip bg-secondary text-secondary-foreground">
              1 live
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <ModuleCard key={module.title} {...module} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
