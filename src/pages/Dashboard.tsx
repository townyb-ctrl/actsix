import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAlphaMode, getReleaseLabel } from "@/lib/releaseMode";

const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const Dashboard = () => {
  const { user } = useAuth();
  const { displayName } = useCurrentPerson();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();

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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);


  if (!workspaceLoading && !workspace) {
    return (
      <div>
        <PageHeader
          eyebrow="ACTSIX"
          title="Workspace Setup"
          subtitle="Create or join a church workspace before using ACTSIX."
        />

        <div className="w-full px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
          <Card className="border-border/70 bg-card p-6 shadow-card">
            <h2 className="text-2xl font-extrabold tracking-tight">
              Connect ACTSIX to your church
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ACTSIX is designed around church workspaces. Create your church workspace
              or join one using the code and secret phrase from your admin.
            </p>

            <div className="mt-5">
              <Button asChild className="actsix-btn-primary rounded-xl">
                <Link to="/workspace-setup">Set Up Workspace</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX"
        title="Homebase"
        subtitle={
          isAlphaMode
            ? "Alpha workspace for testing the core ACTSIX ministry workflows."
            : "A family-level command center for ministry work. Open a module to enter its dedicated dashboard and tools."
        }
      />

      <div className="w-full space-y-8 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="p-6 border-border/70 bg-card shadow-card">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] items-start">
            <div>
              <div className="flex items-center gap-2 text-brand-teal font-bold text-sm">
                <LayoutDashboard className="h-4 w-4" />
                Organize the work. Serve the Word.
              </div>

              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                {greeting}, {displayName}
              </h2>

              <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {isAlphaMode
                  ? "This Alpha version focuses on the core workflows we are testing with churches: People, Groups, Tasks, Projects, Service Planning, and Meetings."
                  : "Homebase gives you key signals from across the ACTSIX family. To work inside a specific area, open that module first."}
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
                  {getReleaseLabel()}
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
                  Alpha signals will stay focused on real ministry activity: tasks, projects, people, services, and meetings.
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;


