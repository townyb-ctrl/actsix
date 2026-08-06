import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { Plus } from "lucide-react";
import { createProject as insertProject, defaultProjectPayload } from "@/features/projects/api/projectsApi";

type Project = {
  id: string;
  name: string;
};

type ProjectSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onProjectChange?: (project: Project | null) => void;
  onCreated?: () => void | Promise<void>;
  selectClassName?: string;
};

const ProjectSelect = ({
  id,
  value,
  onChange,
  onProjectChange,
  onCreated,
  selectClassName,
}: ProjectSelectProps) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    setProjects(data ?? []);
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const createProject = async () => {
    if (!user || !newProjectName.trim()) return;

    setSaving(true);

    const projectName = newProjectName.trim();
    const payload = defaultProjectPayload({ name: projectName, user_id: user.id });

    const { data, error } = await insertProject(payload).select("id, name").single();

    setSaving(false);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success("Project created");
    onChange(projectName);
    onProjectChange?.(data ?? { id: payload.id as string, name: projectName });
    setNewProjectName("");
    setCreating(false);
    await loadProjects();
    await onCreated?.();
  };

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={creating ? "__create_new__" : value || ""}
        onChange={(event) => {
          if (event.target.value === "__create_new__") {
            setCreating(true);
            return;
          }

          setCreating(false);
          const selectedProject =
            projects.find((project) => project.name === event.target.value) || null;
          onChange(event.target.value);
          onProjectChange?.(selectedProject);
        }}
        className={selectClassName ?? "mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"}
      >
        <option value="__create_new__">+ Create new project...</option>
        <option value="">No project</option>

        {value && !projects.some((project) => project.name === value) && (
          <option value={value}>{value}</option>
        )}

        {projects.map((project) => (
          <option key={project.id} value={project.name}>
            {project.name}
          </option>
        ))}
      </select>

      {creating && (
        <div className="flex gap-2">
          <Input
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="New project name..."
            className="border-border/70 bg-background"
            autoFocus
          />

          <Button
            type="button"
            disabled={saving || !newProjectName.trim()}
            onClick={createProject}
            className="bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Adding..." : "Add"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProjectSelect;
