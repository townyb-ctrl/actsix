import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { logActivity } from "@/lib/activityLog";
import { supabase } from "@/integrations/supabase/client";
import feedbackAvatar from "@/assets/feedback-avatar.png";

const BUBBLE_SIZE = 96;
const EDGE_GAP = 16;
const POSITION_STORAGE_KEY = "actsix:feedback-bubble-position";
const FEEDBACK_RATE_LIMIT = 5;
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const FEEDBACK_PROMPT_INITIAL_DELAY_MS = 90 * 1000;
const FEEDBACK_PROMPT_INTERVAL_MS = 3 * 60 * 1000;
const FEEDBACK_PROMPT_VISIBLE_MS = 14 * 1000;
const FEEDBACK_INTRO_DELAY_MS = 10 * 1000;
const FEEDBACK_INTRO_VISIBLE_MS = 18 * 1000;
const FEEDBACK_PROMPTS = [
  "Don't forget to give me feedback.",
  "Hope you're having a great day.",
  "What's frustrating about this page?",
  "What do you wish this app could do?",
  "Anything feel confusing here?",
  "What would make this workflow smoother?",
  "Tell me what's missing.",
  "What feels slower than it should?",
  "Is anything getting in your way?",
  "What should Brandon improve next?",
];

type BubblePosition = {
  x: number;
  y: number;
};

const clampPosition = (position: BubblePosition) => {
  if (typeof window === "undefined") return position;

  return {
    x: Math.min(Math.max(EDGE_GAP, position.x), window.innerWidth - BUBBLE_SIZE - EDGE_GAP),
    y: Math.min(Math.max(EDGE_GAP, position.y), window.innerHeight - BUBBLE_SIZE - EDGE_GAP),
  };
};

const getInitialPosition = (): BubblePosition => {
  if (typeof window === "undefined") return { x: EDGE_GAP, y: EDGE_GAP };

  const storedPosition = window.localStorage.getItem(POSITION_STORAGE_KEY);
  if (storedPosition) {
    try {
      return clampPosition(JSON.parse(storedPosition));
    } catch {
      window.localStorage.removeItem(POSITION_STORAGE_KEY);
    }
  }

  return clampPosition({
    x: window.innerWidth - BUBBLE_SIZE - 24,
    y: window.innerHeight - BUBBLE_SIZE - 24,
  });
};

