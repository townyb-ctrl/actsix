import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import TasksDashboard from "./pages/TasksDashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Inbox from "./pages/Inbox";
import { Waiting, Someday } from "./pages/SimpleList";
import Meetings from "./pages/Meetings";
import ServicePlanner from "./pages/ServicePlanner";
import ServiceDetail from "./pages/ServiceDetail";
import ServicePlannerTeams from "./pages/ServicePlannerTeams";
import ServicePlannerTeamDetail from "./pages/ServicePlannerTeamDetail";
import ServicePlannerRepertoire from "./pages/ServicePlannerRepertoire";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import PeopleGroups from "./pages/PeopleGroups";
import PeopleGroupDetail from "./pages/PeopleGroupDetail";
import MeetingDetail from "./pages/MeetingDetail";
import RecurringMeetings from "./pages/RecurringMeetings";
import RecurringMeetingDetail from "./pages/RecurringMeetingDetail";
import Settings from "./pages/Settings";
import { Recurring, Review, Calendar, Meetups } from "./pages/Placeholder";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />

              <Route path="/tasks" element={<TasksDashboard />} />
              <Route path="/tasks/next" element={<Tasks />} />
              <Route path="/tasks/projects" element={<Projects />} />
              <Route path="/tasks/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/tasks/inbox" element={<Inbox />} />
              <Route path="/tasks/waiting" element={<Waiting />} />
              <Route path="/tasks/someday" element={<Someday />} />
              <Route path="/tasks/recurring" element={<Recurring />} />
              <Route path="/tasks/review" element={<Review />} />
              <Route path="/tasks/calendar" element={<Calendar />} />
              <Route path="/tasks/meetups" element={<Meetups />} />

              <Route path="/projects" element={<Projects />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/waiting" element={<Waiting />} />
              <Route path="/someday" element={<Someday />} />
              <Route path="/recurring" element={<Recurring />} />
              <Route path="/review" element={<Review />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/meetups" element={<Meetups />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/service-planner" element={<ServicePlanner />} />
              <Route path="/service-planner/services" element={<ServicePlanner />} />
              <Route path="/service-planner/services/:serviceId" element={<ServiceDetail />} />
              <Route path="/service-planner/teams" element={<ServicePlannerTeams />} />
              <Route path="/service-planner/teams/:teamId" element={<ServicePlannerTeamDetail />} />
              <Route path="/service-planner/repertoire" element={<ServicePlannerRepertoire />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/groups" element={<PeopleGroups />} />
              <Route path="/people/groups/:groupId" element={<PeopleGroupDetail />} />
              <Route path="/people/:personId" element={<PersonDetail />} />
              <Route path="/meetings/recurring" element={<RecurringMeetings />} />
              <Route path="/meetings/recurring/:seriesId" element={<RecurringMeetingDetail />} />
              <Route path="/meetings/:meetingId" element={<MeetingDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
