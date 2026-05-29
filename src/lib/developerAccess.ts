import type { User } from "@supabase/supabase-js";
import type { Workspace } from "@/hooks/useCurrentWorkspace";

const developerEmails = (import.meta.env.VITE_SOFTWARE_DEVELOPER_EMAILS || "")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

export const isSoftwareDeveloper = ({
  user,
  workspace,
}: {
  user: User | null;
  workspace?: Workspace | null;
}) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();
  const emailAllowed = userEmail ? developerEmails.includes(userEmail) : false;

  return emailAllowed || workspace?.owner_user_id === user.id;
};
