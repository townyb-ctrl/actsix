import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { isSoftwareDeveloper } from "@/lib/developerAccess";
import { supabase } from "@/integrations/supabase/client";

type FeedbackMetadata = {
  page?: string | null;
  path?: string | null;
  url?: string | null;
  userEmail?: string | null;
  userAgent?: string | null;
  handled?: boolean;
  handledAt?: string | null;
  handledBy?: string | null;
};

type FeedbackItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  metadata: FeedbackMetadata | null;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const metadataFrom = (metadata: unknown): FeedbackMetadata => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as FeedbackMetadata;
};

export default function AlphaFeedback() {
  const { user } = useAuth();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const developer = isSoftwareDeveloper({ user, workspace });

  const feedbackCountLabel = useMemo(() => {
    if (feedback.length === 1) return "1 note";
    return `${feedback.length} notes`;
  }, [feedback.length]);

  const loadFeedback = async () => {
    if (!developer) return;

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("activity_logs")
      .select("id, title, description, created_at, metadata")
      .eq("entity_type", "alpha_feedback")
      .eq("action_type", "feedback_submitted")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setFeedback(
      (data || []).map((item: any) => ({
        ...item,
        metadata: metadataFrom(item.metadata),
      })),
    );
  };

  const updateHandled = async (item: FeedbackItem, handled: boolean) => {
    const nextMetadata: FeedbackMetadata = {
      ...(item.metadata || {}),
      handled,
      handledAt: handled ? new Date().toISOString() : null,
      handledBy: handled ? user?.email ?? user?.id ?? null : null,
    };

    setFeedback((currentFeedback) =>
      currentFeedback.map((feedbackItem) =>
        feedbackItem.id === item.id ? { ...feedbackItem, metadata: nextMetadata } : feedbackItem,
      ),
    );

    const { error } = await (supabase as any)
      .from("activity_logs")
      .update({ metadata: nextMetadata })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      setFeedback((currentFeedback) =>
        currentFeedback.map((feedbackItem) =>
          feedbackItem.id === item.id ? { ...feedbackItem, metadata: item.metadata } : feedbackItem,
        ),
      );
    }
  };

  useEffect(() => {
    if (workspaceLoading || !developer) return;
    loadFeedback();
  }, [workspaceLoading, developer]);

  if (!workspaceLoading && !developer) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Software Developer"
        title="Alpha Feedback"
        subtitle="Read tester comments submitted from the floating feedback chat."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full gap-2"
            onClick={loadFeedback}
            disabled={loading || workspaceLoading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="w-full space-y-5 px-4 py-8 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="flex flex-col gap-3 border-brand-teal/20 bg-brand-teal/5 p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-brand-teal/10 text-brand-teal">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-extrabold text-foreground">Developer-only view</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Hidden from alpha testers and regular workspace members.
              </p>
            </div>
          </div>
          <div className="text-sm font-extrabold text-brand-teal">{feedbackCountLabel}</div>
        </Card>

        {loading || workspaceLoading ? (
          <Card className="border-border/60 p-6 text-sm text-muted-foreground shadow-soft">
            Loading feedback...
          </Card>
        ) : feedback.length === 0 ? (
          <Card className="border-border/60 p-6 text-sm text-muted-foreground shadow-soft">
            No alpha feedback has been submitted yet.
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/60 shadow-soft">
            <div className="grid grid-cols-[5.5rem_minmax(12rem,0.9fr)_minmax(0,2.2fr)_8rem] gap-4 border-b border-border/70 bg-muted/35 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground max-lg:hidden">
              <span>Handled</span>
              <span>Info</span>
              <span>Comment</span>
              <span className="text-right">Date</span>
            </div>

            {feedback.map((item) => {
              const metadata = item.metadata || {};
              const sender = metadata.userEmail || item.title.replace("Alpha feedback from ", "");
              const page = metadata.page || metadata.path || "Unknown page";
              const handled = Boolean(metadata.handled);

              return (
                <div
                  key={item.id}
                  className={`grid gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 lg:grid-cols-[5.5rem_minmax(12rem,0.9fr)_minmax(0,2.2fr)_8rem] lg:items-start lg:gap-4 ${
                    handled ? "bg-muted/20 text-muted-foreground" : ""
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <Checkbox
                      checked={handled}
                      onCheckedChange={(checked) => updateHandled(item, checked === true)}
                      aria-label={`Mark feedback from ${sender} as handled`}
                    />
                    <span>{handled ? "Done" : "Open"}</span>
                  </label>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-foreground">{sender}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
                      <span className="font-bold uppercase tracking-[0.12em] text-brand-teal">{page}</span>
                      {metadata.path && <span>{metadata.path}</span>}
                      {metadata.url && (
                        <a
                          href={metadata.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-teal transition hover:text-brand-teal/80"
                        >
                          Open page
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {item.description}
                  </p>

                  <div className="space-y-1 text-xs font-semibold text-muted-foreground lg:text-right">
                    <time>{formatDate(item.created_at)}</time>
                    {metadata.handledAt && <div>Handled {formatDate(metadata.handledAt)}</div>}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
