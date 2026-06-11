import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Camera,
  Clock3,
  Eye,
  Filter,
  Folder,
  FolderPlus,
  GraduationCap,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { createNotification, createNotificationForPerson } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type TrainingCourse = {
  id: string;
  workspace_id: string;
  user_id: string;
  section_id: string | null;
  title: string;
  category: string;
  cover_image_url: string;
  description: string;
  estimated_minutes: number;
  status: "Active" | "Draft" | "Archived";
  suggested_audience: string;
  modules: string[];
  created_at: string;
  updated_at: string;
};

type TrainingSection = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description: string;
  position: number;
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
  created_at: string;
  updated_at: string;
};

type TrainingLesson = {
  id: string;
  workspace_id: string;
  course_id: string;
  title: string;
  content: string;
  media_items: LessonMediaItem[];
  position: number;
  created_at: string;
  updated_at: string;
};

type TrainingLessonProgress = {
  id: string;
  workspace_id: string;
  assignment_id: string;
  lesson_id: string;
  person_id: string;
  completed_at: string;
  created_at: string;
};

type CourseLessonForm = {
  id?: string;
  tempId: string;
  title: string;
  content: string;
  mediaItems: LessonMediaItem[];
  position: number;
};

type LessonMediaItem = {
  id: string;
  type: "video" | "image";
  title: string;
  url: string;
};

type PersonOption = {
  id: string;
  display_name: string;
  email?: string | null;
};

type PanelMode = "course" | "assign" | "new" | "edit" | "section";
type TrainingAdminView = "library" | "progress" | "activity";

const emptyCourseForm = {
  title: "",
  category: "",
  coverImageUrl: "",
  description: "",
  estimatedMinutes: "45",
  sectionId: "",
  status: "Active" as TrainingCourse["status"],
  suggestedAudience: "",
};

const createLessonForm = (
  position: number,
  lesson?: Partial<TrainingLesson>
): CourseLessonForm => ({
  id: lesson?.id,
  tempId: lesson?.id || `lesson-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: lesson?.title || "",
  content: lesson?.content || "",
  mediaItems: Array.isArray(lesson?.media_items) ? lesson.media_items : [],
  position,
});

const createMediaItem = (type: LessonMediaItem["type"]): LessonMediaItem => ({
  id: `media-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  title: "",
  url: "",
});

const getLessonReadTime = (content: string, mediaItems: LessonMediaItem[] = []) => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 180) + mediaItems.length);
};

const getVideoEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }

    if (parsed.hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }
  } catch {
    return url;
  }

  return url;
};

const LessonMediaList = ({ mediaItems }: { mediaItems: LessonMediaItem[] }) => {
  const visibleItems = mediaItems.filter((item) => item.url.trim());

  if (visibleItems.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {visibleItems.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border border-border/70 bg-background">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            {item.type === "video" ? (
              <Video className="h-4 w-4 text-brand-teal" />
            ) : (
              <ImageIcon className="h-4 w-4 text-brand-teal" />
            )}
            <p className="truncate text-sm font-extrabold">
              {item.title || (item.type === "video" ? "Video" : "Image")}
            </p>
          </div>

          {item.type === "video" ? (
            <div className="aspect-video bg-muted">
              <iframe
                src={getVideoEmbedUrl(item.url)}
                title={item.title || "Lesson video"}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <img
              src={item.url}
              alt={item.title || "Lesson image"}
              className="max-h-[26rem] w-full object-contain bg-muted"
              loading="lazy"
            />
          )}
        </div>
      ))}
    </div>
  );
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

const formatActivityTime = (value?: string | null) => {
  if (!value) return "No recent update";

  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTrainingDueState = (
  dueDate?: string | null,
  status?: TrainingAssignment["status"]
) => {
  if (status === "Complete") return "complete";
  if (!dueDate) return "none";

  const today = getLocalDateKey();
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);
  const soonKey = getLocalDateKey(soon);

  if (dueDate < today) return "overdue";
  if (dueDate <= soonKey) return "due-soon";
  return "scheduled";
};

const dueStateBadge = (state: ReturnType<typeof getTrainingDueState>) => {
  if (state === "overdue") {
    return {
      label: "Overdue",
      className: "border-destructive/25 bg-destructive/10 text-destructive",
    };
  }

  if (state === "due-soon") {
    return {
      label: "Due Soon",
      className: "border-brand-amber/25 bg-brand-amber/10 text-brand-amber",
    };
  }

  if (state === "complete") {
    return {
      label: "Complete",
      className: "border-brand-sage/25 bg-brand-sage/10 text-brand-sage",
    };
  }

  return {
    label: "Scheduled",
    className: "border-border bg-background text-muted-foreground",
  };
};

const getProgressStatus = (progress: number): TrainingAssignment["status"] => {
  if (progress >= 100) return "Complete";
  if (progress > 0) return "In Progress";
  return "Not Started";
};

