import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WorkspaceRole = "admin" | "editor" | "group_leader" | "viewer" | "member";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  join_code: string;
  /** Null until someone uploads one in Workspace Settings; printed documents
   *  fall back to the workspace name alone. */
  logo_url: string | null;
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

const EMPTY = { workspace: null, membership: null } as {
  workspace: Workspace | null;
  membership: WorkspaceMember | null;
};

export function useCurrentWorkspace() {
  const { user } = useAuth();

  // AppLayout, AppSidebar and the page itself all mount this hook, so it is
  // shared through React Query rather than a per-component useState/useEffect:
  // one request feeds every caller instead of one request each.
  const query = useQuery({
    queryKey: ["current-workspace", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // The workspace row is embedded through workspace_members_workspace_id_fkey
      // so membership and workspace arrive in one round trip, not two.
      const { data, error } = await (supabase as any)
        .from("workspace_members")
        .select("*, workspaces(*)")
        .eq("auth_user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Workspace membership load error:", error.message);
        return EMPTY;
      }

      if (!data?.workspace_id) return EMPTY;

      const { workspaces, ...membershipRow } = data;

      return {
        workspace: (workspaces as Workspace) || null,
        membership: membershipRow as WorkspaceMember,
      };
    },
  });

  const workspace = query.data?.workspace ?? null;
  const membership = query.data?.membership ?? null;

  // Refetching the single shared observer writes straight to the cache, so every
  // other mounted copy of this hook updates without firing its own request.
  const loadWorkspace = async () => {
    await query.refetch();
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

  const leaveWorkspace = async (targetWorkspaceId?: string) => {
    const workspaceId = targetWorkspaceId || workspace?.id;

    if (!workspaceId) {
      return {
        error: new Error("No active workspace found."),
      };
    }

    const { error } = await (supabase as any).rpc("leave_current_workspace", {
      target_workspace_id: workspaceId,
    });

    if (error) return { error };

    await loadWorkspace();
    return { error: null };
  };

  const role = membership?.role || null;

  return {
    workspace,
    membership,
    loading: query.isLoading,
    reloadWorkspace: loadWorkspace,
    createWorkspace,
    joinWorkspace,
    leaveWorkspace,
    role,
    isAdmin: role === "admin",
    isEditor: role === "editor",
    isGroupLeader: role === "group_leader",
    canManageWorkspace: role === "admin",
    canEditPeopleDirectory: role === "admin" || role === "editor",
    isViewer: role === "viewer",
    isMember: role === "member",
  };
}
