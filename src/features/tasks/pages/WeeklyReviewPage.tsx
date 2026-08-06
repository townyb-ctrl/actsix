import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Inbox as InboxIcon,
  ListChecks,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import { toDateKey } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { isOverdueFollowUp, isStalledProject, type ReviewProject, type ReviewWaitingItem } from "@/features/tasks/lib/weeklyReview";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";

type ReviewData = {
  inboxCount: number;
  overdueCount: number;
  stalledProjects: ReviewProject[];
  overdueFollowUps: ReviewWaitingItem[];
  somedayCount: number;
};

const emptyReview: ReviewData = {
  inboxCount: 0,
  overdueCount: 0,
  stalledProjects: [],
  overdueFollowUps: [],
  somedayCount: 0,
};

const WeeklyReviewPage = () => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const [review, setReview] = useState<ReviewData>(emptyReview);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const today = toDateKey(new Date());

    const [inbox, overdue, projects, waiting, someday] = await Promise.all([
      supabase.from("inbox_items").select("id", { count: "exact", head: true }),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .or(personalNextActionFilter(currentPerson?.id))
        .eq("complete", false)
        .lt("due", today),
      supabase.from("projects").select("id, name, status, next_action, open_tasks"),
      supabase.from("waiting_items").select("id, item, person, follow_up_date").eq("user_id", user.id),
      supabase.from("someday_items").select("id", { count: "exact", head: true }),
    ]);

    const anyError =
      inbox.error || overdue.error || projects.error || waiting.error || someday.error;

    if (anyError) {
      toast.error(friendlyErrorMessage(anyError));
      setLoadError(anyError.message);
      setLoading(false);
      return;
    }

    setReview({
      inboxCount: inbox.count ?? 0,
      overdueCount: overdue.count ?? 0,
      stalledProjects: (projects.data ?? []).filter(isStalledProject),
      overdueFollowUps: (waiting.data ?? []).filter((item) => isOverdueFollowUp(item, today)),
      somedayCount: someday.count ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user, currentPerson?.id]);

  const allClear = useMemo(
    () =>
      review.inboxCount === 0 &&
      review.overdueCount === 0 &&
      review.stalledProjects.length === 0 &&
      review.overdueFollowUps.length === 0 &&
      review.somedayCount === 0,
    [review],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Weekly Review"
        subtitle="Your weekly sweep — clear the inbox, unstick projects, and catch up on follow-ups."
        actions={
          <Button
            type="button"
            variant="outline"
            className="actsix-btn-outline min-h-10 gap-2"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        {loading ? (
          <Card className="actsix-panel-soft p-5">
            <div className="actsix-loading-state" role="status">
              Reviewing your lists...
            </div>
          </Card>
        ) : loadError ? (
          <Card className="actsix-panel-soft flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <div className="text-lg font-extrabold tracking-tight">Couldn't load your review</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button type="button" variant="outline" className="actsix-btn-outline min-h-10" onClick={load}>
              Try again
            </Button>
          </Card>
        ) : allClear ? (
          <Card className="actsix-panel-soft flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <div className="text-lg font-extrabold tracking-tight">You're all caught up</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Nothing needs attention this week. Capture something new when it comes to mind.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {review.inboxCount > 0 && (
              <ReviewSection
                icon={InboxIcon}
                title="Process your Inbox"
                description={`${review.inboxCount} ${review.inboxCount === 1 ? "item" : "items"} captured and waiting to be clarified.`}
                to="/tasks/inbox"
                actionLabel="Open Inbox"
              />
            )}

            {review.overdueCount > 0 && (
              <ReviewSection
                icon={ListChecks}
                title="Catch up on overdue actions"
                description={`${review.overdueCount} next ${review.overdueCount === 1 ? "action is" : "actions are"} past their due date.`}
                to="/tasks/next"
                actionLabel="Open Next Actions"
              />
            )}

            {review.stalledProjects.length > 0 && (
              <ReviewSection
                icon={FolderKanban}
                title="Unstick your projects"
                description={`${review.stalledProjects.length} active ${review.stalledProjects.length === 1 ? "project has" : "projects have"} open tasks but no next action set.`}
                to="/tasks/projects"
                actionLabel="Open Projects"
                items={review.stalledProjects.map((project) => project.name)}
              />
            )}

            {review.overdueFollowUps.length > 0 && (
              <ReviewSection
                icon={Clock}
                title="Follow up on Waiting For"
                description={`${review.overdueFollowUps.length} ${review.overdueFollowUps.length === 1 ? "item is" : "items are"} due for a follow-up.`}
                to="/tasks/waiting"
                actionLabel="Open Waiting For"
                items={review.overdueFollowUps.map((item) =>
                  item.person ? `${item.item} — ${item.person}` : item.item,
                )}
              />
            )}

            {review.somedayCount > 0 && (
              <ReviewSection
                icon={Sparkles}
                title="Reconsider Someday / Maybe"
                description={`${review.somedayCount} ${review.somedayCount === 1 ? "idea" : "ideas"} parked — worth a second look this week.`}
                to="/tasks/someday"
                actionLabel="Open Someday / Maybe"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewSection = ({
  icon: Icon,
  title,
  description,
  to,
  actionLabel,
  items,
}: {
  icon: typeof InboxIcon;
  title: string;
  description: string;
  to: string;
  actionLabel: string;
  items?: string[];
}) => (
  <Card className="actsix-panel-soft p-4 sm:p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-teal/10 text-brand-teal">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm font-extrabold text-foreground">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {items && items.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {items.slice(0, 5).map((item, index) => (
                <li key={index} className="truncate">
                  • {item}
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-xs text-muted-foreground">+{items.length - 5} more</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <Button asChild variant="outline" size="sm" className="shrink-0 gap-1 rounded-lg">
        <Link to={to}>
          {actionLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  </Card>
);

export default WeeklyReviewPage;
