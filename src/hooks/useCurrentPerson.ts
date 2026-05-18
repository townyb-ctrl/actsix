import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CurrentPerson = {
  id: string;
  user_id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  gender: string | null;
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

const splitDisplayName = (displayName: string) => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "User",
      lastName: "",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
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

      const { data: existingPerson, error: existingError } = await (supabase as any)
        .from("people")
        .select("*")
        .eq("user_id", user.id)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (existingError) {
        toast.error(existingError.message);
        if (!cancelled) setLoading(false);
        return;
      }

      if (existingPerson) {
        if (!cancelled) {
          setPerson(existingPerson);
          setLoading(false);
        }
        return;
      }

      const userEmail = user.email?.trim().toLowerCase();

      if (userEmail) {
        const { data: emailMatches, error: emailMatchError } = await (supabase as any)
          .from("people")
          .select("*")
          .eq("user_id", user.id)
          .ilike("email", userEmail);

        if (emailMatchError) {
          toast.error(emailMatchError.message);
          if (!cancelled) setLoading(false);
          return;
        }

        if (emailMatches && emailMatches.length === 1) {
          const matchedPerson = emailMatches[0];

          const { data: linkedPerson, error: linkError } = await (supabase as any)
            .from("people")
            .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
            .eq("id", matchedPerson.id)
            .eq("user_id", user.id)
            .select("*")
            .single();

          if (linkError) {
            toast.error(linkError.message);
            if (!cancelled) setLoading(false);
            return;
          }

          if (!cancelled) {
            setPerson(linkedPerson);
            setLoading(false);
          }
          return;
        }

        if (emailMatches && emailMatches.length > 1) {
          toast.error("Multiple People profiles use your email. Merge duplicates to connect your signed-in profile cleanly.");
          if (!cancelled) {
            setPerson(null);
            setLoading(false);
          }
          return;
        }
      }

      const { firstName, lastName } = splitDisplayName(fallbackName);

      const { data: createdPerson, error: createError } = await (supabase as any)
        .from("people")
        .insert({
          user_id: user.id,
          auth_user_id: user.id,
          first_name: firstName,
          last_name: lastName || null,
          display_name: fallbackName,
          avatar_url: null,
          phone_number: null,
          email: user.email || null,
          gender: null,
          whatsapp_enabled: false,
          notes: "Signed-in ACTSIX user profile",
        })
        .select("*")
        .single();

      if (createError) {
        toast.error(createError.message);
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled) {
        setPerson(createdPerson);
        setLoading(false);
      }
    };

    ensureCurrentPerson();

    return () => {
      cancelled = true;
    };
  }, [user, fallbackName]);

  return {
    person,
    loading,
    displayName: person?.display_name || fallbackName,
  };
}
