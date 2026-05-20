import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";

export type WorkspaceRole = "admin" | "scheduler" | "editor" | "viewer" | "member";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  join_code: string;
  owner_user_id: string;
  release_mode: "alpha" | "beta" | "full" | string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  auth_user_id: string;
  person_id: string | null;
  role: WorkspaceRole | string;
  status: string;
  created_at: string;
  updated_at: string;
};

const createWorkspaceSlug = (email?: string | null, userId?: string) => {
  const prefix = (email?.split("@")[0] || "actsix")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  return `${prefix || "actsix"}-${userId?.slice(0, 8) || Date.now()}`;
};

const createJoinCode = (userId: string) => {
  return `ACTSIX-${userId.slice(0, 8).toUpperCase()}`;
};

export function useCurrentWorkspace() {
  const { user } = useAuth();
  const { person } = useCurrentPerson();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = membership?.role === "admin";
  const isScheduler = membership?.role === "scheduler";
  const isEditor = membership?.role === "editor";
  const isViewer = membership?.role === "viewer";
  const isMember = membership?.role === "member";

  const loadWorkspace = async () => {
    if (!user) {
      setWorkspace(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: existingMembership, error: membershipError } = await (supabase as any)
      .from("workspace_members")
      .select("*")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("Workspace membership load error:", membershipError.message);
      setLoading(false);
      return;
    }

    if (existingMembership?.workspace_id) {
      const { data: existingWorkspace, error: workspaceError } = await (supabase as any)
        .from("workspaces")
        .select("*")
        .eq("id", existingMembership.workspace_id)
        .maybeSingle();

      if (workspaceError) {
        console.error("Workspace load error:", workspaceError.message);
        setLoading(false);
        return;
      }

      setWorkspace(existingWorkspace || null);
      setMembership(existingMembership || null);
      setLoading(false);
      return;
    }

    const workspaceName = user.user_metadata?.church_name || "ACTSIX Alpha Workspace";
    const slug = createWorkspaceSlug(user.email, user.id);
    const joinCode = createJoinCode(user.id);

    const { data: newWorkspace, error: createWorkspaceError } = await (supabase as any)
      .from("workspaces")
      .insert({
        name: workspaceName,
        slug,
        join_code: joinCode,
        owner_user_id: user.id,
        release_mode: "alpha",
      })
      .select("*")
      .single();

    if (createWorkspaceError) {
      console.error("Workspace create error:", createWorkspaceError.message);
      setLoading(false);
      return;
    }

    const { data: newMembership, error: createMembershipError } = await (supabase as any)
      .from("workspace_members")
      .insert({
        workspace_id: newWorkspace.id,
        auth_user_id: user.id,
        person_id: person?.id || null,
        role: "admin",
        status: "active",
      })
      .select("*")
      .single();

    if (createMembershipError) {
      console.error("Workspace membership create error:", createMembershipError.message);
      setLoading(false);
      return;
    }

    setWorkspace(newWorkspace);
    setMembership(newMembership);
    setLoading(false);
  };

  useEffect(() => {
    loadWorkspace();
  }, [user?.id, person?.id]);

  return {
    workspace,
    membership,
    loading,
    reloadWorkspace: loadWorkspace,
    role: membership?.role || null,
    isAdmin,
    isScheduler,
    isEditor,
    isViewer,
    isMember,
  };
}
