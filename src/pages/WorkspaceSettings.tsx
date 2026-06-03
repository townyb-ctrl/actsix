import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  auth_user_id: string;
  person_id: string | null;
  role: string;
  status: string;
  created_at: string;
  person_name: string | null;
  person_email: string | null;
};

const roleOptions = ["admin", "editor", "group_leader", "member", "viewer"];

const formatRoleLabel = (role: string) =>
  role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const WorkspaceSettings = () => {
  const navigate = useNavigate();
  const { workspace, role, isAdmin, loading, leaveWorkspace } = useCurrentWorkspace();
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [joinPhrase, setJoinPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const joinCode = workspace?.join_code || "";

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [members]);

  const loadMembers = async () => {
    if (!workspace || !isAdmin) return;

    const { data, error } = await (supabase as any).rpc(
      "get_workspace_members_for_current_user",
      {
        target_workspace_id: workspace.id,
      }
    );

    if (error) {
      toast.error(error.message);
      return;
    }

    setMembers(data || []);
  };

  useEffect(() => {
    loadMembers();
  }, [workspace?.id, isAdmin]);

  const copyJoinCode = async () => {
    if (!joinCode) return;

    await navigator.clipboard.writeText(joinCode);
    toast.success("Join code copied");
  };

  const updateJoinPhrase = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!workspace) return;

    if (joinPhrase.trim().length < 6) {
      toast.error("Use at least 6 characters for the secret phrase.");
      return;
    }

    setBusy(true);

    const { error } = await (supabase as any).rpc("update_workspace_join_phrase", {
      target_workspace_id: workspace.id,
      new_join_phrase: joinPhrase.trim(),
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setJoinPhrase("");
    toast.success("Secret phrase updated");
  };

  const updateRole = async (memberId: string, nextRole: string) => {
    const { error } = await (supabase as any).rpc("update_workspace_member_role", {
      target_member_id: memberId,
      next_role: nextRole,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Member role updated");
    loadMembers();
  };

  const handleLeaveWorkspace = async () => {
    if (!workspace) return;

    const confirmed = window.confirm(
      `Leave ${workspace.name}? You will lose access to this workspace unless an admin invites you again.`
    );

    if (!confirmed) return;

    setLeaving(true);

    const { error } = await leaveWorkspace(workspace.id);

    setLeaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("You left the workspace");
    navigate("/workspace-setup", { replace: true });
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="ACTSIX"
          title="Workspace Settings"
          subtitle="Loading workspace..."
        />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div>
        <PageHeader
          eyebrow="ACTSIX"
          title="Workspace Settings"
          subtitle="Create or join a workspace first."
        />

        <div className="px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
          <Card className="max-w-2xl border-border/70 bg-card p-6 shadow-card">
            <p className="text-sm text-muted-foreground">
              You are not connected to a church workspace yet.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX Admin"
        title="Workspace Settings"
        subtitle="Manage Alpha workspace access, secret phrase, and workspace roles."
      />

      <div className="grid w-full min-w-0 gap-4 px-4 pb-12 sm:px-6 md:gap-6 lg:grid-cols-[0.9fr_1.1fr] xl:px-8 2xl:px-10">
        <div className="space-y-4 md:space-y-6">
          <Card className="border-border/70 bg-card p-4 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-brand-teal/10 p-3 text-brand-teal">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <p className="label-eyebrow">Workspace</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                  {workspace.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your role: <span className="font-bold capitalize">{role}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
              <div>
                <p className="label-eyebrow">Release Mode</p>
                <p className="mt-1 text-sm font-bold capitalize">
                  {workspace.release_mode}
                </p>
              </div>

              <div>
                <p className="label-eyebrow">Join Code</p>
                <div className="mt-2 flex gap-2">
                  <Input value={joinCode} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={copyJoinCode}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border/70 bg-card p-4 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-brand-teal/10 p-3 text-brand-teal">
                <KeyRound className="h-5 w-5" />
              </div>

              <div>
                <p className="label-eyebrow">Join Access</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  Update secret phrase
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This phrase is required when someone joins your church workspace.
                </p>
              </div>
            </div>

            <form onSubmit={updateJoinPhrase} className="mt-5 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="joinPhrase">New Secret Phrase</Label>
                <Input
                  id="joinPhrase"
                  value={joinPhrase}
                  onChange={(event) => setJoinPhrase(event.target.value)}
                  placeholder="Example: forward-with-god"
                  disabled={!isAdmin}
                />
              </div>

              <Button
                type="submit"
                className="actsix-btn-primary rounded-xl"
                disabled={!isAdmin || busy}
              >
                Update Secret Phrase
              </Button>

              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Only workspace admins can change join access.
                </p>
              )}
            </form>
          </Card>

          <Card className="border-border/70 bg-card p-4 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-destructive/10 p-3 text-destructive">
                <LogOut className="h-5 w-5" />
              </div>

              <div>
                <p className="label-eyebrow">Workspace Access</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  Leave this workspace
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This removes your access to the current workspace. Your previous activity and records remain in the workspace history.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-5 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLeaveWorkspace}
              disabled={leaving}
            >
              <LogOut className="h-4 w-4" />
              {leaving ? "Leaving..." : "Leave Workspace"}
            </Button>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Workspace owners and the last active admin cannot leave until ownership/admin coverage is handled.
            </p>
          </Card>

        </div>

        <Card className="border-border/70 bg-card p-4 shadow-card sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="label-eyebrow">Workspace Roles</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Workspace Roles
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Assign admin, editor, group leader, member, or viewer access for the Alpha workspace.
              </p>
            </div>

            <div className="rounded-2xl bg-brand-teal/10 p-3 text-brand-teal">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>

          {!isAdmin && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              Only workspace admins can view and manage workspace roles.
            </div>
          )}

          {isAdmin && members.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
              No workspace users found yet.
            </div>
          )}

          {isAdmin && members.length > 0 && (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
              {sortedMembers.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-3 bg-card px-3 py-3 md:grid-cols-[1fr_180px] md:px-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold tracking-tight">
                      {member.person_name || "ACTSIX User"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {member.person_email || member.auth_user_id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <select
                    value={member.role}
                    onChange={(event) => updateRole(member.id, event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold capitalize outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatRoleLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WorkspaceSettings;
