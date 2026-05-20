import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

export function useCurrentWorkspace() {
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

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
      setWorkspace(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    if (!existingMembership?.workspace_id) {
      setWorkspace(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const { data: existingWorkspace, error: workspaceError } = await (supabase as any)
      .from("workspaces")
      .select("*")
      .eq("id", existingMembership.workspace_id)
      .maybeSingle();

    if (workspaceError) {
      console.error("Workspace load error:", workspaceError.message);
      setWorkspace(null);
      setMembership(existingMembership || null);
      setLoading(false);
      return;
    }

    setWorkspace(existingWorkspace || null);
    setMembership(existingMembership || null);
    setLoading(false);
  };

  const createWorkspace = async ({
    name,
    joinCode,
    joinPhrase,
  }: {
    name: string;
    joinCode: string;
    joinPhrase: string;
  }) => {
    const { error } = await (supabase as any).rpc("create_workspace_for_current_user", {
      workspace_name: name,
      workspace_join_code: joinCode,
      workspace_join_phrase: joinPhrase,
    });

    if (error) return { error };

    await loadWorkspace();
    return { error: null };
  };

  const joinWorkspace = async ({
    joinCode,
    joinPhrase,
  }: {
    joinCode: string;
    joinPhrase: string;
  }) => {
    const { error } = await (supabase as any).rpc("join_workspace_by_code", {
      workspace_join_code: joinCode,
      workspace_join_phrase: joinPhrase,
    });

    if (error) return { error };

    await loadWorkspace();
    return { error: null };
  };

  useEffect(() => {
    loadWorkspace();
  }, [user?.id]);

  const role = membership?.role || null;

  return {
    workspace,
    membership,
    loading,
    reloadWorkspace: loadWorkspace,
    createWorkspace,
    joinWorkspace,
    role,
    isAdmin: role === "admin",
    isScheduler: role === "scheduler",
    isEditor: role === "editor",
    isViewer: role === "viewer",
    isMember: role === "member",
  };
}
