import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Project = {
  id: string;
  name: string;
};

type ProjectSelectProps = {
  value: string;
  onChange: (value: string) => void;
  onProjectChange?: (project: Project | null) => void;
  onCreated?: () => void | Promise<void>;
};

const ProjectSelect = ({ value, onChange, onProjectChange, onCreated }: ProjectSelectProps) => {
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
      toast.error(error.message);
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

    const newProjectId = crypto.randomUUID();

    const { data, error } = await supabase
      .from("projects")
      .insert({
        id: newProjectId,
        name: projectName,
        user_id: user.id,
        area: "General",
        status: "In Progress",
        progress: 0,
        open_tasks: 0,
        next_action: "",
        notes: "",
      })
      .select("id, name")
      .single();

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Project created");
    onChange(projectName);
    onProjectChange?.(data ?? { id: newProjectId, name: projectName });
    setNewProjectName("");
    setCreating(false);
    await loadProjects();
    await onCreated?.();
  };

  return (
    <div className="space-y-2">
      <select
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
        className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
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