const TrainingCenter = () => {
  const { folderId } = useParams<{ folderId?: string }>();
  const [searchParams] = useSearchParams();
  const selectedFolderId = folderId || searchParams.get("folder") || "";
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { workspace, role } = useCurrentWorkspace();
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [sections, setSections] = useState<TrainingSection[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [lessonProgress, setLessonProgress] = useState<TrainingLessonProgress[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [newSectionName, setNewSectionName] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<TrainingCourse | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<TrainingAssignment | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [courseLessons, setCourseLessons] = useState<CourseLessonForm[]>([
    createLessonForm(0),
  ]);
  const [previewLessonId, setPreviewLessonId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("course");
  const [panelOpen, setPanelOpen] = useState(false);
  const [adminView, setAdminView] = useState<TrainingAdminView>("library");

  const canManageTraining = ["admin", "editor", "group_leader"].includes(role || "");
  const lessonTitleCount = courseLessons.filter((lesson) => lesson.title.trim()).length;
  const lessonContentCount = courseLessons.filter((lesson) => lesson.content.trim()).length;
  const lessonMediaCount = courseLessons.reduce(
    (sum, lesson) => sum + lesson.mediaItems.filter((item) => item.url.trim()).length,
    0
  );
  const courseReadiness = Math.min(
    100,
    (courseForm.title.trim() ? 25 : 0) +
      (courseForm.description.trim() ? 20 : 0) +
      (lessonTitleCount > 0 ? 25 : 0) +
      (lessonContentCount > 0 ? 20 : 0) +
      (lessonMediaCount > 0 ? 10 : 0)
  );

  const loadTraining = async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [sectionResult, courseResult, assignmentResult, lessonResult, lessonProgressResult, peopleResult] = await Promise.all([
      (supabase as any)
        .from("training_sections")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("position", { ascending: true })
        .order("name", { ascending: true }),
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
        .from("training_lessons")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("position", { ascending: true }),
      (supabase as any)
        .from("training_lesson_progress")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("completed_at", { ascending: false }),
      (supabase as any)
        .from("people")
        .select("id, display_name, email")
        .eq("workspace_id", workspace.id)
        .order("display_name", { ascending: true }),
    ]);

    if (sectionResult.error) toast.error(sectionResult.error.message);
    if (courseResult.error) toast.error(courseResult.error.message);
    if (assignmentResult.error) toast.error(assignmentResult.error.message);
    if (lessonResult.error) toast.error(lessonResult.error.message);
    if (lessonProgressResult.error) toast.error(lessonProgressResult.error.message);
    if (peopleResult.error) toast.error(peopleResult.error.message);

    setSections(sectionResult.data ?? []);
    setCourses(courseResult.data ?? []);
    setAssignments(assignmentResult.data ?? []);
    setLessons(lessonResult.data ?? []);
    setLessonProgress(lessonProgressResult.data ?? []);
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

  const sectionsById = useMemo(() => {
    return sections.reduce<Record<string, TrainingSection>>((acc, section) => {
      acc[section.id] = section;
      return acc;
    }, {});
  }, [sections]);

  const folderTiles = useMemo(() => {
    const tiles = sections.map((section) => ({
      id: section.id,
      name: section.name,
      description: section.description,
      courseCount: courses.filter((course) => course.section_id === section.id).length,
    }));

    const unfiledCourseCount = courses.filter((course) => !course.section_id).length;
    if (unfiledCourseCount > 0) {
      tiles.push({
        id: "unfiled",
        name: "Unfiled Courses",
        description: "Courses that have not been added to a folder yet.",
        courseCount: unfiledCourseCount,
      });
    }

    return tiles;
  }, [courses, sections]);

  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    if (selectedFolderId === "unfiled") {
      return {
        id: "unfiled",
        name: "Unfiled Courses",
        description: "Courses that have not been added to a folder yet.",
      };
    }

    return sectionsById[selectedFolderId] || null;
  }, [selectedFolderId, sectionsById]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.category.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query);

      const matchesCategory = categoryFilter === "All" || course.category === categoryFilter;
      const matchesSection = selectedFolderId
        ? selectedFolderId === "unfiled"
          ? !course.section_id
          : course.section_id === selectedFolderId
        : true;
      const matchesStatus = statusFilter === "All" || course.status === statusFilter;

      return matchesSearch && matchesCategory && matchesSection && matchesStatus;
    });
  }, [categoryFilter, courses, search, selectedFolderId, statusFilter]);

  const assignmentCountByCourse = useMemo(() => {
    return assignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.course_id] = (acc[assignment.course_id] || 0) + 1;
      return acc;
    }, {});
  }, [assignments]);

  const peopleById = useMemo(() => {
    return people.reduce<Record<string, PersonOption>>((acc, person) => {
      acc[person.id] = person;
      return acc;
    }, {});
  }, [people]);

  const coursesById = useMemo(() => {
    return courses.reduce<Record<string, TrainingCourse>>((acc, course) => {
      acc[course.id] = course;
      return acc;
    }, {});
  }, [courses]);

  const lessonsByCourseId = useMemo(() => {
    return lessons.reduce<Record<string, TrainingLesson[]>>((acc, lesson) => {
      acc[lesson.course_id] = [...(acc[lesson.course_id] || []), lesson].sort(
        (a, b) => a.position - b.position
      );
      return acc;
    }, {});
  }, [lessons]);

  const lessonProgressByAssignmentId = useMemo(() => {
    return lessonProgress.reduce<Record<string, Set<string>>>((acc, progress) => {
      if (!acc[progress.assignment_id]) {
        acc[progress.assignment_id] = new Set<string>();
      }

      acc[progress.assignment_id].add(progress.lesson_id);
      return acc;
    }, {});
  }, [lessonProgress]);

  const myTrainingAssignments = useMemo(() => {
    if (!currentPerson?.id) return [];

    const urgencyRank = (assignment: TrainingAssignment) => {
      const dueState = getTrainingDueState(assignment.due_date, assignment.status);
      if (dueState === "overdue") return 0;
      if (dueState === "due-soon") return 1;
      if (assignment.status === "In Progress") return 2;
      if (assignment.status === "Not Started") return 3;
      if (dueState === "scheduled") return 4;
      return 5;
    };

    return assignments
      .filter((assignment) => assignment.person_id === currentPerson.id)
      .sort((a, b) => {
        const urgencyDifference = urgencyRank(a) - urgencyRank(b);
        if (urgencyDifference !== 0) return urgencyDifference;
        return (a.due_date || "9999-12-31").localeCompare(b.due_date || "9999-12-31");
      });
  }, [assignments, currentPerson?.id]);

  const myTrainingSummary = useMemo(() => {
    return {
      assigned: myTrainingAssignments.length,
      inProgress: myTrainingAssignments.filter((assignment) => assignment.status === "In Progress").length,
      completed: myTrainingAssignments.filter((assignment) => assignment.status === "Complete").length,
      overdue: myTrainingAssignments.filter(
        (assignment) => getTrainingDueState(assignment.due_date, assignment.status) === "overdue"
      ).length,
      dueSoon: myTrainingAssignments.filter(
        (assignment) => getTrainingDueState(assignment.due_date, assignment.status) === "due-soon"
      ).length,
    };
  }, [myTrainingAssignments]);

  const nextTrainingAssignment = useMemo(() => {
    return (
      myTrainingAssignments.find((assignment) => assignment.status !== "Complete") ||
      myTrainingAssignments[0] ||
      null
    );
  }, [myTrainingAssignments]);

  const selectedCourseAssignments = useMemo(() => {
    if (!selectedCourse) return [];
    return assignments.filter((assignment) => assignment.course_id === selectedCourse.id);
  }, [assignments, selectedCourse]);

  const selectedCourseLessons = useMemo(() => {
    if (!selectedCourse) return [];

    const savedLessons = lessonsByCourseId[selectedCourse.id] || [];
    if (savedLessons.length > 0) return savedLessons;

    return (selectedCourse.modules || []).map((module, index) => ({
      id: `${selectedCourse.id}-module-${index}`,
      workspace_id: selectedCourse.workspace_id,
      course_id: selectedCourse.id,
      title: module,
      content: "",
      media_items: [],
      position: index,
      created_at: selectedCourse.created_at,
      updated_at: selectedCourse.updated_at,
    }));
  }, [lessonsByCourseId, selectedCourse]);

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
      const earliestDueDate = courseAssignments
        .filter((assignment) => assignment.status !== "Complete")
        .map((assignment) => assignment.due_date)
        .filter(Boolean)
        .sort()[0];
      const dueDate =
        status === "Complete"
          ? "Complete"
          : formatDueDate(earliestDueDate);
      const dueState = getTrainingDueState(earliestDueDate, status);

      return { course: course.title, progress, status, dueDate, dueState };
    });
  }, [assignments, courses]);

  const recentTrainingActivity = useMemo(() => {
    return assignments
      .map((assignment) => {
        const person = peopleById[assignment.person_id];
        const course = coursesById[assignment.course_id];
        const activityTime =
          assignment.status === "Complete"
            ? assignment.completed_at || assignment.updated_at
            : assignment.updated_at || assignment.created_at;

        return {
          id: assignment.id,
          personName: person?.display_name || "Unknown person",
          courseTitle: course?.title || "Training Course",
          courseCategory: course?.category || "General",
          status: assignment.status,
          progress: assignment.progress,
          dueDate: assignment.due_date,
          dueState: getTrainingDueState(assignment.due_date, assignment.status),
          activityTime,
          action:
            assignment.status === "Complete"
              ? "Completed training"
              : assignment.progress > 0
                ? "Updated progress"
                : "Assigned training",
        };
      })
      .sort((a, b) => (b.activityTime || "").localeCompare(a.activityTime || ""))
      .slice(0, 8);
  }, [assignments, coursesById, peopleById]);

  const summaryCards = [
    { label: "Total Courses", value: String(courses.length), icon: BookOpen },
    { label: "Sections", value: String(sections.length), icon: Folder },
    { label: "Assigned Training", value: String(assignments.length), icon: ClipboardCheck },
    {
      label: "In Progress",
      value: String(assignments.filter((assignment) => assignment.status === "In Progress").length),
      icon: Clock3,
    },
    {
      label: "Overdue",
      value: String(
        assignments.filter(
          (assignment) => getTrainingDueState(assignment.due_date, assignment.status) === "overdue"
        ).length
      ),
      icon: CalendarDays,
    },
    {
      label: "Completed",
      value: String(assignments.filter((assignment) => assignment.status === "Complete").length),
      icon: CheckCircle2,
    },
  ];

  const adminViews: Array<{
    id: TrainingAdminView;
    label: string;
    count: number;
  }> = [
    { id: "library", label: "Library", count: selectedFolderId ? filteredCourses.length : folderTiles.length },
    { id: "progress", label: "Progress", count: progressRows.length },
    { id: "activity", label: "Activity", count: recentTrainingActivity.length },
  ];

  const attentionAssignments = useMemo(() => {
    return assignments
      .map((assignment) => {
        const dueState = getTrainingDueState(assignment.due_date, assignment.status);
        return {
          assignment,
          dueState,
          course: coursesById[assignment.course_id],
          person: peopleById[assignment.person_id],
        };
      })
      .filter(({ assignment, dueState }) => assignment.status !== "Complete" && dueState !== "none")
      .sort((a, b) => {
        const rank = { overdue: 0, "due-soon": 1, scheduled: 2, complete: 3, none: 4 };
        const rankDiff = rank[a.dueState] - rank[b.dueState];
        if (rankDiff !== 0) return rankDiff;
        return (a.assignment.due_date || "9999-12-31").localeCompare(
          b.assignment.due_date || "9999-12-31"
        );
      })
      .slice(0, 4);
  }, [assignments, coursesById, peopleById]);

  const openPanel = (mode: PanelMode, course?: TrainingCourse) => {
    setPanelMode(mode);
    setSelectedCourse(course ?? null);
    setSelectedAssignment(null);
    setSelectedCourseId(course?.id || courses[0]?.id || "");
    setSelectedPersonIds([]);
    setAssignmentDueDate("");
    setPreviewLessonId(null);
    if (mode === "new") {
      setCourseForm({
        ...emptyCourseForm,
        sectionId: selectedFolderId && selectedFolderId !== "unfiled" ? selectedFolderId : "",
      });
      setCourseLessons([createLessonForm(0)]);
    }
    if (mode === "section") {
      setNewSectionName("");
    }
    setPanelOpen(true);
  };

  const editCourse = (course: TrainingCourse) => {
    const existingLessons = lessonsByCourseId[course.id] || [];

    setSelectedCourse(course);
    setSelectedAssignment(null);
    setPreviewLessonId(null);
    setCourseForm({
      title: course.title,
      category: course.category,
      description: course.description,
      coverImageUrl: course.cover_image_url || "",
      estimatedMinutes: String(course.estimated_minutes),
      sectionId: course.section_id || "",
      status: course.status,
      suggestedAudience: course.suggested_audience,
    });
    setCourseLessons(
      existingLessons.length > 0
        ? existingLessons.map((lesson, index) => createLessonForm(index, lesson))
        : (course.modules || []).length > 0
          ? (course.modules || []).map((module, index) =>
              createLessonForm(index, {
                title: module,
                content: "",
              })
            )
          : [createLessonForm(0)]
    );
    setPanelMode("edit");
    setPanelOpen(true);
  };

  const updateCourseLesson = (
    tempId: string,
    updates: Partial<Pick<CourseLessonForm, "title" | "content" | "mediaItems">>
  ) => {
    setCourseLessons((current) =>
      current.map((lesson) => (lesson.tempId === tempId ? { ...lesson, ...updates } : lesson))
    );
  };

  const addLessonMedia = (lessonTempId: string, type: LessonMediaItem["type"]) => {
    setCourseLessons((current) =>
      current.map((lesson) =>
        lesson.tempId === lessonTempId
          ? { ...lesson, mediaItems: [...lesson.mediaItems, createMediaItem(type)] }
          : lesson
      )
    );
  };

  const updateLessonMedia = (
    lessonTempId: string,
    mediaId: string,
    updates: Partial<Pick<LessonMediaItem, "title" | "url">>
  ) => {
    setCourseLessons((current) =>
      current.map((lesson) =>
        lesson.tempId === lessonTempId
          ? {
              ...lesson,
              mediaItems: lesson.mediaItems.map((item) =>
                item.id === mediaId ? { ...item, ...updates } : item
              ),
            }
          : lesson
      )
    );
  };

  const removeLessonMedia = (lessonTempId: string, mediaId: string) => {
    setCourseLessons((current) =>
      current.map((lesson) =>
        lesson.tempId === lessonTempId
          ? {
              ...lesson,
              mediaItems: lesson.mediaItems.filter((item) => item.id !== mediaId),
            }
          : lesson
      )
    );
  };

  const addCourseLesson = () => {
    setCourseLessons((current) => [...current, createLessonForm(current.length)]);
  };

  const removeCourseLesson = (tempId: string) => {
    setCourseLessons((current) => {
      if (current.length === 1) {
        return [createLessonForm(0)];
      }

      return current
        .filter((lesson) => lesson.tempId !== tempId)
        .map((lesson, index) => ({ ...lesson, position: index }));
    });
  };

  const moveCourseLesson = (tempId: string, direction: -1 | 1) => {
    setCourseLessons((current) => {
      const index = current.findIndex((lesson) => lesson.tempId === tempId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((lesson, nextPosition) => ({ ...lesson, position: nextPosition }));
    });
  };

  const createTrainingSection = async () => {
    if (!workspace?.id || !user?.id || !canManageTraining) return;

    const name = newSectionName.trim();
    if (!name) {
      toast.error("Add a folder name first.");
      return;
    }

    setCreatingSection(true);

    const { data, error } = await (supabase as any)
      .from("training_sections")
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        name,
        position: sections.length,
      })
      .select("*")
      .single();

    setCreatingSection(false);

    if (error) {
      if (error.message.includes("training_sections") || error.code === "42P01") {
        toast.error("Apply the training sections migration in Supabase, then create folders.");
        return;
      }

      toast.error(error.message);
      return;
    }

    setSections((current) => [...current, data].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)));
    setNewSectionName("");
    setAdminView("library");
    if (panelMode === "section") {
      setPanelOpen(false);
    }
    toast.success("Training folder created");
  };

  const saveCourse = async () => {
    if (!workspace?.id || !user?.id) return;
    if (!courseForm.title.trim()) {
      toast.error("Add a course name first.");
      return;
    }

    const cleanLessons = courseLessons
      .map((lesson, index) => ({
        title: lesson.title.trim(),
        content: lesson.content.trim(),
        mediaItems: lesson.mediaItems
          .map((item) => ({
            ...item,
            title: item.title.trim(),
            url: item.url.trim(),
          }))
          .filter((item) => item.url),
        position: index,
      }))
      .filter((lesson) => lesson.title || lesson.content || lesson.mediaItems.length > 0);

    if (cleanLessons.some((lesson) => !lesson.title)) {
      toast.error("Every lesson with content needs a lesson title.");
      return;
    }

    if (cleanLessons.some((lesson) => lesson.mediaItems.some((item) => !item.url))) {
      toast.error("Every media item needs a URL.");
      return;
    }

    setSaving(true);

    const payload = {
      title: courseForm.title.trim(),
      category: courseForm.category.trim() || "General",
      cover_image_url: courseForm.coverImageUrl.trim(),
      description: courseForm.description.trim(),
      estimated_minutes: Number(courseForm.estimatedMinutes) || 30,
      section_id: courseForm.sectionId || null,
      status: courseForm.status,
      suggested_audience: courseForm.suggestedAudience.trim(),
      modules: cleanLessons.map((lesson) => lesson.title),
      updated_at: new Date().toISOString(),
    };

    const courseResult =
      panelMode === "edit" && selectedCourse
        ? await (supabase as any)
            .from("training_courses")
            .update(payload)
            .eq("id", selectedCourse.id)
            .eq("workspace_id", workspace.id)
            .select("id")
            .single()
        : await (supabase as any)
            .from("training_courses")
            .insert({
              workspace_id: workspace.id,
              user_id: user.id,
              ...payload,
            })
            .select("id")
            .single();

    if (courseResult.error) {
      setSaving(false);
      if (
        courseResult.error.message.includes("cover_image_url") ||
        courseResult.error.code === "PGRST204"
      ) {
        const missingSectionColumn = courseResult.error.message.includes("section_id");
        toast.error(
          missingSectionColumn
            ? "Apply the training sections migration in Supabase, then save again."
            : "Apply the training cover image migration in Supabase, then save again."
        );
        return;
      }
      toast.error(courseResult.error.message);
      return;
    }

    const savedCourseId = courseResult.data?.id;

    if (savedCourseId) {
      const { error: deleteLessonsError } = await (supabase as any)
        .from("training_lessons")
        .delete()
        .eq("course_id", savedCourseId)
        .eq("workspace_id", workspace.id);

      if (deleteLessonsError) {
        setSaving(false);
        toast.error(deleteLessonsError.message);
        return;
      }

      if (cleanLessons.length > 0) {
        const { error: lessonError } = await (supabase as any)
          .from("training_lessons")
          .insert(
            cleanLessons.map((lesson) => ({
              workspace_id: workspace.id,
              course_id: savedCourseId,
              title: lesson.title,
              content: lesson.content,
              media_items: lesson.mediaItems,
              position: lesson.position,
            }))
          );

        if (lessonError) {
          setSaving(false);
          toast.error(lessonError.message);
          return;
        }
      }
    }

    setSaving(false);
    toast.success(panelMode === "edit" ? "Training course updated" : "Training course created");
    setCourseForm(emptyCourseForm);
    setCourseLessons([createLessonForm(0)]);
    setPanelOpen(false);
    loadTraining();
  };

  const archiveCourse = async (course: TrainingCourse) => {
    if (!workspace?.id || !canManageTraining) return;
    const confirmed = window.confirm(`Archive ${course.title}? Existing assignments will be kept.`);
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("training_courses")
      .update({
        status: "Archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", course.id)
      .eq("workspace_id", workspace.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Training course archived");
    setCourses((current) => current.filter((item) => item.id !== course.id));
    setPanelOpen(false);
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

    const assignedCourse = courses.find((course) => course.id === selectedCourseId);
    await Promise.all(
      selectedPersonIds.map((personId) =>
        createNotificationForPerson({
          personId,
          currentUserId: user.id,
          actorPersonId: currentPerson?.id || null,
          title: "Training assigned",
          message: `You were assigned ${assignedCourse?.title || "a training course"}.`,
          type: "training",
          entityType: "training",
          entityId: selectedCourseId,
        })
      )
    );

    toast.success("Training assigned");
    setPanelOpen(false);
    loadTraining();
  };

  const uploadCourseCover = async (file?: File | null) => {
    if (!workspace?.id || !user?.id || !canManageTraining || !file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${workspace.id}/${user.id}-${Date.now()}.${fileExt}`;

    setUploadingCover(true);
    toast.info("Uploading course cover...");

    const { error: uploadError } = await supabase.storage
      .from("training-course-covers")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setUploadingCover(false);
      if (uploadError.message.toLowerCase().includes("bucket not found")) {
        toast.error("Create the training-course-covers storage bucket in Supabase, then upload again.");
        return;
      }
      if (uploadError.message.toLowerCase().includes("row-level security")) {
        toast.error("Add the training-course-covers storage policies in Supabase, then upload again.");
        return;
      }
      toast.error(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("training-course-covers")
      .getPublicUrl(filePath);

    setUploadingCover(false);

    if (!data.publicUrl) {
      toast.error("Could not generate public image URL.");
      return;
    }

    setCourseForm((current) => ({ ...current, coverImageUrl: data.publicUrl }));
    toast.success("Course cover uploaded");
  };

  const renderCourseCard = (course: TrainingCourse) => (
    <Card
      key={course.id}
      className="actsix-panel-soft flex min-w-0 flex-col overflow-hidden border-border/60 p-0"
    >
      <div className="relative aspect-[16/7] overflow-hidden bg-muted">
        {course.cover_image_url ? (
          <img src={course.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-teal/10 text-brand-teal">
            <GraduationCap className="h-9 w-9" />
          </div>
        )}

        <Badge
          variant="outline"
          className={cn("absolute right-3 top-3 w-fit bg-background/90 backdrop-blur", statusBadgeClass(course.status))}
        >
          {course.status}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 min-h-[3rem] text-base font-extrabold leading-6 tracking-tight text-foreground">
            {course.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="max-w-full border-brand-teal/25 bg-brand-teal/10 px-2 py-0.5 text-[11px] text-brand-teal">
              <span className="truncate">{course.category}</span>
            </Badge>
            {course.section_id && sectionsById[course.section_id] && (
              <Badge variant="outline" className="max-w-full border-border/70 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                <Folder className="mr-1 h-3 w-3" />
                <span className="truncate">{sectionsById[course.section_id].name}</span>
              </Badge>
            )}
          </div>
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.75rem] text-xs font-medium leading-5 text-muted-foreground">
          {course.description || "No course description yet."}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Clock3 className="h-3 w-3" />
            {course.estimated_minutes} min
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <BookOpen className="h-3 w-3" />
            {(lessonsByCourseId[course.id]?.length || course.modules.length || 0)} lessons
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Users className="h-3 w-3" />
            {assignmentCountByCourse[course.id] || 0} assigned
          </span>
        </div>

        <div className="mt-3 grid grid-cols-[2.25rem_2.25rem_minmax(0,1fr)] gap-1.5">
          <Button
            variant="outline"
            title="View course"
            aria-label={`View ${course.title}`}
            size="sm"
            className="actsix-btn-outline h-8 min-w-0 px-0"
            onClick={() => openPanel("course", course)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            title="Edit course"
            aria-label={`Edit ${course.title}`}
            size="sm"
            className="actsix-btn-outline h-8 min-w-0 px-0"
            onClick={() => editCourse(course)}
            disabled={!canManageTraining}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="actsix-btn-primary h-8 min-w-0 px-2 text-xs"
            onClick={() => openPanel("assign", course)}
            disabled={!canManageTraining}
          >
            <span className="truncate">Assign</span>
          </Button>
        </div>
      </div>
    </Card>
  );

  const updateAssignment = async (
    assignment: TrainingAssignment,
    updates: Partial<Pick<TrainingAssignment, "status" | "progress" | "due_date">>
  ) => {
    if (!canManageTraining) return;

    const nextProgress =
      updates.progress !== undefined
        ? Math.max(0, Math.min(100, Number(updates.progress) || 0))
        : assignment.progress;
    const nextStatus = updates.status || getProgressStatus(nextProgress);

    const { error } = await (supabase as any)
      .from("training_assignments")
      .update({
        ...updates,
        progress: nextProgress,
        status: nextStatus,
        completed_at: nextStatus === "Complete" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setAssignments((current) =>
      current.map((item) =>
        item.id === assignment.id
          ? {
              ...item,
              ...updates,
              progress: nextProgress,
              status: nextStatus,
              completed_at: nextStatus === "Complete" ? new Date().toISOString() : null,
            }
          : item
      )
    );
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!canManageTraining) return;

    const { error } = await (supabase as any)
      .from("training_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    toast.success("Assignment removed");
  };

  const updateMyAssignment = async (
    assignment: TrainingAssignment,
    updates: Partial<Pick<TrainingAssignment, "status" | "progress">>
  ) => {
    if (!user?.id || !currentPerson?.id) return;

    const nextProgress =
      updates.progress !== undefined
        ? Math.max(0, Math.min(100, Number(updates.progress) || 0))
        : assignment.progress;
    const nextStatus = updates.status || getProgressStatus(nextProgress);

    const { data, error } = await (supabase as any).rpc("update_my_training_assignment_progress", {
      target_assignment_id: assignment.id,
      next_progress: nextProgress,
      next_status: nextStatus,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    const updatedAssignment = data as TrainingAssignment;
    setAssignments((current) =>
      current.map((item) => (item.id === assignment.id ? updatedAssignment : item))
    );

    const course = coursesById[assignment.course_id];

    if (nextStatus === "Complete" && assignment.status !== "Complete") {
      if (assignment.assigned_by && assignment.assigned_by !== user.id) {
        await createNotification({
          recipientUserId: assignment.assigned_by,
          actorPersonId: currentPerson.id,
          title: "Training completed",
          message: `${currentPerson.display_name} completed ${course?.title || "a training course"}.`,
          type: "training",
          entityType: "training",
          entityId: assignment.course_id,
        });
      }

      toast.success("Training completed");
      return;
    }

    toast.success("Training progress updated");
  };

  const toggleMyLessonCompletion = async (
    assignment: TrainingAssignment,
    lesson: TrainingLesson,
    shouldComplete: boolean
  ) => {
    if (!user?.id || !currentPerson?.id) return;

    const { data, error } = await (supabase as any).rpc("set_my_training_lesson_completion", {
      target_assignment_id: assignment.id,
      target_lesson_id: lesson.id,
      should_complete: shouldComplete,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    const updatedAssignment = data as TrainingAssignment;
    setAssignments((current) =>
      current.map((item) => (item.id === assignment.id ? updatedAssignment : item))
    );
    setSelectedAssignment(updatedAssignment);

    setLessonProgress((current) => {
      const withoutCurrent = current.filter(
        (item) => !(item.assignment_id === assignment.id && item.lesson_id === lesson.id)
      );

      if (!shouldComplete) return withoutCurrent;

      return [
        {
          id: `${assignment.id}-${lesson.id}`,
          workspace_id: assignment.workspace_id,
          assignment_id: assignment.id,
          lesson_id: lesson.id,
          person_id: assignment.person_id,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        ...withoutCurrent,
      ];
    });

    if (updatedAssignment.status === "Complete" && assignment.status !== "Complete") {
      const course = coursesById[assignment.course_id];

      if (assignment.assigned_by && assignment.assigned_by !== user.id) {
        await createNotification({
          recipientUserId: assignment.assigned_by,
          actorPersonId: currentPerson.id,
          title: "Training completed",
          message: `${currentPerson.display_name} completed ${course?.title || "a training course"}.`,
          type: "training",
          entityType: "training",
          entityId: assignment.course_id,
        });
      }

      toast.success("Course completed");
      return;
    }

    toast.success(shouldComplete ? "Lesson completed" : "Lesson reopened");
  };

  if (!canManageTraining) {
    const learnerSummaryCards = [
      { label: "Assigned", value: String(myTrainingSummary.assigned), icon: ClipboardCheck },
      { label: "In Progress", value: String(myTrainingSummary.inProgress), icon: Clock3 },
      { label: "Overdue", value: String(myTrainingSummary.overdue), icon: CalendarDays },
      { label: "Due Soon", value: String(myTrainingSummary.dueSoon), icon: CalendarDays },
      { label: "Completed", value: String(myTrainingSummary.completed), icon: CheckCircle2 },
    ];

    return (
      <div>
        <PageHeader
          eyebrow="Training"
          title="My Training"
          subtitle="See assigned courses, due dates, and ministry training progress."
        />

        <div className="actsix-page-body actsix-page-stack pt-5 pb-12 sm:pt-6">
          <section className="actsix-panel-soft overflow-hidden border border-border/60 bg-card">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="label-eyebrow">My Training</p>
                    <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                      {nextTrainingAssignment
                        ? coursesById[nextTrainingAssignment.course_id]?.title || "Training Course"
                        : "No training assigned"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
                      {nextTrainingAssignment
                        ? coursesById[nextTrainingAssignment.course_id]?.description ||
                          "Open the course to see the training details."
                        : "Assigned courses will appear here when your team adds training for you."}
                    </p>
                  </div>

                  {nextTrainingAssignment && (
                    <Button
                      className="actsix-btn-primary w-full sm:w-auto"
                      onClick={() => {
                        const course = coursesById[nextTrainingAssignment.course_id] || null;
                        setSelectedCourse(course);
                        setSelectedAssignment(nextTrainingAssignment);
                        setPanelMode("course");
                        setPanelOpen(true);
                      }}
                      disabled={!coursesById[nextTrainingAssignment.course_id]}
                    >
                      <Eye className="h-4 w-4" />
                      Open Next Course
                    </Button>
                  )}
                </div>

                {nextTrainingAssignment && (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
                      <span>{nextTrainingAssignment.status}</span>
                      <span>{nextTrainingAssignment.progress}%</span>
                    </div>
                    <Progress value={nextTrainingAssignment.progress} className="h-2 bg-muted" />
                  </div>
                )}
              </div>

              <aside className="border-t border-border/70 bg-background/70 p-4 sm:p-5 xl:border-l xl:border-t-0">
                <p className="label-eyebrow">Summary</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {learnerSummaryCards.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                            {item.label}
                          </p>
                          <Icon className="h-3.5 w-3.5 shrink-0 text-brand-teal" />
                        </div>
                        <p className="mt-1 text-xl font-extrabold tracking-tight">
                          {loading ? "..." : item.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          </section>

          <Card className="actsix-panel-soft overflow-hidden border-border/60">
            <div className="border-b border-border/70 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                  <p className="label-eyebrow">Assigned Courses</p>
                  <h2 className="text-2xl font-extrabold tracking-tight">Training to complete</h2>
                </div>
              </div>
            </div>

            {loading && (
              <div className="p-5 sm:p-6">
                <div className="actsix-loading-state" role="status">
                  Loading your training...
                </div>
              </div>
            )}

            {!loading && myTrainingAssignments.length === 0 && (
              <div className="p-5 sm:p-6">
                <div className="actsix-empty-state bg-card/70 p-5 text-left">
                  No training assigned yet.
                </div>
              </div>
            )}

            {!loading && myTrainingAssignments.length > 0 && (
              <div className="divide-y divide-border/70">
                {myTrainingAssignments.map((assignment) => {
                  const course = coursesById[assignment.course_id] || null;
                  const courseLessonCount =
                    lessonsByCourseId[assignment.course_id]?.length || course?.modules.length || 0;
                  const dueBadge = dueStateBadge(
                    getTrainingDueState(assignment.due_date, assignment.status)
                  );

                  return (
                    <div key={assignment.id} className="p-5 sm:p-6">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-extrabold tracking-tight">
                              {course?.title || "Training Course"}
                            </h3>
                            <Badge
                              variant="outline"
                              className="border-brand-teal/25 bg-brand-teal/10 text-brand-teal"
                            >
                              {course?.category || "General"}
                            </Badge>
                            <Badge variant="outline" className={statusBadgeClass(assignment.status)}>
                              {assignment.status}
                            </Badge>
                            {dueBadge.label !== "Scheduled" && (
                              <Badge variant="outline" className={dueBadge.className}>
                                {dueBadge.label}
                              </Badge>
                            )}
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-muted-foreground">
                            {course?.description || "Open the course to see the training details."}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {course?.estimated_minutes || 0} min
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              {courseLessonCount} lessons
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {assignment.status === "Complete"
                                ? "Complete"
                                : formatDueDate(assignment.due_date)}
                            </span>
                          </div>

                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
                              <span>Progress</span>
                              <span>{assignment.progress}%</span>
                            </div>
                            <Progress value={assignment.progress} className="h-2.5 bg-muted" />
                          </div>

                          {assignment.status !== "Complete" && courseLessonCount === 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              {assignment.status === "Not Started" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="actsix-btn-primary h-9"
                                  onClick={() =>
                                    updateMyAssignment(assignment, {
                                      status: "In Progress",
                                      progress: Math.max(assignment.progress, 10),
                                    })
                                  }
                                >
                                  Start Training
                                </Button>
                              )}

                              {[25, 50, 75].map((value) => (
                                <Button
                                  key={value}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="actsix-btn-outline h-9 px-3"
                                  onClick={() =>
                                    updateMyAssignment(assignment, {
                                      progress: value,
                                    })
                                  }
                                  disabled={assignment.progress === value}
                                >
                                  {value}%
                                </Button>
                              ))}

                              <Input
                                type="number"
                                min={0}
                                max={100}
                                defaultValue={assignment.progress}
                                aria-label={`Update progress for ${course?.title || "training course"}`}
                                onBlur={(event) => {
                                  const nextValue = Number(event.target.value);
                                  if (Number.isNaN(nextValue) || nextValue === assignment.progress) return;
                                  updateMyAssignment(assignment, {
                                    progress: nextValue,
                                  });
                                }}
                                className="h-9 w-24 border-border/70 bg-background text-sm"
                              />
                            </div>
                          )}

                          {assignment.status !== "Complete" && courseLessonCount > 0 && (
                            <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm font-bold text-muted-foreground">
                              Open the course to complete lessons and update progress.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="actsix-btn-outline w-full"
                          onClick={() => {
                            setSelectedCourse(course);
                            setSelectedAssignment(assignment);
                            setPanelMode("course");
                            setPanelOpen(true);
                          }}
                            disabled={!course}
                          >
                            <Eye className="h-4 w-4" />
                            View Course
                          </Button>

                          {assignment.status !== "Complete" && courseLessonCount > 0 ? (
                            <Button
                              type="button"
                              className="actsix-btn-primary w-full"
                              onClick={() => {
                                setSelectedCourse(course);
                                setSelectedAssignment(assignment);
                                setPanelMode("course");
                                setPanelOpen(true);
                              }}
                              disabled={!course}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Complete Lessons
                            </Button>
                          ) : assignment.status !== "Complete" ? (
                            <Button
                              type="button"
                              className="actsix-btn-primary w-full"
                              onClick={() =>
                                updateMyAssignment(assignment, {
                                  status: "Complete",
                                  progress: 100,
                                })
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Mark Complete
                            </Button>
                          ) : (
                            <div className="rounded-[var(--radius-control)] border border-brand-sage/25 bg-brand-sage/10 px-3 py-2 text-center text-sm font-extrabold text-brand-sage">
                              Completed
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <ResponsiveModal
          open={panelOpen}
          onOpenChange={setPanelOpen}
          title={selectedCourse?.title || "Course"}
          description={selectedCourse?.description}
          className="max-h-[88vh] overflow-hidden sm:max-w-[44rem]"
          bodyClassName="max-h-[calc(88vh-8rem)] overflow-y-auto px-4 pb-8 pt-2 md:px-0 md:pb-0 md:pt-0"
        >
          {selectedCourse && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
                  {selectedCourse.category}
                </Badge>
                <Badge variant="outline" className={statusBadgeClass(selectedCourse.status)}>
                  {selectedCourse.status}
                </Badge>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {selectedCourse.estimated_minutes} min
                </span>
              </div>

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Course Description</p>
                <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                  {selectedCourse.description || "No course description yet."}
                </p>
              </Card>

              {selectedCourseLessons.length > 0 && (
                <Card className="border-border/60 bg-background p-4">
                  <p className="label-eyebrow">Lessons</p>
                  <div className="mt-3 space-y-2">
                    {selectedCourseLessons.map((lesson, index) => {
                      const completedLessons = selectedAssignment
                        ? lessonProgressByAssignmentId[selectedAssignment.id] || new Set<string>()
                        : new Set<string>();
                      const isComplete = completedLessons.has(lesson.id);

                      return (
                        <div key={lesson.id} className="rounded-xl bg-muted/70 p-3">
                          <div className="flex items-start gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                              isComplete
                                ? "bg-brand-sage text-white"
                                : "bg-brand-teal text-white"
                            }`}>
                              {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground">{lesson.title}</p>
                                  <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                                    {getLessonReadTime(lesson.content, lesson.media_items)} min read
                                  </p>
                                </div>

                                {selectedAssignment && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isComplete ? "outline" : "default"}
                                    className={isComplete ? "actsix-btn-outline h-8" : "actsix-btn-primary h-8"}
                                    onClick={() =>
                                      toggleMyLessonCompletion(selectedAssignment, lesson, !isComplete)
                                    }
                                  >
                                    {isComplete ? "Reopen" : "Complete"}
                                  </Button>
                                )}
                              </div>

                              {lesson.content && (
                                <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-muted-foreground">
                                  {lesson.content}
                                </p>
                              )}
                              <LessonMediaList mediaItems={lesson.media_items || []} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {selectedCourse.suggested_audience && (
                <Card className="border-border/60 bg-background p-4">
                  <p className="label-eyebrow">Suggested Audience</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
                    {selectedCourse.suggested_audience}
                  </p>
                </Card>
              )}
            </div>
          )}
        </ResponsiveModal>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="Training Center"
        subtitle="Create, assign, and track ministry training resources."
        actions={
          <>
            <Button
              variant="outline"
              className="actsix-btn-outline gap-2"
              onClick={() => openPanel("section")}
              disabled={!canManageTraining}
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
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
        <section className="actsix-panel-soft overflow-hidden border border-border/60 bg-card">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="label-eyebrow">Command Center</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                    Training at a glance
                  </h2>
                </div>

                <div className="actsix-view-tabs grid gap-1.5 sm:grid-cols-3 lg:min-w-[25rem]">
                  {adminViews.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setAdminView(view.id)}
                      className="actsix-view-tab"
                      data-state={adminView === view.id ? "active" : "inactive"}
                    >
                      <span className="min-w-0 truncate text-sm font-extrabold">{view.label}</span>
                      <span className="actsix-view-tab-count">
                        {loading ? "..." : view.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                {summaryCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="text-xl font-extrabold tracking-tight">
                          {loading ? "..." : item.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="border-t border-border/70 bg-background/70 p-4 sm:p-5 xl:border-l xl:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <p className="label-eyebrow">Needs Attention</p>
                <Badge variant="outline" className="border-brand-amber/25 bg-brand-amber/10 text-brand-amber">
                  {loading ? "..." : attentionAssignments.length}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                {loading && (
                  <div className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-muted-foreground">
                    Loading training status...
                  </div>
                )}

                {!loading && attentionAssignments.length === 0 && (
                  <div className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-muted-foreground">
                    No urgent training due dates.
                  </div>
                )}

                {!loading &&
                  attentionAssignments.map(({ assignment, course, person, dueState }) => (
                    <div key={assignment.id} className="rounded-xl bg-background px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">
                            {person?.display_name || "Unknown person"}
                          </p>
                          <p className="mt-0.5 truncate text-xs font-bold text-muted-foreground">
                            {course?.title || "Training Course"}
                          </p>
                        </div>
                        <Badge variant="outline" className={dueStateBadge(dueState).className}>
                          {dueStateBadge(dueState).label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={assignment.progress} className="h-1.5 bg-muted" />
                        <span className="w-9 text-right text-[11px] font-extrabold tabular-nums text-muted-foreground">
                          {assignment.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </aside>
          </div>
        </section>

        {adminView === "library" && !selectedFolderId && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {loading && (
            <Card className="actsix-loading-state md:col-span-2 xl:col-span-3 2xl:col-span-4" role="status">
              Loading training folders...
            </Card>
          )}

          {!loading &&
            folderTiles.map((folder) => (
              <Link key={folder.id} to={`/training?folder=${encodeURIComponent(folder.id)}`} className="group block min-w-0">
                <Card className="actsix-panel-soft flex min-h-44 flex-col justify-between border-border/60 p-5 transition hover:-translate-y-0.5 hover:border-brand-teal/35 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal transition group-hover:bg-brand-teal group-hover:text-white">
                      <Folder className="h-5 w-5" />
                    </span>
                    <Badge variant="outline" className="border-border/70 bg-background px-2.5 py-1 text-xs font-extrabold text-muted-foreground">
                      {folder.courseCount} course{folder.courseCount === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="mt-6 min-w-0">
                    <h2 className="truncate text-xl font-extrabold tracking-tight text-foreground transition group-hover:text-brand-teal">
                      {folder.name}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-muted-foreground">
                      {folder.description || "Open this folder to view its training courses."}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}

          {!loading && folderTiles.length === 0 && (
            <Card className="actsix-panel-soft border-border/60 p-8 text-center md:col-span-2 xl:col-span-3 2xl:col-span-4">
              <p className="text-lg font-extrabold">No training folders yet</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Create a folder from the top action bar to start organizing courses.
              </p>
            </Card>
          )}
        </section>
        )}

        {adminView === "library" && selectedFolderId && (
        <>
          <Card className="actsix-panel-soft border-border/60 p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Button asChild variant="ghost" className="mb-2 h-8 px-0 text-muted-foreground hover:bg-transparent hover:text-brand-teal">
                    <Link to="/training">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to folders
                    </Link>
                  </Button>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                      <Folder className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-extrabold tracking-tight">
                        {selectedFolder?.name || "Training Folder"}
                      </h2>
                      <p className="text-sm font-medium text-muted-foreground">
                        {filteredCourses.length} course{filteredCourses.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search courses in this folder..."
                    className="h-11 rounded-xl border-border/70 bg-background pl-10 shadow-none"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:w-[26rem]">
                  <label className="relative">
                    <span className="sr-only">Filter by category</span>
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="h-11 w-full rounded-xl border border-border/70 bg-background px-9 text-sm font-semibold shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
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
                      className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                    >
                      <option>All</option>
                      <option>Active</option>
                      <option>Draft</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {loading && (
              <Card className="actsix-loading-state md:col-span-2 xl:col-span-3 2xl:col-span-4" role="status">
                Loading courses...
              </Card>
            )}

            {!loading && filteredCourses.map((course) => renderCourseCard(course))}

            {!loading && filteredCourses.length === 0 && (
              <Card className="actsix-panel-soft border-border/60 p-8 text-center md:col-span-2 xl:col-span-3 2xl:col-span-4">
                <p className="text-lg font-extrabold">No courses in this folder</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Add a course to this folder or adjust the course filters.
                </p>
              </Card>
            )}
          </section>
        </>
        )}

        {adminView === "progress" && (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.dueDate}</span>
                      {item.dueState !== "none" && (
                        <Badge variant="outline" className={dueStateBadge(item.dueState).className}>
                          {dueStateBadge(item.dueState).label}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        )}

        {adminView === "activity" && (
        <Card className="actsix-panel-soft overflow-hidden border-border/60">
          <div className="border-b border-border/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
                  <Clock3 className="h-5 w-5" />
                </span>
                <div>
                  <p className="label-eyebrow">Activity</p>
                  <h2 className="text-2xl font-extrabold tracking-tight">
                    Recent Training Activity
                  </h2>
                </div>
              </div>

              <Badge variant="outline" className="border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
                {recentTrainingActivity.length} recent
              </Badge>
            </div>
          </div>

          {loading && (
            <div className="p-5 sm:p-6">
              <div className="actsix-loading-state" role="status">
                Loading training activity...
              </div>
            </div>
          )}

          {!loading && recentTrainingActivity.length === 0 && (
            <div className="p-5 sm:p-6">
              <div className="actsix-empty-state bg-card/70 p-5 text-left">
                No training activity yet.
              </div>
            </div>
          )}

          {!loading && recentTrainingActivity.length > 0 && (
            <div className="divide-y divide-border/70">
              {recentTrainingActivity.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_160px_120px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-extrabold tracking-tight">
                        {item.personName}
                      </p>
                      <Badge variant="outline" className={statusBadgeClass(item.status)}>
                        {item.status}
                      </Badge>
                      {item.dueState !== "none" && (
                        <Badge variant="outline" className={dueStateBadge(item.dueState).className}>
                          {dueStateBadge(item.dueState).label}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-sm font-bold text-muted-foreground">
                      {item.action} - {item.courseTitle}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        {item.courseCategory}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                        <CalendarDays className="h-3 w-3" />
                        {item.status === "Complete" ? "Complete" : formatDueDate(item.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
                      <span>Progress</span>
                      <span>{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-2 bg-muted" />
                  </div>

                  <p className="text-sm font-bold text-muted-foreground lg:text-right">
                    {formatActivityTime(item.activityTime)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
        )}
      </div>

      <ResponsiveModal
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={
          panelMode === "new"
            ? "Create a new course"
            : panelMode === "edit"
              ? "Edit course"
              : panelMode === "section"
              ? "Create a new folder"
              : panelMode === "assign"
              ? "Assign training"
              : selectedCourse?.title || "Course"
        }
        description={
          panelMode === "new"
            ? "Create a workspace training resource that can be assigned to people."
            : panelMode === "edit"
              ? "Update the course details, outline, status, and ministry fit."
              : panelMode === "section"
              ? "Add a folder for grouping related training courses."
              : panelMode === "assign"
              ? "Choose the course, people, and optional due date."
              : selectedCourse?.description
        }
        className="max-h-[88vh] overflow-hidden sm:max-w-[52rem]"
        bodyClassName="max-h-[calc(88vh-8rem)] overflow-y-auto px-4 pb-8 pt-2 pr-4 md:px-0 md:pb-0 md:pt-0 md:pr-1"
      >
          <p className="label-eyebrow">
            {panelMode === "new" || panelMode === "edit"
              ? "Course Builder"
              : panelMode === "section"
                ? "Folder"
              : panelMode === "assign"
                ? "Assignment"
                : "Course"}
          </p>

          {panelMode === "section" && (
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="label-eyebrow">Folder name</span>
                <Input
                  value={newSectionName}
                  onChange={(event) => setNewSectionName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      createTrainingSection();
                    }
                  }}
                  autoFocus
                  placeholder="Example: New Volunteers"
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                />
              </label>

              <Card className="border-border/60 bg-background p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                    <Folder className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold">
                      {newSectionName.trim() || "New training folder"}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                      Courses can be assigned to this folder from the course builder.
                    </p>
                  </div>
                </div>
              </Card>

              <Button
                className="actsix-btn-primary w-full"
                onClick={createTrainingSection}
                disabled={creatingSection || !canManageTraining}
              >
                <FolderPlus className="h-4 w-4" />
                {creatingSection ? "Creating..." : "Create Folder"}
              </Button>
            </div>
          )}

          {panelMode === "course" && selectedCourse && (
            <div className="mt-6 space-y-5">
              {selectedCourse.cover_image_url && (
                <div className="aspect-[16/9] overflow-hidden rounded-xl bg-muted">
                  <img
                    src={selectedCourse.cover_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-brand-teal/25 bg-brand-teal/10 text-brand-teal">
                    {selectedCourse.category}
                  </Badge>
                  {selectedCourse.section_id && sectionsById[selectedCourse.section_id] && (
                    <Badge variant="outline" className="border-border/70 bg-background text-muted-foreground">
                      <Folder className="mr-1 h-3 w-3" />
                      {sectionsById[selectedCourse.section_id].name}
                    </Badge>
                  )}
                  <Badge variant="outline" className={statusBadgeClass(selectedCourse.status)}>
                    {selectedCourse.status}
                  </Badge>
                </div>

                {canManageTraining && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="actsix-btn-outline"
                      onClick={() => editCourse(selectedCourse)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => archiveCourse(selectedCourse)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                )}
              </div>

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Suggested Audience</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {selectedCourse.suggested_audience || "No audience guidance added yet."}
                </p>
              </Card>

              <div>
                <p className="label-eyebrow">Lessons</p>
                <div className="mt-3 space-y-2">
                  {selectedCourseLessons.length === 0 && (
                    <p className="text-sm font-medium text-muted-foreground">
                      No lessons added yet.
                    </p>
                  )}
                  {selectedCourseLessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-teal/10 text-xs font-extrabold text-brand-teal">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold">{lesson.title}</p>
                        {lesson.content && (
                          <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-muted-foreground">
                            {lesson.content}
                          </p>
                        )}
                        <LessonMediaList mediaItems={lesson.media_items || []} />
                      </div>
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

              <div>
                <p className="label-eyebrow">Assignments</p>
                <div className="mt-3 space-y-2">
                  {selectedCourseAssignments.length === 0 && (
                    <Card className="border-border/60 bg-background p-4 text-sm font-medium text-muted-foreground">
                      No one has been assigned to this course yet.
                    </Card>
                  )}

                  {selectedCourseAssignments.map((assignment) => {
                    const person = peopleById[assignment.person_id];

                    return (
                      <Card key={assignment.id} className="border-border/60 bg-background p-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-extrabold">
                                {person?.display_name || "Unknown person"}
                              </p>
                              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                                Due {formatDueDate(assignment.due_date)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => deleteAssignment(assignment.id)}
                              disabled={!canManageTraining}
                              aria-label="Remove assignment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem]">
                            <label>
                              <span className="label-eyebrow">Status</span>
                              <select
                                value={assignment.status}
                                onChange={(event) =>
                                  updateAssignment(assignment, {
                                    status: event.target.value as TrainingAssignment["status"],
                                    progress:
                                      event.target.value === "Complete"
                                        ? 100
                                        : event.target.value === "Not Started"
                                          ? 0
                                          : assignment.progress || 25,
                                  })
                                }
                                disabled={!canManageTraining}
                                className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                              >
                                <option>Not Started</option>
                                <option>In Progress</option>
                                <option>Complete</option>
                              </select>
                            </label>

                            <label>
                              <span className="label-eyebrow">Progress</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={assignment.progress}
                                onChange={(event) =>
                                  updateAssignment(assignment, {
                                    progress: Number(event.target.value),
                                  })
                                }
                                disabled={!canManageTraining}
                                className="mt-1 h-10 rounded-xl border-border/70 bg-background shadow-none"
                              />
                            </label>

                            <label>
                              <span className="label-eyebrow">Due Date</span>
                              <Input
                                type="date"
                                value={assignment.due_date || ""}
                                onChange={(event) =>
                                  updateAssignment(assignment, {
                                    due_date: event.target.value || null,
                                  })
                                }
                                disabled={!canManageTraining}
                                className="mt-1 h-10 rounded-xl border-border/70 bg-background shadow-none"
                              />
                            </label>
                          </div>

                          <div className="flex items-center gap-3">
                            <Progress value={assignment.progress} className="h-2" />
                            <span className="w-10 text-right text-xs font-extrabold tabular-nums text-muted-foreground">
                              {assignment.progress}%
                            </span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
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

          {(panelMode === "new" || panelMode === "edit") && (
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="label-eyebrow">Course name</span>
                <Input
                  value={courseForm.title}
                  onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
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
                  <span className="label-eyebrow">Folder</span>
                  <select
                    value={courseForm.sectionId}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, sectionId: event.target.value }))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="">Unfiled</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
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

              <div className="block">
                <span className="label-eyebrow">Cover image URL</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={courseForm.coverImageUrl}
                    onChange={(event) =>
                      setCourseForm((current) => ({ ...current, coverImageUrl: event.target.value }))
                    }
                    placeholder="https://example.com/training-cover.jpg"
                    className="h-10 rounded-xl border-border/70 bg-background"
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm font-bold text-foreground transition hover:bg-muted">
                    <Camera className="h-4 w-4" />
                    {uploadingCover ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover || !canManageTraining}
                      onChange={(event) => {
                        uploadCourseCover(event.target.files?.[0]).finally(() => {
                          event.currentTarget.value = "";
                        });
                      }}
                    />
                  </label>
                </div>
                {courseForm.coverImageUrl && (
                  <div className="mt-3 aspect-[16/7] overflow-hidden rounded-xl bg-muted">
                    <img
                      src={courseForm.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
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
                  {panelMode === "edit" && <option>Archived</option>}
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

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="label-eyebrow">Lessons</span>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Add the lesson count and write the content people should work through.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="actsix-btn-outline h-9 px-3 text-sm"
                    onClick={addCourseLesson}
                  >
                    <Plus className="h-4 w-4" />
                    Add Lesson
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  {courseLessons.map((lesson, index) => (
                    <Card key={lesson.tempId} className="border-border/60 bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal/10 text-sm font-extrabold text-brand-teal">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-extrabold">Lesson {index + 1}</p>
                            <p className="text-xs font-medium text-muted-foreground">
                              Title and content
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() =>
                              setPreviewLessonId((current) =>
                                current === lesson.tempId ? null : lesson.tempId
                              )
                            }
                            aria-label="Preview lesson"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => moveCourseLesson(lesson.tempId, -1)}
                            disabled={index === 0}
                            aria-label="Move lesson up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => moveCourseLesson(lesson.tempId, 1)}
                            disabled={index === courseLessons.length - 1}
                            aria-label="Move lesson down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeCourseLesson(lesson.tempId)}
                            aria-label="Remove lesson"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <label className="mt-4 block">
                        <span className="label-eyebrow">Lesson title</span>
                        <Input
                          value={lesson.title}
                          onChange={(event) =>
                            updateCourseLesson(lesson.tempId, { title: event.target.value })
                          }
                          placeholder="Example: Ministry vision and expectations"
                          className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                        />
                      </label>

                      <label className="mt-4 block">
                        <span className="label-eyebrow">Lesson content</span>
                        <textarea
                          value={lesson.content}
                          onChange={(event) =>
                            updateCourseLesson(lesson.tempId, { content: event.target.value })
                          }
                          rows={5}
                          placeholder="Write the training content, notes, links, or instructions for this lesson."
                          className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm font-medium outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                        />
                      </label>

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="label-eyebrow">Media</span>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              Add video links or image URLs for this lesson.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="actsix-btn-outline h-8 px-3 text-xs"
                              onClick={() => addLessonMedia(lesson.tempId, "video")}
                            >
                              <Video className="h-3.5 w-3.5" />
                              Video
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="actsix-btn-outline h-8 px-3 text-xs"
                              onClick={() => addLessonMedia(lesson.tempId, "image")}
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              Image
                            </Button>
                          </div>
                        </div>

                        {lesson.mediaItems.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {lesson.mediaItems.map((mediaItem) => (
                              <div
                                key={mediaItem.id}
                                className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.4fr)_2.5rem]"
                              >
                                <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-extrabold">
                                  {mediaItem.type === "video" ? (
                                    <Video className="h-4 w-4 text-brand-teal" />
                                  ) : (
                                    <ImageIcon className="h-4 w-4 text-brand-teal" />
                                  )}
                                  {mediaItem.type === "video" ? "Video" : "Image"}
                                </div>

                                <Input
                                  value={mediaItem.title}
                                  onChange={(event) =>
                                    updateLessonMedia(lesson.tempId, mediaItem.id, {
                                      title: event.target.value,
                                    })
                                  }
                                  placeholder="Media title"
                                  className="h-10 rounded-xl border-border/70 bg-background"
                                />

                                <Input
                                  value={mediaItem.url}
                                  onChange={(event) =>
                                    updateLessonMedia(lesson.tempId, mediaItem.id, {
                                      url: event.target.value,
                                    })
                                  }
                                  placeholder={
                                    mediaItem.type === "video"
                                      ? "https://youtube.com/watch?v=..."
                                      : "https://example.com/image.jpg"
                                  }
                                  className="h-10 rounded-xl border-border/70 bg-background"
                                />

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => removeLessonMedia(lesson.tempId, mediaItem.id)}
                                  aria-label="Remove media"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {previewLessonId === lesson.tempId && (
                        <Card className="mt-4 border-border/60 bg-background/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="label-eyebrow">Lesson Preview</p>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                              {getLessonReadTime(lesson.content, lesson.mediaItems)} min read
                            </span>
                          </div>
                          <h3 className="mt-3 text-base font-extrabold tracking-tight">
                            {lesson.title.trim() || `Lesson ${index + 1}`}
                          </h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-muted-foreground">
                            {lesson.content.trim() || "No lesson content added yet."}
                          </p>
                          <LessonMediaList mediaItems={lesson.mediaItems} />
                        </Card>
                      )}
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="border-border/60 bg-background p-4">
                <p className="label-eyebrow">Readiness</p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={courseReadiness} className="h-2" />
                  <span className="text-xs font-extrabold text-muted-foreground">
                    {courseReadiness}%
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  {lessonTitleCount} lesson title{lessonTitleCount === 1 ? "" : "s"} and{" "}
                  {lessonContentCount} lesson content block{lessonContentCount === 1 ? "" : "s"} ready.
                  {lessonMediaCount > 0 && ` ${lessonMediaCount} media item${lessonMediaCount === 1 ? "" : "s"} attached.`}
                  Files, quizzes, and renewal rules can build on this later.
                </p>
              </Card>

              <Button
                className="actsix-btn-primary w-full"
                onClick={saveCourse}
                disabled={saving || !canManageTraining}
              >
                {saving ? "Saving..." : panelMode === "edit" ? "Save Changes" : "Save Course"}
              </Button>

              {panelMode === "edit" && selectedCourse && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => archiveCourse(selectedCourse)}
                  disabled={saving || !canManageTraining}
                >
                  <Trash2 className="h-4 w-4" />
                  Archive Course
                </Button>
              )}
            </div>
          )}
      </ResponsiveModal>
    </div>
  );
};

export default TrainingCenter;
