import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  },
  {
    title: "Sound Desk Basics",
    category: "Production / Tech",
    description:
      "Covers gain structure, channel management, basic EQ, muting, monitor sends, and Sunday sound desk workflow.",
    duration: "60 min",
    status: "Active",
    assigned: "4 people",
  },
  {
    title: "Bible Study Leader Training",
    category: "Leadership",
    description:
      "Helps group leaders prepare passages, ask good questions, facilitate discussion, and care for people wisely.",
    duration: "90 min",
    status: "Draft",
    assigned: "2 people",
  },
  {
    title: "Child Safety Training",
    category: "Safety & Compliance",
    description:
      "Covers child safety policy, sign-in procedures, safe ratios, reporting concerns, and annual renewal expectations.",
    duration: "40 min",
    status: "Active",
    assigned: "6 people",
  },
  {
    title: "Membership Class",
    category: "Membership",
    description:
      "Introduces church beliefs, vision, membership expectations, baptism, communion, serving, and next steps.",
    duration: "120 min",
    status: "Active",
    assigned: "10 people",
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

const TrainingCenter = () => {
  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Training Center"
        subtitle="Create, assign, and track ministry training resources."
        actions={
          <>
            <Button className="actsix-btn-primary gap-2">
              <Plus className="h-4 w-4" />
              New Course
            </Button>
            <Button variant="outline" className="actsix-btn-outline gap-2">
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

        <section className="grid gap-4 xl:grid-cols-2">
          {trainingResources.map((resource) => (
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
                <Button variant="outline" className="actsix-btn-outline flex-1">
                  View Course
                </Button>
                <Button className="actsix-btn-primary flex-1">
                  Assign
                </Button>
              </div>
            </Card>
          ))}
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
    </div>
  );
};

export default TrainingCenter;
