import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  Filter,
  GraduationCap,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TrainingResource = {
  title: string;
  category: string;
  description: string;
  duration: string;
  status: "Active" | "Draft";
  assigned: string;
  suggestedAudience: string;
  modules: string[];
};

type TrainingProgress = {
  course: string;
  progress: number;
  status: "In Progress" | "Complete" | "Not Started";
  dueDate: string;
};

const summaryCards = [
  { label: "Total Courses", value: "5", icon: BookOpen },
  { label: "Assigned Training", value: "18", icon: ClipboardCheck },
  { label: "In Progress", value: "7", icon: Clock3 },
  { label: "Completed", value: "11", icon: CheckCircle2 },
];

const trainingResources: TrainingResource[] = [
  {
    title: "Worship Team Onboarding",
    category: "Worship Ministry",
    description:
      "Introduces new worship team members to the ministry vision, expectations, rehearsal culture, and Sunday serving rhythm.",
    duration: "45 min",
    status: "Active",
    assigned: "8 people",
    suggestedAudience: "New worship team members, vocalists, musicians",
    modules: ["Ministry vision", "Rehearsal rhythm", "Sunday expectations"],
  },
  {
    title: "Sound Desk Basics",
    category: "Production / Tech",
    description:
      "Covers gain structure, channel management, basic EQ, muting, monitor sends, and Sunday sound desk workflow.",
    duration: "60 min",
    status: "Active",
    assigned: "4 people",
    suggestedAudience: "Production volunteers and new sound operators",
    modules: ["Signal flow", "EQ basics", "Sunday desk workflow"],
  },
  {
    title: "Bible Study Leader Training",
    category: "Leadership",
    description:
      "Helps group leaders prepare passages, ask good questions, facilitate discussion, and care for people wisely.",
    duration: "90 min",
    status: "Draft",
    assigned: "2 people",
    suggestedAudience: "Small group leaders and ministry coaches",
    modules: ["Passage preparation", "Good questions", "Pastoral care"],
  },
  {
    title: "Child Safety Training",
    category: "Safety & Compliance",
    description:
      "Covers child safety policy, sign-in procedures, safe ratios, reporting concerns, and annual renewal expectations.",
    duration: "40 min",
    status: "Active",
    assigned: "6 people",
    suggestedAudience: "Kids ministry volunteers and team leaders",
    modules: ["Policy overview", "Safe ratios", "Reporting concerns"],
  },
  {
    title: "Membership Class",
    category: "Membership",
    description:
      "Introduces church beliefs, vision, membership expectations, baptism, communion, serving, and next steps.",
    duration: "120 min",
    status: "Active",
    assigned: "10 people",
    suggestedAudience: "Prospective members and newcomers",
    modules: ["Church vision", "Beliefs and practices", "Next steps"],
  },
];

const trainingProgress: TrainingProgress[] = [
  {
    course: "Worship Team Onboarding",
    progress: 60,
    status: "In Progress",
    dueDate: "30 Jun 2026",
  },
  {
    course: "Child Safety Training",
    progress: 100,
    status: "Complete",
    dueDate: "Complete",
  },
  {
    course: "Bible Study Leader Training",
    progress: 0,
    status: "Not Started",
    dueDate: "15 Jul 2026",
  },
  {
    course: "Sound Desk Basics",
    progress: 25,
    status: "In Progress",
    dueDate: "7 Jul 2026",
  },
];

const statusBadgeClass = (status: TrainingResource["status"] | TrainingProgress["status"]) => {
  if (status === "Active" || status === "Complete") {
    return "border-brand-sage/25 bg-brand-sage/10 text-brand-sage";
  }

  if (status === "Draft" || status === "Not Started") {
    return "border-brand-amber/25 bg-brand-amber/10 text-brand-amber";
  }

  return "border-brand-teal/25 bg-brand-teal/10 text-brand-teal";
};

type PanelMode = "course" | "assign" | "new";

