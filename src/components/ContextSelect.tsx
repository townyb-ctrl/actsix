import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Context = {
  id: string;
  name: string;
};

type ContextSelectProps = {
  value: string;
  onChange: (value: string) => void;
  onCreated?: () => void | Promise<void>;
  selectClassName?: string;
};

const fallbackContexts = [
  "General",
  "Calls",
  "Computer",
  "Church",
  "Errands",
  "Home",
  "Waiting",
];

const ContextSelect = ({ value, onChange, onCreated, selectClassName }: ContextSelectProps) => {
  const { user } = useAuth();
  const [contexts, setContexts] = useState<Context[]>([]);
  const [creating, setCreating] = useState(false);
  const [newContextName, setNewContextName] = useState("");
  const [saving, setSaving] = useState(false);

  const contextNames = Array.from(
    new Set([...fallbackContexts, ...contexts.map((context) => context.name).filter(Boolean)])
  );

  const loadContexts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("contexts")
      .select("id, name")
      .order("position", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }

    setContexts(data ?? []);
  };

  useEffect(() => {
    loadContexts();
  }, [user]);

  const createContext = async () => {
    if (!user || !newContextName.trim()) return;

    setSaving(true);

    const contextName = newContextName.trim();

    const { error } = await supabase.from("contexts").insert({
      id: crypto.randomUUID(),
      name: contextName,
      user_id: user.id,
      position: contexts.length + fallbackContexts.length,
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Context created");
    onChange(contextName);
    setNewContextName("");
    setCreating(false);
    await loadContexts();
    await onCreated?.();
  };

  return (
    <div className="space-y-2">
      <select
        value={creating ? "__create_new__" : value || "General"}
        onChange={(event) => {
          if (event.target.value === "__create_new__") {
            setCreating(true);
            return;
          }

          setCreating(false);
          onChange(event.target.value);
        }}
        className={selectClassName ?? "mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"}
      >
        <option value="__create_new__">+ Create new context...</option>

        {value && !contextNames.includes(value) && (
          <option value={value}>{value}</option>
        )}

        {contextNames.map((context) => (
          <option key={context} value={context}>
            {context}
          </option>
        ))}
      </select>

      {creating && (
        <div className="flex gap-2">
          <Input
            value={newContextName}
            onChange={(event) => setNewContextName(event.target.value)}
            placeholder="New context name..."
            className="border-border/70 bg-background"
            autoFocus
          />

          <Button
            type="button"
            disabled={saving || !newContextName.trim()}
            onClick={createContext}
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

export default ContextSelect;
