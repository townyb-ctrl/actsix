import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { TourKey } from "@/hooks/useUserSettings";

type TourStep = {
  selector: string;
  title: string;
  body: string;
  path?: string;
  placement?: "top" | "bottom" | "left" | "right";
};

type GuidedTourProps = {
  onStepChange?: (step: TourStep | null) => void;
  onComplete?: (tourKey: TourKey) => void;
};

const START_TOUR_EVENT = "actsix:start-tour";

const tours: Record<TourKey, TourStep[]> = {
  home: [
    {
      selector: '[data-tour="home-overview"]',
      title: "Home is your daily command center",
      body: "Start here to see what needs attention today, the next service, active projects, meetings, and your calendar.",
      path: "/",
      placement: "bottom",
    },
    {
      selector: '[data-tour="module-menu"]',
      title: "Switch modules from the left menu",
      body: "This selector stays with you across ACTSIX. Use it to move between Home, Tasks, People, and any optional modules you activate.",
      path: "/",
      placement: "right",
    },
    {
      selector: '[data-tour="quick-capture"]',
      title: "Capture work without leaving the page",
      body: "Quick Capture is for loose thoughts, follow-ups, and tasks that need to land somewhere quickly.",
      path: "/",
      placement: "bottom",
    },
    {
      selector: '[data-tour="account-menu"]',
      title: "Profile and settings live here",
      body: "Open your profile, settings, module activation, and tutorials from the account menu.",
      path: "/",
      placement: "left",
    },
  ],
  tasks: [
    {
      selector: '[data-tour="tasks-gtd-primer"]',
      title: "Start by getting it out of your head",
      body: "GTD starts with capture: every task, follow-up, idea, or worry gets parked in a trusted inbox so your brain does not have to hold it.",
      path: "/tasks/next",
      placement: "bottom",
    },
    {
      selector: '[data-tour="sidebar-primary-nav"]',
      title: "Tasks follows a simple GTD loop",
      body: "Inbox is for raw capture. Next Actions is for work you can do. Projects hold outcomes. Waiting For tracks delegated work. Someday holds ideas for later.",
      path: "/tasks/next",
      placement: "right",
    },
    {
      selector: '[data-tour="tasks-first-capture"]',
      title: "Add your first task",
      body: "Capture one real thing that has your attention. It does not need to be perfect yet. The first win is getting it into the system.",
      path: "/tasks/next",
      placement: "bottom",
    },
    {
      selector: '[data-tour="tasks-clarify"]',
      title: "Clarify it into the next physical action",
      body: "After capture, ask: what is the next visible action? If it takes more than one step, it probably belongs in a Project with a next action attached.",
      path: "/tasks/next",
      placement: "bottom",
    },
    {
      selector: '[data-tour="tasks-filters"]',
      title: "Choose by context, time, energy, and priority",
      body: "GTD is not one giant to-do list. Use filters to find the action that fits where you are, how much time you have, and how much energy you have.",
      path: "/tasks/next",
      placement: "bottom",
    },
    {
      selector: '[data-tour="tasks-list"]',
      title: "Work from Next Actions",
      body: "This list should hold only actionable work. Open a row to clarify details, assign, schedule, or complete it when it is done.",
      path: "/tasks/next",
      placement: "top",
    },
  ],
  people: [
    {
      selector: '[data-tour="people-actions"]',
      title: "People starts with the directory",
      body: "Add one person at a time, import a CSV, or send welcome messages when your workspace is ready.",
      path: "/people",
      placement: "bottom",
    },
    {
      selector: '[data-tour="people-search"]',
      title: "Find and filter quickly",
      body: "Search by name, phone, email, gender, or notes. Filters help you spot incomplete profiles.",
      path: "/people",
      placement: "bottom",
    },
    {
      selector: '[data-tour="people-list"]',
      title: "Profiles connect the rest of ACTSIX",
      body: "People profiles can connect to task assignments, service teams, meeting roles, and groups.",
      path: "/people",
      placement: "top",
    },
  ],
  meetings: [
    {
      selector: '[data-tour="meetings-stats"]',
      title: "Meetings gives you the current shape",
      body: "See total, scheduled, and unscheduled meetings before you drill into the list.",
      path: "/meetings",
      placement: "bottom",
    },
    {
      selector: '[data-tour="meetings-actions"]',
      title: "Create or find a meeting",
      body: "Search existing meetings or add a new one with date, time, location, and online meeting details.",
      path: "/meetings",
      placement: "bottom",
    },
    {
      selector: '[data-tour="meetings-list"]',
      title: "Open a meeting to plan details",
      body: "Meeting detail pages hold agenda, notes, people roles, and action points.",
      path: "/meetings",
      placement: "top",
    },
  ],
  service_planner: [
    {
      selector: '[data-tour="service-planner-actions"]',
      title: "Start with service types",
      body: "Create a service type, then add dates underneath it for individual services.",
      path: "/service-planner",
      placement: "bottom",
    },
    {
      selector: '[data-tour="service-planner-search"]',
      title: "Find services as the list grows",
      body: "Search service types, dates, and locations from the top of the planner.",
      path: "/service-planner",
      placement: "bottom",
    },
    {
      selector: '[data-tour="service-planner-list"]',
      title: "Open dates to build the plan",
      body: "Each service date opens into order of service, team assignments, reminders, and activity history.",
      path: "/service-planner",
      placement: "top",
    },
  ],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function GuidedTour({ onStepChange, onComplete }: GuidedTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTourKey, setActiveTourKey] = useState<TourKey | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetRadius, setTargetRadius] = useState(18);

  const tourSteps = activeTourKey ? tours[activeTourKey] : [];
  const step = activeTourKey ? tourSteps[stepIndex] : null;

  const finishTour = useCallback(() => {
    if (activeTourKey) {
      onComplete?.(activeTourKey);
    }

    setActiveTourKey(null);
    setStepIndex(0);
    onStepChange?.(null);
  }, [activeTourKey, onComplete, onStepChange]);

  const startTour = useCallback((tourKey: TourKey = "home") => {
    setStepIndex(0);
    setActiveTourKey(tourKey);
  }, []);

  useEffect(() => {
    const handleStartTour = (event: Event) => {
      const tourKey = (event as CustomEvent<TourKey>).detail || "home";
      startTour(tourKey);
    };

    window.addEventListener(START_TOUR_EVENT, handleStartTour);
    return () => window.removeEventListener(START_TOUR_EVENT, handleStartTour);
  }, [startTour]);

  useEffect(() => {
    onStepChange?.(step);

    if (step?.path && location.pathname !== step.path) {
      navigate(step.path);
    }
  }, [location.pathname, navigate, onStepChange, step]);

  useLayoutEffect(() => {
    if (!step) {
      setTargetRect(null);
      return;
    }

    let frame = 0;

    const updateRect = () => {
      const target = document.querySelector(step.selector);

      if (target) {
        const rect = target.getBoundingClientRect();
        const styles = window.getComputedStyle(target);
        const radius = Number.parseFloat(styles.borderTopLeftRadius) || 18;
        setTargetRect(rect);
        setTargetRadius(radius);
        target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      } else {
        setTargetRect(null);
        setTargetRadius(18);
      }
    };

    frame = window.requestAnimationFrame(updateRect);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [location.pathname, step]);

  const cardPosition = useMemo(() => {
    if (!targetRect || !step) return { left: 20, top: 112 };

    const gap = 18;
    const width = Math.min(360, window.innerWidth - 32);
    const height = 230;
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;

    if (step.placement === "right") {
      return {
        left: clamp(targetRect.right + gap, 16, window.innerWidth - width - 16),
        top: clamp(centerY - height / 2, 16, window.innerHeight - height - 16),
      };
    }

    if (step.placement === "left") {
      return {
        left: clamp(targetRect.left - width - gap, 16, window.innerWidth - width - 16),
        top: clamp(centerY - height / 2, 16, window.innerHeight - height - 16),
      };
    }

    if (step.placement === "top") {
      return {
        left: clamp(centerX - width / 2, 16, window.innerWidth - width - 16),
        top: clamp(targetRect.top - height - gap, 16, window.innerHeight - height - 16),
      };
    }

    return {
      left: clamp(centerX - width / 2, 16, window.innerWidth - width - 16),
      top: clamp(targetRect.bottom + gap, 16, window.innerHeight - height - 16),
    };
  }, [targetRect, step]);

  if (!activeTourKey || !step) return null;

  const padding = step.selector === '[data-tour="sidebar-primary-nav"]' ? 12 : 10;
  const highlightRadius = Math.max(12, Math.min(28, targetRadius + padding));
  const highlightStyle = targetRect
    ? {
        left: clamp(targetRect.left - padding, 0, window.innerWidth),
        top: clamp(targetRect.top - padding, 0, window.innerHeight),
        width:
          clamp(targetRect.right + padding, 0, window.innerWidth) -
          clamp(targetRect.left - padding, 0, window.innerWidth),
        height:
          clamp(targetRect.bottom + padding, 0, window.innerHeight) -
          clamp(targetRect.top - padding, 0, window.innerHeight),
      }
    : {
        left: 16,
        top: 96,
        width: 80,
        height: 80,
      };
  const overlayHole = highlightStyle;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-[2000] pointer-events-none">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={overlayHole.left}
              y={overlayHole.top}
              width={overlayHole.width}
              height={overlayHole.height}
              rx={highlightRadius}
              ry={highlightRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.35)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      <div className="pointer-events-auto absolute left-0 right-0 top-0" style={{ height: overlayHole.top }} />
      <div
        className="pointer-events-auto absolute left-0"
        style={{
          top: overlayHole.top,
          width: overlayHole.left,
          height: overlayHole.height,
        }}
      />
      <div
        className="pointer-events-auto absolute right-0"
        style={{
          top: overlayHole.top,
          left: overlayHole.left + overlayHole.width,
          height: overlayHole.height,
        }}
      />
      <div
        className="pointer-events-auto absolute bottom-0 left-0 right-0"
        style={{ top: overlayHole.top + overlayHole.height }}
      />
      <div
        className="absolute border-2 border-brand-teal-bright bg-transparent shadow-[0_0_22px_rgba(45,140,140,0.35)] transition-all duration-300"
        style={{ ...highlightStyle, borderRadius: highlightRadius }}
      />

      <section
        className="pointer-events-auto fixed w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/70 bg-card text-foreground shadow-lg transition-all duration-300"
        style={cardPosition}
        role="dialog"
        aria-modal="true"
        aria-label="ACTSIX tutorial"
      >
        <div className="border-b border-border/70 bg-brand-teal/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase text-brand-teal">
              Step {stepIndex + 1} of {tourSteps.length}
            </p>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
              onClick={finishTour}
              aria-label="Close tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <h2 className="text-lg font-extrabold tracking-normal text-foreground">
            {step.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
            disabled={isFirstStep}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-1.5">
            {tourSteps.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-5 rounded-full transition ${
                  index === stepIndex ? "bg-brand-teal" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full bg-brand-teal text-white hover:bg-brand-teal-dark"
            onClick={() => {
              if (isLastStep) {
                finishTour();
                return;
              }

              setStepIndex((index) => index + 1);
            }}
          >
            {isLastStep ? (
              <>
                Done
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}

export const startGuidedTour = (tourKey: TourKey = "home") => {
  window.dispatchEvent(new CustomEvent(START_TOUR_EVENT, { detail: tourKey }));
};
