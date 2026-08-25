import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { lazy } from "react";
import { describe, expect, it, vi } from "vitest";

import AppLayout from "./AppLayout";

// The shell pulls in the whole app. None of it is what this test is about — the
// only question here is which subtree React tears down while a route chunk is
// still in flight.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "a@b.c" }, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/hooks/useCurrentPerson", () => ({
  useCurrentPerson: () => ({ person: null, displayName: "Tester" }),
}));
vi.mock("@/hooks/useCurrentWorkspace", () => ({
  useCurrentWorkspace: () => ({ workspace: { id: "workspace-1" }, loading: false }),
}));
vi.mock("@/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    settings: { onboarding: { homeTourComplete: true, completedModuleTours: {} } },
    loading: false,
    isModuleActive: () => true,
    setModuleActive: vi.fn(),
    completeTour: vi.fn(),
  }),
}));
vi.mock("./AppSidebar", () => ({
  AppSidebar: () => <nav aria-label="Main">Sidebar</nav>,
}));
vi.mock("./MobileBottomNav", () => ({ MobileBottomNav: () => null }));
vi.mock("./NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("./GuidedTour", () => ({
  GuidedTour: () => null,
  hasGuidedTour: () => false,
  startGuidedTour: vi.fn(),
}));
vi.mock("./FeedbackBubble", () => ({ FeedbackBubble: () => null }));
vi.mock("./QuickCaptureDialog", () => ({ QuickCaptureDialog: () => null }));
vi.mock("@/components/people/PersonAvatar", () => ({ PersonAvatar: () => null }));

/** A route chunk that never arrives, so the layout stays suspended. */
const NeverLoads = lazy(() => new Promise<never>(() => {}));

describe("AppLayout", () => {
  it("keeps the shell mounted while a lazy route is still loading", () => {
    render(
      <MemoryRouter initialEntries={["/anywhere"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/anywhere" element={<NeverLoads />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // The whole point: the fallback is showing, and the rail is still there
    // behind it. With the only Suspense boundary above this layout, React threw
    // the shell away to render the fallback and the viewport went blank between
    // every module.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
