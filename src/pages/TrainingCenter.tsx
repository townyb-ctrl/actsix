import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
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
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TrainingCourse = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  category: string;
  description: string;
  estimated_minutes: number;
  status: "Active" | "Draft" | "Archived";
  suggested_audience: string;
  modules: string[];
  created_at: string;
  updated_at: string;
};

type TrainingAssignment = {
  id: string;
  workspace_id: string;
  course_id: string;
  person_id: string;
  assigned_by: string;
  status: "Not Started" | "In Progress" | "Complete";
  progress: number;
  due_date: string | null;
  completed_at: string | null;
};

type PersonOption = {
  id: string;
  display_name: string;
  email?: string | null;
};

type PanelMode = "course" | "assign" | "new";

const emptyCourseForm = {
  title: "",
  category: "",
  description: "",
  estimatedMinutes: "45",
  status: "Active" as TrainingCourse["status"],
  suggestedAudience: "",
  modulesText: "",
};

const statusBadgeClass = (
  status: TrainingCourse["status"] | TrainingAssignment["status"]
) => {
  if (status === "Active" || status === "Complete") {
    return "border-brand-sage/25 bg-brand-sage/10 text-brand-sage";
  }

  if (status === "Draft" || status === "Not Started") {
    return "border-brand-amber/25 bg-brand-amber/10 text-brand-amber";
  }

  return "border-brand-teal/25 bg-brand-teal/10 text-brand-teal";
};

