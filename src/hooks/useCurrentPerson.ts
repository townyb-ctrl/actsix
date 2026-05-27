import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CurrentPerson = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  auth_user_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const titleCaseEmailName = (email?: string | null) => {
  const fallback = "User";
  const emailName = email?.split("@")[0] || fallback;

  return (
    emailName
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || fallback
  );
};

export function useCurrentPerson() {
  const { user } = useAuth();
  const [person, setPerson] = useState<CurrentPerson | null>(null);
  const [loading, setLoading] = useState(true);

  const fallbackName = useMemo(() => titleCaseEmailName(user?.email), [user?.email]);

  useEffect(() => {
    if (!user) {
      setPerson(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const ensureCurrentPerson = async () => {
      setLoading(true);

      const { data, error } = await (supabase as any).rpc(
        "ensure_current_workspace_person"
      );

      if (error) {
        toast.error(error.message);
        if (!cancelled) {
          setPerson(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setPerson(data || null);
        setLoading(false);
      }
    };

    ensureCurrentPerson();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    person,
    loading,
    displayName: person?.display_name || fallbackName,
  };
}
