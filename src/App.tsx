import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import RecurringTasks from "./features/tasks/pages/RecurringTasksPage";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Inbox from "./pages/Inbox";
import { Waiting, Someday } from "./pages/SimpleList";
import WeeklyReview from "./features/tasks/pages/WeeklyReviewPage";
import Auth from "./pages/Auth";
import WorkspaceSetup from "./pages/WorkspaceSetup";
import NotFound from "./pages/NotFound.tsx";

// Everything outside the Tasks module (this app's priority surface) loads on
// demand, so a Tasks visit never pays for Sermon Hub, Training Center, or
// Service Planner's code. Tasks itself stays eager above.
const Meetings = lazy(() => import("./pages/Meetings"));
const ServicePlanner = lazy(() => import("./pages/ServicePlanner"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const ServicePlannerTeams = lazy(() => import("./pages/ServicePlannerTeams"));
const ServicePlannerTeamDetail = lazy(() => import("./pages/ServicePlannerTeamDetail"));
const ServicePlannerRepertoire = lazy(() => import("./pages/ServicePlannerRepertoire"));
const People = lazy(() => import("./pages/People"));
const PersonDetail = lazy(() => import("./pages/PersonDetail"));
const PeopleGroups = lazy(() => import("./pages/PeopleGroups"));
const PeopleGroupDetail = lazy(() => import("./pages/PeopleGroupDetail"));
const MeetingDetail = lazy(() => import("./pages/MeetingDetail"));
const RecurringMeetings = lazy(() => import("./pages/RecurringMeetings"));
const RecurringMeetingDetail = lazy(() => import("./pages/RecurringMeetingDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const AlphaFeedback = lazy(() => import("./pages/AlphaFeedback"));
const TrainingCenter = lazy(() => import("./pages/TrainingCenter"));
const SermonLessonHub = lazy(() => import("./pages/SermonLessonHub"));
const CalendarModule = lazy(() => import("./pages/CalendarModule"));
const Reminders = lazy(() => import("./pages/Reminders"));
const PublicEventRegistration = lazy(() => import("./pages/PublicEventRegistration"));
const Meetups = lazy(() => import("./pages/Placeholder").then((module) => ({ default: module.Meetups })));

const queryClient = new QueryClient();

const LegacyGroupRedirect = () => {
  const { groupId } = useParams();
  return <Navigate to={`/groups/${groupId}`} replace />;
};

const RouteFallback = () => (
  <div className="actsix-page-body pt-8">
    <div className="actsix-loading-state" role="status">
      Loading...
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/workspace-setup" element={<WorkspaceSetup />} />
              <Route path="/register/:token" element={<PublicEventRegistration />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />

                <Route path="/tasks" element={<Navigate to="/tasks/next" replace />} />
                <Route path="/tasks/next" element={<Tasks />} />
                <Route path="/tasks/projects" element={<Projects />} />
                <Route path="/tasks/projects/:projectId" element={<ProjectDetail />} />
                <Route path="/tasks/inbox" element={<Inbox />} />
                <Route path="/tasks/waiting" element={<Waiting />} />
                <Route path="/tasks/someday" element={<Someday />} />
                <Route path="/tasks/recurring" element={<RecurringTasks />} />
                <Route path="/tasks/review" element={<WeeklyReview />} />
                <Route path="/tasks/calendar" element={<Navigate to="/calendar" replace />} />
                <Route path="/tasks/meetups" element={<Meetups />} />

                <Route path="/projects" element={<Projects />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/waiting" element={<Waiting />} />
                <Route path="/someday" element={<Someday />} />
                <Route path="/recurring" element={<RecurringTasks />} />
                <Route path="/review" element={<WeeklyReview />} />
                <Route path="/meetups" element={<Meetups />} />
                <Route path="/meetings" element={<Meetings />} />
                <Route path="/service-planner" element={<ServicePlanner />} />
                <Route path="/service-planner/services" element={<ServicePlanner />} />
                <Route path="/service-planner/services/:serviceId" element={<ServiceDetail />} />
                <Route path="/service-planner/teams" element={<ServicePlannerTeams />} />
                <Route path="/service-planner/teams/:teamId" element={<ServicePlannerTeamDetail />} />
                <Route path="/service-planner/repertoire" element={<ServicePlannerRepertoire />} />
                <Route path="/people" element={<People />} />
                <Route path="/groups" element={<PeopleGroups />} />
                <Route path="/groups/:groupId" element={<PeopleGroupDetail />} />
                <Route path="/people/groups" element={<Navigate to="/groups" replace />} />
                <Route path="/people/groups/:groupId" element={<LegacyGroupRedirect />} />
                <Route path="/people/:personId" element={<PersonDetail />} />
                <Route path="/meetings/recurring" element={<RecurringMeetings />} />
                <Route path="/meetings/recurring/:seriesId" element={<RecurringMeetingDetail />} />
                <Route path="/meetings/:meetingId" element={<MeetingDetail />} />
                <Route path="/training" element={<TrainingCenter />} />
                <Route path="/training/folders/:folderId" element={<TrainingCenter />} />
                <Route path="/sermon-hub" element={<SermonLessonHub />} />
                <Route path="/calendar" element={<CalendarModule />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/workspace" element={<WorkspaceSettings />} />
                <Route path="/settings/alpha-feedback" element={<AlphaFeedback />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
