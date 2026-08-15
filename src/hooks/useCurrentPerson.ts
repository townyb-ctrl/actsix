import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const fallbackName = useMemo(() => titleCaseEmailName(user?.email), [user?.email]);

  // Shared through React Query so the layout, the sidebar and the page each read
  // one cached result instead of each firing its own ensure RPC.
  const query = useQuery({
    queryKey: ["current-person", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "ensure_current_workspace_person"
      );

      if (error) {
        toast.error(error.message);
        return null;
      }

      return (data as CurrentPerson) || null;
    },
  });

  const person = query.data ?? null;

  return {
    person,
    loading: query.isLoading,
    displayName: person?.display_name || fallbackName,
  };
}