export function FeedbackBubble() {
  const { user } = useAuth();
  const { person: currentPerson, displayName } = useCurrentPerson();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<BubblePosition>(getInitialPosition);
  const [promptIndex, setPromptIndex] = useState(() =>
    Math.floor(Math.random() * FEEDBACK_PROMPTS.length)
  );
  const [promptVisible, setPromptVisible] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  const lastPromptIndexRef = useRef(promptIndex);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    moved: boolean;
  } | null>(null);

  const feedbackAvatarUrl = feedbackAvatar;
  const accountName = currentPerson?.display_name || displayName || user?.email || "Alpha tester";
  const firstName = accountName.split(/[ @]/)[0] || "there";
  const canSubmit = message.trim().length > 0 && !submitting;
  const panelOpensBelow = position.y < 260;
  const panelAlignsLeft = typeof window !== "undefined" && position.x < window.innerWidth / 2;
  const promptAlignsLeft =
    typeof window !== "undefined"
      ? position.x + BUBBLE_SIZE + 252 + 16 <= window.innerWidth
      : panelAlignsLeft;
  const introPrompt = `Hey ${firstName}, I'm here for quick feedback. Tap me anytime, or drag me wherever works best for you.`;
  const activePromptText = introVisible ? introPrompt : FEEDBACK_PROMPTS[promptIndex];

  const pageLabel = useMemo(() => {
    if (location.pathname === "/") return "Homebase";
    return location.pathname.replace(/^\//, "").replaceAll("/", " / ") || "ACTSIX";
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((currentPosition) => {
        const nextPosition = clampPosition(currentPosition);
        window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPosition));
        return nextPosition;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (open) {
      setIntroVisible(false);
      return;
    }

    const showIntroTimer = window.setTimeout(() => {
      setIntroVisible(true);
    }, FEEDBACK_INTRO_DELAY_MS);

    const hideIntroTimer = window.setTimeout(() => {
      setIntroVisible(false);
    }, FEEDBACK_INTRO_DELAY_MS + FEEDBACK_INTRO_VISIBLE_MS);

    return () => {
      window.clearTimeout(showIntroTimer);
      window.clearTimeout(hideIntroTimer);
    };
  }, [open]);

  useEffect(() => {
    if (open || introVisible) {
      setPromptVisible(false);
      return;
    }

    let hideTimer: number | undefined;

    const showPrompt = () => {
      setPromptIndex(() => {
        let nextIndex = Math.floor(Math.random() * FEEDBACK_PROMPTS.length);

        if (FEEDBACK_PROMPTS.length > 1) {
          while (nextIndex === lastPromptIndexRef.current) {
            nextIndex = Math.floor(Math.random() * FEEDBACK_PROMPTS.length);
          }
        }

        lastPromptIndexRef.current = nextIndex;
        return nextIndex;
      });

      setPromptVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        setPromptVisible(false);
      }, FEEDBACK_PROMPT_VISIBLE_MS);
    };

    const initialTimer = window.setTimeout(showPrompt, FEEDBACK_PROMPT_INITIAL_DELAY_MS);
    const intervalTimer = window.setInterval(showPrompt, FEEDBACK_PROMPT_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
      window.clearTimeout(hideTimer);
    };
  }, [introVisible, open]);

  const moveBubble = (nextPosition: BubblePosition) => {
    const clampedPosition = clampPosition(nextPosition);
    setPosition(clampedPosition);
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(clampedPosition));
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    setPromptVisible(false);
    setIntroVisible(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: position.x,
      initialY: position.y,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
      setOpen(false);
    }

    if (drag.moved) {
      moveBubble({
        x: drag.initialX + deltaX,
        y: drag.initialY + deltaY,
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!drag.moved) {
      setOpen((currentOpen) => !currentOpen);
    }
  };

  const handleSubmit = async () => {
    const cleanMessage = message.trim();
    if (!cleanMessage || !user) return;

    setSubmitting(true);

    const rateLimitWindowStart = new Date(Date.now() - FEEDBACK_RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: rateLimitError } = await (supabase as any)
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("entity_type", "alpha_feedback")
      .eq("action_type", "feedback_submitted")
      .gte("created_at", rateLimitWindowStart);

    if (rateLimitError) {
      setSubmitting(false);
      toast.error("Could not check feedback limit. Please try again.");
      return;
    }

    if ((count || 0) >= FEEDBACK_RATE_LIMIT) {
      setSubmitting(false);
      toast.error("Feedback limit reached. Please try again in a little while.");
      return;
    }

    const feedbackId = crypto.randomUUID();
    const { error } = await logActivity({
      userId: user.id,
      actorPersonId: currentPerson?.id ?? null,
      entityType: "alpha_feedback",
      entityId: feedbackId,
      actionType: "feedback_submitted",
      title: `Alpha feedback from ${accountName}`,
      description: cleanMessage,
      metadata: {
        page: pageLabel,
        path: location.pathname,
        search: location.search,
        url: window.location.href,
        userEmail: user.email ?? null,
        userAgent: navigator.userAgent,
      },
    });

    setSubmitting(false);

    if (error) {
      toast.error("Could not send feedback. Please try again.");
      return;
    }

    setMessage("");
    setOpen(false);
    toast.success("Feedback sent. Thank you!");
  };

  return (
    <div
      className="fixed z-[900]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {open && (
        <section
          className={`absolute w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-brand-teal/25 bg-card text-card-foreground shadow-card ${
            panelOpensBelow ? "top-[calc(100%+0.75rem)]" : "bottom-[calc(100%+0.75rem)]"
          } ${panelAlignsLeft ? "left-0" : "right-0"}`}
        >
          <div className="flex items-center justify-between border-b border-border/70 bg-brand-teal/8 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <PersonAvatar
                name="Feedback"
                avatarUrl={feedbackAvatarUrl}
                size="sm"
                className="ring-2 ring-brand-teal/20"
              />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold text-foreground">Send Brandon feedback</h2>
                <p className="truncate text-xs font-semibold text-muted-foreground">{pageLabel}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close feedback"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 p-4">
            <div className="rounded-md bg-muted/45 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              What felt confusing, broken, helpful, or missing while testing?
            </div>

            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type your thoughts here..."
              className="min-h-28 resize-none rounded-md"
              maxLength={1200}
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground">{message.length}/1200</span>
              <Button
                type="button"
                className="rounded-lg bg-brand-teal px-4 font-bold hover:bg-brand-teal/90"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                <Send className="h-4 w-4" />
                {submitting ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
        </section>
      )}

      {(introVisible || promptVisible) && !open && (
        <button
          type="button"
          className={`absolute bottom-5 hidden w-[min(15.75rem,calc(100vw-8rem))] rounded-lg border border-border/70 bg-card px-3.5 py-2.5 text-left text-xs font-bold leading-5 text-foreground shadow-soft transition hover:border-brand-teal/30 hover:bg-card sm:block ${
            promptAlignsLeft ? "left-[calc(100%+0.875rem)]" : "right-[calc(100%+0.875rem)]"
          }`}
          onClick={() => {
            setPromptVisible(false);
            setIntroVisible(false);
            setOpen(true);
          }}
          aria-label="Open feedback prompt"
        >
          {activePromptText}
          <span
            className={`absolute bottom-6 h-3 w-3 rotate-45 border-border/70 bg-card ${
              promptAlignsLeft
                ? "-left-1.5 border-b border-l"
                : "-right-1.5 border-r border-t"
            }`}
            aria-hidden="true"
          />
        </button>
      )}

      <button
        type="button"
        className="group flex h-24 w-24 cursor-grab touch-none items-center justify-center rounded-full border-2 border-brand-teal/35 bg-card p-1.5 text-brand-teal shadow-card outline-none ring-brand-teal/30 transition hover:border-brand-teal/60 hover:bg-brand-teal/5 active:cursor-grabbing focus-visible:ring-4"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label={open ? "Close feedback chat" : "Open feedback chat"}
        aria-expanded={open}
      >
        {feedbackAvatarUrl ? (
          <img
            src={feedbackAvatarUrl}
            alt="Feedback"
            draggable={false}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-background"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-teal/10">
            <MessageCircle className="h-8 w-8 transition group-hover:scale-105" />
          </span>
        )}
      </button>
    </div>
  );
}