const formatDueDate = (value?: string | null) => {
  if (!value) return "No due date";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getProgressStatus = (progress: number): TrainingAssignment["status"] => {
  if (progress >= 100) return "Complete";
  if (progress > 0) return "In Progress";
  return "Not Started";
};

const TrainingCenter = () => {
  const { user } = useAuth();
  const { workspace, role } = useCurrentWorkspace();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [panelMode, setPanelMode] = useState<PanelMode>("course");
  const [panelOpen, setPanelOpen] = useState(false);

  const canManageTraining = ["admin", "editor", "group_leader"].includes(role || "");

  const loadTraining = async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [courseResult, assignmentResult, peopleResult] = await Promise.all([
      (supabase as any)
        .from("training_courses")
        .select("*")
        .eq("workspace_id", workspace.id)
        .neq("status", "Archived")
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("training_assignments")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("people")
        .select("id, display_name, email")
        .eq("workspace_id", workspace.id)
        .order("display_name", { ascending: true }),
    ]);

    if (courseResult.error) toast.error(courseResult.error.message);
    if (assignmentResult.error) toast.error(assignmentResult.error.message);
    if (peopleResult.error) toast.error(peopleResult.error.message);

    setCourses(courseResult.data ?? []);
    setAssignments(assignmentResult.data ?? []);
    setPeople(peopleResult.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadTraining();
  }, [workspace?.id]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(courses.map((course) => course.category))).sort()],
    [courses]
  );

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.category.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query);

      const matchesCategory = categoryFilter === "All" || course.category === categoryFilter;
      const matchesStatus = statusFilter === "All" || course.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, courses, search, statusFilter]);

  const assignmentCountByCourse = useMemo(() => {
    return assignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.course_id] = (acc[assignment.course_id] || 0) + 1;
      return acc;
    }, {});
  }, [assignments]);

  const progressRows = useMemo(() => {
    return courses.map((course) => {
      const courseAssignments = assignments.filter((assignment) => assignment.course_id === course.id);
      const progress =
        courseAssignments.length === 0
          ? 0
          : Math.round(
              courseAssignments.reduce((sum, assignment) => sum + assignment.progress, 0) /
                courseAssignments.length
            );
      const status = getProgressStatus(progress);
      const dueDate =
        status === "Complete"
          ? "Complete"
          : formatDueDate(
              courseAssignments
                .map((assignment) => assignment.due_date)
                .filter(Boolean)
                .sort()[0]
            );

      return { course: course.title, progress, status, dueDate };
    });
  }, [assignments, courses]);

  const summaryCards = [
    { label: "Total Courses", value: String(courses.length), icon: BookOpen },
    { label: "Assigned Training", value: String(assignments.length), icon: ClipboardCheck },
    {
      label: "In Progress",
      value: String(assignments.filter((assignment) => assignment.status === "In Progress").length),
      icon: Clock3,
    },
    {
      label: "Completed",
      value: String(assignments.filter((assignment) => assignment.status === "Complete").length),
      icon: CheckCircle2,
    },
  ];

  const openPanel = (mode: PanelMode, course?: TrainingCourse) => {
    setPanelMode(mode);
    setSelectedCourse(course ?? null);
    setSelectedCourseId(course?.id || courses[0]?.id || "");
    setSelectedPersonIds([]);
    setAssignmentDueDate("");
    setPanelOpen(true);
  };

  const createCourse = async () => {
    if (!workspace?.id || !user?.id) return;
    if (!courseForm.title.trim()) {
      toast.error("Add a course name first.");
      return;
    }

    setSaving(true);

    const { error } = await (supabase as any).from("training_courses").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      title: courseForm.title.trim(),
      category: courseForm.category.trim() || "General",
      description: courseForm.description.trim(),
      estimated_minutes: Number(courseForm.estimatedMinutes) || 30,
      status: courseForm.status,
      suggested_audience: courseForm.suggestedAudience.trim(),
      modules: courseForm.modulesText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Training course created");
    setCourseForm(emptyCourseForm);
    setPanelOpen(false);
    loadTraining();
  };

  const assignTraining = async () => {
    if (!workspace?.id || !user?.id || !selectedCourseId) return;
    if (selectedPersonIds.length === 0) {
      toast.error("Select at least one person.");
      return;
    }

    setSaving(true);

    const payload = selectedPersonIds.map((personId) => ({
      workspace_id: workspace.id,
      course_id: selectedCourseId,
      person_id: personId,
      assigned_by: user.id,
      status: "Not Started",
      progress: 0,
      due_date: assignmentDueDate || null,
    }));

    const { error } = await (supabase as any)
      .from("training_assignments")
      .upsert(payload, { onConflict: "course_id,person_id" });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Training assigned");
    setPanelOpen(false);
    loadTraining();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Training Center"
        subtitle="Create, assign, and track ministry training resources."
        actions={
          <>
            <Button
              className="actsix-btn-primary gap-2"
              onClick={() => openPanel("new")}
              disabled={!canManageTraining}
            >
              <Plus className="h-4 w-4" />
              New Course
            </Button>
            <Button
              variant="outline"
              className="actsix-btn-outline gap-2"
              onClick={() => openPanel("assign")}
              disabled={!canManageTraining || courses.length === 0}
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
                      {loading ? "..." : item.value}
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
          {loading && (
            <Card className="actsix-loading-state xl:col-span-2" role="status">
              Loading training center...
            </Card>
          )}

          {!loading &&
            filteredCourses.map((course) => (
              <Card
                key={course.id}
                className="actsix-panel-soft flex flex-col border-border/60 p-5 sm:p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                      {course.title}
                    </h2>
                    <Badge
                      variant="outline"
                      className="mt-2 border-brand-teal/25 bg-brand-teal/10 text-brand-teal"
                    >
                      {course.category}
                    </Badge>
                  </div>

                  <Badge variant="outline" className={cn("w-fit", statusBadgeClass(course.status))}>
                    {course.status}
                  </Badge>
                </div>

                <p className="mt-4 flex-1 text-sm font-medium leading-6 text-muted-foreground">
                  {course.description || "No course description yet."}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {course.estimated_minutes} min
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                    <Users className="h-3.5 w-3.5" />
                    {assignmentCountByCourse[course.id] || 0} assigned
                  </span>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="actsix-btn-outline flex-1"
                    onClick={() => openPanel("course", course)}
                  >
                    <Eye className="h-4 w-4" />
                    View Course
                  </Button>
                  <Button
                    className="actsix-btn-primary flex-1"
                    onClick={() => openPanel("assign", course)}
                    disabled={!canManageTraining}
                  >
                    Assign
                  </Button>
                </div>
              </Card>
            ))}

          {!loading && filteredCourses.length === 0 && (
            <Card className="actsix-panel-soft border-border/60 p-8 text-center xl:col-span-2">
              <p className="text-lg font-extrabold">No training resources found</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Adjust your filters or create the first training course for this workspace.
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
              {progressRows.map((item) => (
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
                ? "Create a new course"
                : panelMode === "assign"
                  ? "Assign training"
                  : selectedCourse?.title || "Course"}
            </SheetTitle>
            <SheetDescription>
              {panelMode === "new"
                ? "Create a workspace training resource that can be assigned to people."
                : panelMode === "assign"
                  ? "Choose the course, people, and optional due date."
                  : selectedCourse?.description}
            </SheetDescription>
          </SheetHeader>

          {panelMode === "course" && selectedCourse && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
                  {selectedCourse.category}
                </Badge>
                <Badge variant="outline" className={statusBadgeClass(selectedCourse.status)}>
                  {selectedCourse.status}
                </Badge>
              </div>

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Suggested Audience</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {selectedCourse.suggested_audience || "No audience guidance added yet."}
                </p>
              </Card>

              <div>
                <p className="label-eyebrow">Course Outline</p>
                <div className="mt-3 space-y-2">
                  {(selectedCourse.modules || []).length === 0 && (
                    <p className="text-sm font-medium text-muted-foreground">
                      No outline items added yet.
                    </p>
                  )}
                  {(selectedCourse.modules || []).map((module, index) => (
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
                  <p className="mt-2 text-xl font-extrabold">{selectedCourse.estimated_minutes} min</p>
                </Card>
                <Card className="border-border/60 bg-background p-4">
                  <p className="label-eyebrow">Assigned</p>
                  <p className="mt-2 text-xl font-extrabold">
                    {assignmentCountByCourse[selectedCourse.id] || 0}
                  </p>
                </Card>
              </div>
            </div>
          )}

          {panelMode === "assign" && (
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="label-eyebrow">Course</span>
                <select
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label-eyebrow">Due Date</span>
                <Input
                  type="date"
                  value={assignmentDueDate}
                  onChange={(event) => setAssignmentDueDate(event.target.value)}
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                />
              </label>

              <div>
                <p className="label-eyebrow">People</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {people.length === 0 && (
                    <p className="text-sm font-medium text-muted-foreground">
                      Add People profiles before assigning training.
                    </p>
                  )}

                  {people.map((person) => (
                    <label
                      key={person.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{person.display_name}</span>
                        {person.email && (
                          <span className="block truncate text-xs font-medium text-muted-foreground">
                            {person.email}
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedPersonIds.includes(person.id)}
                        onChange={(event) => {
                          setSelectedPersonIds((current) =>
                            event.target.checked
                              ? [...current, person.id]
                              : current.filter((id) => id !== person.id)
                          );
                        }}
                        className="h-4 w-4 accent-brand-teal"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <Button
                className="actsix-btn-primary w-full"
                onClick={assignTraining}
                disabled={saving || !canManageTraining || !selectedCourseId}
              >
                {saving ? "Assigning..." : "Assign Training"}
              </Button>
            </div>
          )}

          {panelMode === "new" && (
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="label-eyebrow">Course name</span>
                <Input
                  value={courseForm.title}
                  onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label-eyebrow">Category</span>
                  <Input
                    value={courseForm.category}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, category: event.target.value }))
                    }
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                  />
                </label>

                <label className="block">
                  <span className="label-eyebrow">Estimated minutes</span>
                  <Input
                    type="number"
                    min={1}
                    value={courseForm.estimatedMinutes}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, estimatedMinutes: event.target.value }))
                    }
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                  />
                </label>
              </div>

              <label className="block">
                <span className="label-eyebrow">Status</span>
                <select
                  value={courseForm.status}
                  onChange={(event) =>
                    setCourseForm((current) => ({
                      ...current,
                      status: event.target.value as TrainingCourse["status"],
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                >
                  <option>Active</option>
                  <option>Draft</option>
                </select>
              </label>

              <label className="block">
                <span className="label-eyebrow">Description</span>
                <textarea
                  value={courseForm.description}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm font-medium outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </label>

              <label className="block">
                <span className="label-eyebrow">Suggested audience</span>
                <Input
                  value={courseForm.suggestedAudience}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, suggestedAudience: event.target.value }))
                  }
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                />
              </label>

              <label className="block">
                <span className="label-eyebrow">Outline items</span>
                <textarea
                  value={courseForm.modulesText}
                  onChange={(event) =>
                    setCourseForm((current) => ({ ...current, modulesText: event.target.value }))
                  }
                  rows={4}
                  placeholder="One outline item per line"
                  className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm font-medium outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </label>

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Readiness</p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={courseForm.title.trim() ? 65 : 25} className="h-2" />
                  <span className="text-xs font-extrabold text-muted-foreground">
                    {courseForm.title.trim() ? "65%" : "25%"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  Lessons, files, quizzes, and renewal rules can build on this course record later.
                </p>
              </Card>

              <Button
                className="actsix-btn-primary w-full"
                onClick={createCourse}
                disabled={saving || !canManageTraining}
              >
                {saving ? "Saving..." : "Save Course"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TrainingCenter;
