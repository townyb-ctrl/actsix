import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, Navigate, useLocation, useNavigate, Link } from "react-router-dom"; // <-- Added Link
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  HelpCircle,
  LogOut,
  Settings,
  UserRound,
  Zap,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { GuidedTour, hasGuidedTour, startGuidedTour } from "./GuidedTour";
import { FeedbackBubble } from "./FeedbackBubble";
import { QuickCaptureDialog } from "./QuickCaptureDialog";
import actsixLogo from "@/assets/actsix-logo.png";
import { Card } from "@/components/ui/card";
import { useUserSettings, type TourKey } from "@/hooks/useUserSettings";
import {
  type ActiveModuleKey,
  getModuleKeyForPath,
  isRequiredModule,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
} from "@/lib/modules";

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
  if (pathname.startsWith("/groups/")) {
    return { label: "Back to Groups", to: "/groups" };
  }
  if (pathname.startsWith("/training/folders/")) {
    return { label: "Back to Training", to: "/training" };
  }
  if (pathname.startsWith("/people/")) {
    return { label: "Back to People", to: "/people" };
  }
  if (pathname.startsWith("/tasks/projects/")) {
    return { label: "Back to Projects", to: "/tasks/projects" };
  }
  return null;
};

const ModuleActivationPrompt = ({
  moduleKey,
  activating,
  onActivate,
}: {
  moduleKey: ActiveModuleKey;
  activating: boolean;
  onActivate: () => void;
}) => (
  <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 xl:px-8 2xl:px-10">
    <Card className="actsix-panel-soft w-full max-w-xl p-5 text-center">
      <p className="label-eyebrow">Optional Module</p>
      <h1 className="mt-2 text-xl font-extrabold tracking-tight">
        Activate {MODULE_LABELS[moduleKey]}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {MODULE_DESCRIPTIONS[moduleKey]} Turn it on for your account when you are ready to use it.
      </p>
      <Button
        type="button"
        className="actsix-btn-primary mt-5 px-4"
        onClick={onActivate}
        disabled={activating}
      >
        {activating ? "Activating..." : `Activate ${MODULE_LABELS[moduleKey]}`}
      </Button>
    </Card>
  </main>
);

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { person: currentPerson, displayName } = useCurrentPerson();
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const {
    settings: userSettings,
    loading: userSettingsLoading,
    isModuleActive,
    setModuleActive,
    completeTour,
  } = useUserSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [activatingModule, setActivatingModule] = useState<ActiveModuleKey | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const startedToursRef = useRef<Set<TourKey>>(new Set());
  const backTarget = getBackTarget(location.pathname);
  const routeModuleKey = getModuleKeyForPath(location.pathname);
  const routeModuleActive = isModuleActive(routeModuleKey);
  const isHomeRoute = location.pathname === "/";
  const profilePath = currentPerson?.id ? `/people/${currentPerson.id}` : "/settings";
  const accountName = currentPerson?.display_name || displayName || user?.email || "Profile";

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const handleTourStepChange = useCallback((step: { selector: string } | null) => {
    if (!step) return;
    if (step.selector !== '[data-tour="account-menu"]') {
      setProfileMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (loading || userSettingsLoading || workspaceLoading || !user || !routeModuleActive) return;

    const tourKey = getModuleKeyForPath(location.pathname);
    if (tourKey === "home" && location.pathname !== "/") return;
    if (tourKey === "home" && !workspace) return;

    const isComplete =
      tourKey === "home"
        ? userSettings.onboarding.homeTourComplete
        : Boolean(userSettings.onboarding.completedModuleTours[tourKey]);

    if (isComplete || startedToursRef.current.has(tourKey)) return;

    const timer = window.setTimeout(() => {
      startedToursRef.current.add(tourKey);
      if (hasGuidedTour(tourKey)) {
        startGuidedTour(tourKey);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    loading,
    location.pathname,
    routeModuleActive,
    user,
    userSettings.onboarding.completedModuleTours,
    userSettings.onboarding.homeTourComplete,
    userSettingsLoading,
    workspace,
    workspaceLoading,
  ]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar text-sidebar-foreground font-extrabold tracking-wider">
        ACT<span className="text-brand-teal-bright">SIX</span>
      </div>
    );

  if (!user) return <Navigate to="/auth" replace />;

  if (workspaceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-content font-extrabold tracking-wider text-foreground">
        ACT<span className="text-brand-teal">SIX</span>
      </div>
    );
  }

  if (!workspace) return <Navigate to="/workspace-setup" replace state={{ from: location.pathname }} />;

  const activateRouteModule = async () => {
    setActivatingModule(routeModuleKey);
    await setModuleActive(routeModuleKey, true);
    startedToursRef.current.delete(routeModuleKey);
    setActivatingModule(null);
  };

  const showModuleActivation =
    !userSettingsLoading && !routeModuleActive && !isRequiredModule(routeModuleKey);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full overflow-x-hidden overscroll-none bg-gradient-sidebar md:flex">
        
        <div className="relative z-10 hidden md:flex">
          <AppSidebar />
        </div>

        <div className="relative z-20 flex min-h-screen min-w-0 flex-1 flex-col overscroll-none bg-[#fbfaf7] pb-[calc(7.6rem+env(safe-area-inset-bottom))] md:h-screen md:overflow-hidden md:rounded-tl-[2rem] md:pb-0">
          <header className="sticky top-0 z-10 flex min-h-11 items-center gap-2 border-b border-border/45 bg-[#fbfaf7]/90 px-4 py-1.5 backdrop-blur-xl sm:px-4 xl:px-6">
            
            {/* FULL TEXT LOGO IN HEADER (Mobile Only) */}
            <Link to="/" className="mr-1 flex shrink-0 items-center md:hidden">
              <img src={actsixLogo} alt="ACTSIX" className="h-9 w-auto object-contain brightness-0 dark:invert" />
            </Link>

            {backTarget && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 min-w-0 rounded-lg px-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(backTarget.to)}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden truncate sm:inline">{backTarget.label}</span>
              </Button>
            )}

            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                data-tour="quick-capture"
                className="hidden h-8 w-8 rounded-full border-brand-teal bg-brand-teal p-0 text-white shadow-sm hover:border-brand-teal-dark hover:bg-brand-teal-dark hover:text-white md:inline-flex"
                onClick={() => setQuickCaptureOpen(true)}
                title="Quick Capture"
                aria-label="Quick Capture"
              >
                <Zap className="h-[18px] w-[18px] shrink-0" />
              </Button>

              <div className="hidden md:block" data-tour="notifications">
                <NotificationBell collapsed tone="topbar" />
              </div>

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  data-tour="account-menu"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card p-0 text-foreground shadow-sm outline-none ring-brand-teal/30 transition hover:border-brand-teal/35 hover:bg-brand-teal/5 focus-visible:ring-4"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  title="Open account menu"
                  aria-label="Open account menu"
                  aria-expanded={profileMenuOpen}
                >
                  <PersonAvatar
                    name={accountName}
                    avatarUrl={currentPerson?.avatar_url}
                    size="sm"
                    className="ring-1 ring-border"
                  />
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-12 z-[1000] w-56 overflow-hidden rounded-xl border border-border/70 bg-background text-foreground shadow-md">
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
                        startGuidedTour(getModuleKeyForPath(location.pathname));
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

          {showModuleActivation ? (
            <ModuleActivationPrompt
              moduleKey={routeModuleKey}
              activating={activatingModule === routeModuleKey}
              onActivate={activateRouteModule}
            />
          ) : (
            <main className={`flex-1 overflow-y-auto overscroll-contain ${isHomeRoute ? "" : "md:px-4 xl:px-6 2xl:px-8"}`}>
              <Outlet />
            </main>
          )}

          <footer className="hidden min-h-12 items-center justify-center border-t border-border/45 bg-[#fbfaf7]/88 px-4 py-2 text-xs text-muted-foreground backdrop-blur md:flex sm:px-6 xl:px-8 2xl:px-10">
            <div className="flex items-center justify-center gap-3 text-center">
              <img src={actsixLogo} alt="ACTSIX" className="h-8 w-auto object-contain brightness-0" />
            </div>
          </footer>

          <GuidedTour
            onStepChange={handleTourStepChange}
            onComplete={completeTour}
          />
          <QuickCaptureDialog
            open={quickCaptureOpen}
            onOpenChange={setQuickCaptureOpen}
          />
          <FeedbackBubble />
        </div>
        
        <MobileBottomNav />

      </div>
    </SidebarProvider>
  );
}
