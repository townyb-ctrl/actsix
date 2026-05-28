import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CalendarDays,
  HelpCircle,
  Home,
  ListChecks,
  LogOut,
  Music,
  Settings,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { GuidedTour, startGuidedTour } from "./GuidedTour";
import actsixIconWhite from "@/assets/branding/actsix-icon-white.png";

const getBackTarget = (pathname: string) => {
  if (pathname.startsWith("/service-planner/teams/")) {
    return { label: "Back to Teams", to: "/service-planner/teams" };
  }

  if (pathname.startsWith("/service-planner/services/")) {
    return { label: "Back to Services", to: "/service-planner/services" };
  }

  if (pathname.startsWith("/meetings/recurring/")) {
    return { label: "Back to Recurring Meetings", to: "/meetings/recurring" };
  }

  if (pathname.startsWith("/meetings/") && pathname !== "/meetings") {
    return { label: "Back to Meetings", to: "/meetings" };
  }

  if (pathname.startsWith("/people/")) {
    return { label: "Back to People", to: "/people" };
  }

  if (pathname.startsWith("/tasks/projects/")) {
    return { label: "Back to Projects", to: "/tasks/projects" };
  }

  return null;
};

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { person: currentPerson, displayName } = useCurrentPerson();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const moduleMenuRef = useRef<HTMLDivElement | null>(null);
  const backTarget = getBackTarget(location.pathname);
  const profilePath = currentPerson?.id ? `/people/${currentPerson.id}` : "/settings";
  const accountName = currentPerson?.display_name || displayName || user?.email || "Profile";
  const inTasksArea =
    location.pathname === "/tasks" ||
    location.pathname.startsWith("/tasks/") ||
    ["/inbox", "/projects", "/waiting", "/someday"].includes(location.pathname);

  useEffect(() => {
    if (!profileMenuOpen && !moduleMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (!profileMenuRef.current?.contains(target)) {
        setProfileMenuOpen(false);
      }

      if (!moduleMenuRef.current?.contains(target)) {
        setModuleMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setModuleMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen, moduleMenuOpen]);

  const moduleItems = [
    {
      title: "Tasks",
      description: "Capture and organize",
      to: "/tasks",
      icon: ListChecks,
    },
    {
      title: "Meetings",
      description: "Agendas and minutes",
      to: "/meetings",
      icon: CalendarDays,
    },
    {
      title: "Service Planner",
      description: "Services and teams",
      to: "/service-planner",
      icon: Music,
    },
    {
      title: "People",
      description: "Directory and groups",
      to: "/people",
      icon: Users,
    },
  ];
  const hexagonClipPath = "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  const moduleMenuEase = "cubic-bezier(0.16, 1, 0.3, 1)";

  const handleTourStepChange = useCallback((step: { selector: string } | null) => {
    if (!step) return;

    setModuleMenuOpen(step.selector === '[data-tour="module-menu"]');
    if (step.selector !== '[data-tour="account-menu"]') {
      setProfileMenuOpen(false);
    }
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar text-sidebar-foreground font-extrabold tracking-wider">
        ACT<span className="text-brand-teal-bright">SIX</span>
      </div>
    );

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-content">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex min-h-24 items-center gap-3 border-b border-border bg-background/80 px-3 py-3 pr-7 backdrop-blur sm:px-4 sm:pr-8 xl:pr-10">
            <SidebarTrigger />

            {backTarget && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-w-0 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => navigate(backTarget.to)}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden truncate sm:inline">{backTarget.label}</span>
              </Button>
            )}

            <div
              ref={moduleMenuRef}
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-20 w-[min(32rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2"
              onMouseEnter={() => setModuleMenuOpen(true)}
              onMouseLeave={() => setModuleMenuOpen(false)}
            >
              <button
                type="button"
                data-tour="module-menu"
                className="group pointer-events-auto absolute left-1/2 top-1/2 z-20 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none opacity-90 ring-brand-teal/25 transition-opacity hover:opacity-100 focus-visible:ring-4"
                onClick={() => {
                  setModuleMenuOpen(false);
                  navigate("/");
                }}
                onFocus={() => setModuleMenuOpen(true)}
                aria-label="Go home"
                aria-expanded={moduleMenuOpen}
              >
                <img
                  src={actsixIconWhite}
                  alt="ACTSIX"
                  className={`absolute h-20 w-20 object-contain brightness-0 transition-[filter,opacity,transform] duration-500 ${
                    moduleMenuOpen
                      ? "scale-[0.9] rotate-[-4deg] opacity-0 blur-[1px]"
                      : "scale-100 rotate-0 opacity-100 blur-0"
                  }`}
                  style={{ transitionTimingFunction: moduleMenuEase }}
                />
                <span
                  className={`absolute flex h-14 w-14 items-center justify-center border border-black bg-black text-white shadow-soft transition-[opacity,transform] duration-500 ${
                    moduleMenuOpen
                      ? "scale-100 rotate-0 opacity-100"
                      : "scale-[0.88] rotate-[4deg] opacity-0"
                  }`}
                  style={{
                    clipPath: hexagonClipPath,
                    transitionTimingFunction: moduleMenuEase,
                  }}
                >
                  <Home
                    className={`h-6 w-6 transition-[opacity,stroke-dashoffset,transform] duration-500 ${
                      moduleMenuOpen
                        ? "scale-100 opacity-100 [stroke-dashoffset:0]"
                        : "scale-90 opacity-0 [stroke-dashoffset:24]"
                    }`}
                    style={{
                      strokeDasharray: 24,
                      transitionTimingFunction: moduleMenuEase,
                    }}
                  />
                </span>
              </button>

              <div
                className={`absolute inset-0 transition-opacity duration-500 ${
                  moduleMenuOpen
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
                style={{ transitionTimingFunction: moduleMenuEase }}
                aria-hidden={!moduleMenuOpen}
              >
                <div className="relative h-full w-full">
                  {moduleItems.map((item, index) => {
                    const Icon = item.icon;
                    const foldPosition = index < 2 ? index - 2 : index - 1;
                    const distanceFromHome = Math.abs(foldPosition);
                    const openOffset =
                      foldPosition < 0
                        ? `clamp(-8.25rem, ${foldPosition * 4.5}rem, -4.5rem)`
                        : `clamp(4.5rem, ${foldPosition * 4.5}rem, 8.25rem)`;
                    const active =
                      location.pathname === item.to ||
                      location.pathname.startsWith(`${item.to}/`);

                    return (
                      <button
                        key={item.to}
                        type="button"
                        title={item.title}
                        className={`group absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center drop-shadow-sm transition-[opacity,transform] [transition-duration:560ms] ${
                          active
                            ? "text-brand-teal"
                            : "text-foreground hover:text-brand-teal"
                        }`}
                        style={{
                          opacity: moduleMenuOpen ? 1 : 0,
                          transform: moduleMenuOpen
                            ? `translate3d(calc(-50% + ${openOffset}), -50%, 0) scale(1)`
                            : "translate3d(-50%, -50%, 0) scale(0.84)",
                          transitionDelay: moduleMenuOpen
                            ? `${distanceFromHome * 45}ms`
                            : `${(3 - distanceFromHome) * 35}ms`,
                          transitionTimingFunction: moduleMenuEase,
                          willChange: "transform, opacity",
                        }}
                        aria-label={`Go to ${item.title}`}
                        onClick={() => {
                          setModuleMenuOpen(false);
                          navigate(item.to);
                        }}
                      >
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center border backdrop-blur transition group-hover:-translate-y-0.5 ${
                            active
                              ? "border-brand-teal/35 bg-brand-teal/15 text-brand-teal shadow-card"
                              : "border-border/75 bg-card/95 text-muted-foreground shadow-soft group-hover:border-brand-teal/35 group-hover:bg-brand-teal/10 group-hover:text-brand-teal"
                          }`}
                          style={{ clipPath: hexagonClipPath }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {inTasksArea && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  data-tour="quick-capture"
                  className="gap-1.5 rounded-full border-brand-teal/35 bg-brand-teal/10 px-3 font-bold text-brand-teal hover:bg-brand-teal/15 hover:text-brand-teal sm:px-4"
                >
                  <Link to="/tasks/inbox">
                    <Zap className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Quick Capture</span>
                  </Link>
                </Button>
              )}

              <div data-tour="notifications">
                <NotificationBell collapsed tone="topbar" />
              </div>

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  data-tour="account-menu"
                  className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-3 text-sm font-bold text-foreground shadow-soft outline-none ring-brand-teal/30 transition hover:border-brand-teal/35 hover:bg-brand-teal/5 focus-visible:ring-4"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  title="Open account menu"
                  aria-label="Open account menu"
                  aria-expanded={profileMenuOpen}
                >
                  <PersonAvatar
                    name={accountName}
                    avatarUrl={currentPerson?.avatar_url}
                    size="md"
                    className="ring-1 ring-border"
                  />
                  <span className="hidden max-w-36 truncate sm:inline">
                    {accountName}
                  </span>
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-12 z-[1000] w-56 overflow-hidden rounded-xl border border-border/70 bg-card text-foreground shadow-card">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-brand-teal/5 hover:text-brand-teal"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate(profilePath);
                      }}
                    >
                      <UserRound className="h-4 w-4" />
                      View Profile
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center gap-3 border-t border-border/70 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-brand-teal/5 hover:text-brand-teal"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate("/settings");
                      }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center gap-3 border-t border-border/70 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-brand-teal/5 hover:text-brand-teal"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        startGuidedTour();
                      }}
                    >
                      <HelpCircle className="h-4 w-4" />
                      Start Tutorial
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center gap-3 border-t border-border/70 px-3 py-2.5 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1">
            <Outlet />
          </main>

          <GuidedTour
            onStepChange={handleTourStepChange}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
