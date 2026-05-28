import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

type TourStep = {
  selector: string;
  title: string;
  body: string;
  path?: string;
  placement?: "top" | "bottom" | "left" | "right";
};

type GuidedTourProps = {
  onStepChange?: (step: TourStep | null) => void;
};

const TOUR_STORAGE_KEY = "actsix:onboarding-tour-complete";
const START_TOUR_EVENT = "actsix:start-tour";

const tourSteps: TourStep[] = [
  {
    selector: '[data-tour="module-menu"]',
    title: "Start with the module switcher",
    body: "Use the top-center ACTSIX icon to move between Tasks, Meetings, Service Planner, and People.",
    placement: "bottom",
  },
  {
    selector: '[data-tour="sidebar-primary-nav"]',
    title: "Then work inside a module",
    body: "The sidebar changes to the tools for the module you are in, so the next action is always nearby.",
    path: "/tasks",
    placement: "right",
  },
  {
    selector: '[data-tour="quick-capture"]',
    title: "Capture loose thoughts fast",
    body: "Quick Capture sends ideas straight to the inbox so you can process them later.",
    path: "/tasks",
    placement: "bottom",
  },
  {
    selector: '[data-tour="notifications"]',
    title: "Watch for what needs attention",
    body: "Notifications collect updates from across ACTSIX without making you leave your current flow.",
    placement: "bottom",
  },
  {
    selector: '[data-tour="account-menu"]',
    title: "Finish in your account menu",
    body: "Profile, settings, and this tutorial live here when you need to tune the workspace.",
    placement: "left",
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function GuidedTour({ onStepChange }: GuidedTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = active ? tourSteps[stepIndex] : null;

  const finishTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setActive(false);
    setStepIndex(0);
    onStepChange?.(null);
  }, [onStepChange]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      const timer = window.setTimeout(startTour, 700);
      return () => window.clearTimeout(timer);
    }
  }, [startTour]);

  useEffect(() => {
    const handleStartTour = () => {
      localStorage.removeItem(TOUR_STORAGE_KEY);
      startTour();
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
        setTargetRect(rect);
        target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      } else {
        setTargetRect(null);
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

  if (!active || !step) return null;

  const highlightStyle = targetRect
    ? {
        left: targetRect.left - 10,
        top: targetRect.top - 10,
        width: targetRect.width + 20,
        height: targetRect.height + 20,
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
      <div
        className="absolute left-0 right-0 top-0 bg-black/55 backdrop-blur-[1px]"
        style={{ height: overlayHole.top }}
      />
      <div
        className="absolute left-0 bg-black/55 backdrop-blur-[1px]"
        style={{
          top: overlayHole.top,
          width: overlayHole.left,
          height: overlayHole.height,
        }}
      />
      <div
        className="absolute right-0 bg-black/55 backdrop-blur-[1px]"
        style={{
          top: overlayHole.top,
          left: overlayHole.left + overlayHole.width,
          height: overlayHole.height,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 bg-black/55 backdrop-blur-[1px]"
        style={{ top: overlayHole.top + overlayHole.height }}
      />
      <div
        className="absolute rounded-2xl border-2 border-brand-teal-bright bg-transparent shadow-[0_0_34px_rgba(45,140,140,0.42)] transition-all duration-300"
        style={highlightStyle}
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

export const startGuidedTour = () => {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
};