const TrainingCenter = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedResource, setSelectedResource] = useState<TrainingResource | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("course");
  const [panelOpen, setPanelOpen] = useState(false);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(trainingResources.map((resource) => resource.category))).sort()],
    []
  );

  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase();

    return trainingResources.filter((resource) => {
      const matchesSearch =
        !query ||
        resource.title.toLowerCase().includes(query) ||
        resource.category.toLowerCase().includes(query) ||
        resource.description.toLowerCase().includes(query);

      const matchesCategory = categoryFilter === "All" || resource.category === categoryFilter;
      const matchesStatus = statusFilter === "All" || resource.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, search, statusFilter]);

  const openPanel = (mode: PanelMode, resource?: TrainingResource) => {
    setPanelMode(mode);
    setSelectedResource(resource ?? null);
    setPanelOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Training Center"
        subtitle="Create, assign, and track ministry training resources."
        actions={
          <>
            <Button className="actsix-btn-primary gap-2" onClick={() => openPanel("new")}>
              <Plus className="h-4 w-4" />
              New Course
            </Button>
            <Button
              variant="outline"
              className="actsix-btn-outline gap-2"
              onClick={() => openPanel("assign")}
            >
              <Send className="h-4 w-4" />
              Assign Training
            </Button>
          </>
        }
      />

      <div className="actsix-page-body actsix-page-stack pt-5 pb-12 sm:pt-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="actsix-panel-soft border-border/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="label-eyebrow">{item.label}</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                      {item.value}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </Card>
            );
          })}
        </section>

        <Card className="actsix-panel-soft border-border/60 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search training resources..."
                className="h-11 rounded-xl border-border/70 bg-background pl-10 shadow-soft"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:w-[26rem]">
              <label className="relative">
                <span className="sr-only">Filter by category</span>
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border/70 bg-background px-9 text-sm font-semibold shadow-soft outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="sr-only">Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold shadow-soft outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Draft</option>
                </select>
              </label>
            </div>
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          {filteredResources.map((resource) => (
            <Card
              key={resource.title}
              className="actsix-panel-soft flex flex-col border-border/60 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                    {resource.title}
                  </h2>
                  <Badge
                    variant="outline"
                    className="mt-2 border-brand-teal/25 bg-brand-teal/10 text-brand-teal"
                  >
                    {resource.category}
                  </Badge>
                </div>

                <Badge variant="outline" className={cn("w-fit", statusBadgeClass(resource.status))}>
                  {resource.status}
                </Badge>
              </div>

              <p className="mt-4 flex-1 text-sm font-medium leading-6 text-muted-foreground">
                {resource.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {resource.duration}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                  <Users className="h-3.5 w-3.5" />
                  {resource.assigned}
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="actsix-btn-outline flex-1"
                  onClick={() => openPanel("course", resource)}
                >
                  <Eye className="h-4 w-4" />
                  View Course
                </Button>
                <Button className="actsix-btn-primary flex-1" onClick={() => openPanel("assign", resource)}>
                  Assign
                </Button>
              </div>
            </Card>
          ))}

          {filteredResources.length === 0 && (
            <Card className="actsix-panel-soft border-border/60 p-8 text-center xl:col-span-2">
              <p className="text-lg font-extrabold">No training resources found</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Adjust your filters or search phrase to bring resources back into view.
              </p>
            </Card>
          )}
        </section>

        <Card className="actsix-panel-soft overflow-hidden border-border/60">
          <div className="border-b border-border/70 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <p className="label-eyebrow">Overview</p>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Training Progress Overview
                </h2>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainingProgress.map((item) => (
                <TableRow key={item.course}>
                  <TableCell className="font-extrabold">{item.course}</TableCell>
                  <TableCell>
                    <div className="flex min-w-[8rem] items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand-teal"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-extrabold tabular-nums text-muted-foreground">
                        {item.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-muted-foreground">
                    {item.dueDate}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent className="flex w-[min(100vw,34rem)] flex-col overflow-y-auto sm:max-w-[34rem]">
          <SheetHeader className="pr-8 text-left">
            <p className="label-eyebrow">
              {panelMode === "new" ? "Course Builder" : panelMode === "assign" ? "Assignment" : "Course"}
            </p>
            <SheetTitle className="text-2xl font-extrabold tracking-tight">
              {panelMode === "new"
                ? "Plan a new course"
                : selectedResource?.title || "Assign training"}
            </SheetTitle>
            <SheetDescription>
              {panelMode === "new"
                ? "Draft the course shape before adding lessons, files, or automations."
                : panelMode === "assign"
                  ? "Choose who should receive this training when the live feature is connected."
                  : selectedResource?.description}
            </SheetDescription>
          </SheetHeader>

          {panelMode === "course" && selectedResource && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
                  {selectedResource.category}
                </Badge>
                <Badge variant="outline" className={statusBadgeClass(selectedResource.status)}>
                  {selectedResource.status}
                </Badge>
              </div>

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Suggested Audience</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {selectedResource.suggestedAudience}
                </p>
              </Card>

              <div>
                <p className="label-eyebrow">Course Outline</p>
                <div className="mt-3 space-y-2">
                  {selectedResource.modules.map((module, index) => (
                    <div
                      key={module}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-teal/10 text-xs font-extrabold text-brand-teal">
                        {index + 1}
                      </span>
                      <span className="text-sm font-extrabold">{module}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="border-border/60 bg-background p-4">
                  <p className="label-eyebrow">Duration</p>
                  <p className="mt-2 text-xl font-extrabold">{selectedResource.duration}</p>
                </Card>
                <Card className="border-border/60 bg-background p-4">
                  <p className="label-eyebrow">Assigned</p>
                  <p className="mt-2 text-xl font-extrabold">{selectedResource.assigned}</p>
                </Card>
              </div>
            </div>
          )}

          {panelMode === "assign" && (
            <div className="mt-6 space-y-5">
              <Card className="border-brand-teal/25 bg-brand-teal/5 p-4">
                <p className="label-eyebrow text-brand-teal">Selected Course</p>
                <p className="mt-2 text-lg font-extrabold">
                  {selectedResource?.title || "Choose from the course catalog"}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Assignment controls will connect to People and training records later.
                </p>
              </Card>

              {["Worship Team", "Production Team", "Small Group Leaders", "Kids Ministry"].map((team) => (
                <label
                  key={team}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-3"
                >
                  <span className="font-bold">{team}</span>
                  <input type="checkbox" className="h-4 w-4 accent-brand-teal" />
                </label>
              ))}

              <Button className="actsix-btn-primary w-full">
                Preview Assignment
              </Button>
            </div>
          )}

          {panelMode === "new" && (
            <div className="mt-6 space-y-5">
              {["Course name", "Category", "Estimated duration", "Required renewal"].map((field) => (
                <label key={field} className="block">
                  <span className="label-eyebrow">{field}</span>
                  <Input className="mt-2 h-11 rounded-xl border-border/70 bg-background" />
                </label>
              ))}

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Readiness</p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={35} className="h-2" />
                  <span className="text-xs font-extrabold text-muted-foreground">35%</span>
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  This is a planning placeholder. Lessons, files, quizzes, and assignments can be added in the next feature pass.
                </p>
              </Card>

              <Button className="actsix-btn-primary w-full">
                Save Draft Outline
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TrainingCenter;
