import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, LogIn, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

const ALPHA_WORKSPACE_NAME = "Alpha Testing Workspace";
const ALPHA_JOIN_CODE = "ACTSIX-ALPHA";

const WorkspaceSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from || "/";
  const { user, loading: authLoading } = useAuth();
  const { workspace, loading, joinWorkspace } = useCurrentWorkspace();

  const [joinPhrase, setJoinPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (!loading && workspace) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!joinPhrase.trim()) {
      toast.error("Please enter the Alpha Testing secret phrase.");
      return;
    }

    setBusy(true);

    const { error } = await joinWorkspace({
      joinCode: ALPHA_JOIN_CODE,
      joinPhrase: joinPhrase.trim(),
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Joined the Alpha Testing Workspace");
    navigate(redirectTo);
  };

  return (
    <div className="min-h-screen bg-gradient-content px-5 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-card p-6 shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-teal/15 bg-brand-teal/10 text-brand-teal">
              <UsersRound className="h-6 w-6" />
            </div>

            <p className="label-eyebrow mt-6">ACTSIX Alpha</p>

            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
              Join the Alpha Testing Workspace
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              For the Alpha phase, all testers are joining one shared ACTSIX workspace.
              This helps us test the same workflows, find friction quickly, and keep feedback focused.
            </p>

            <div className="mt-6 rounded-2xl border border-brand-teal/15 bg-brand-teal/8 p-4">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" />
                <div>
                  <p className="font-extrabold tracking-tight">
                    Workspace access is controlled
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Your Alpha link lets testers sign up. The secret phrase confirms they belong in the Alpha group.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border/70 bg-card p-6 shadow-card">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="label-eyebrow">Join Workspace</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                  Enter Alpha access details
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  You are joining <span className="font-bold text-foreground">{ALPHA_WORKSPACE_NAME}</span>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinCode">Join Code</Label>
                <Input
                  id="joinCode"
                  value={ALPHA_JOIN_CODE}
                  readOnly
                  className="font-bold tracking-wide text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinPhrase">Alpha Secret Phrase</Label>
                <Input
                  id="joinPhrase"
                  value={joinPhrase}
                  onChange={(event) => setJoinPhrase(event.target.value)}
                  placeholder="Enter the phrase Brandon gave you"
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="actsix-btn-primary w-full rounded-xl"
                disabled={busy}
              >
                <LogIn className="h-4 w-4" />
                {busy ? "Joining..." : "Join Alpha Workspace"}
              </Button>

              <p className="text-center text-xs leading-5 text-muted-foreground">
                If you do not have the secret phrase, ask Brandon before continuing.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
