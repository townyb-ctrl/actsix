import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2, KeyRound, LogIn, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

const WorkspaceSetup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspace, loading, createWorkspace, joinWorkspace } = useCurrentWorkspace();

  const [mode, setMode] = useState<"create" | "join">("join");
  const [churchName, setChurchName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPhrase, setJoinPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestedJoinCode = useMemo(() => {
    return churchName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 18);
  }, [churchName]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (!loading && workspace) return <Navigate to="/" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);

    if (mode === "create") {
      if (!churchName.trim() || !joinPhrase.trim()) {
        toast.error("Church name and join phrase are required.");
        setBusy(false);
        return;
      }

      const { error } = await createWorkspace({
        name: churchName.trim(),
        joinCode: joinCode.trim() || suggestedJoinCode,
        joinPhrase: joinPhrase.trim(),
      });

      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }

      toast.success("Church workspace created");
      navigate("/");
      return;
    }

    if (!joinCode.trim() || !joinPhrase.trim()) {
      toast.error("Join code and secret phrase are required.");
      setBusy(false);
      return;
    }

    const { error } = await joinWorkspace({
      joinCode: joinCode.trim(),
      joinPhrase: joinPhrase.trim(),
    });

    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }

    toast.success("Joined workspace");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-content px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-card p-6 shadow-card">
            <p className="label-eyebrow">ACTSIX Workspace</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
              Connect to your church
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              ACTSIX is organized around a church workspace. Create a workspace
              if you are setting up ACTSIX for your church, or join one using
              the code and secret phrase from your admin.
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => setMode("join")}
                className={`rounded-2xl border p-4 text-left transition ${
                  mode === "join"
                    ? "border-brand-teal bg-brand-teal/10"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-brand-teal" />
                  <div>
                    <p className="font-extrabold tracking-tight">Join a church</p>
                    <p className="text-xs text-muted-foreground">
                      Use a join code and secret phrase.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("create")}
                className={`rounded-2xl border p-4 text-left transition ${
                  mode === "create"
                    ? "border-brand-teal bg-brand-teal/10"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-brand-teal" />
                  <div>
                    <p className="font-extrabold tracking-tight">Create a church workspace</p>
                    <p className="text-xs text-muted-foreground">
                      For admins setting up ACTSIX.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </Card>

          <Card className="border-border/70 bg-card p-6 shadow-card">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="label-eyebrow">
                  {mode === "create" ? "Create Workspace" : "Join Workspace"}
                </p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                  {mode === "create" ? "Register your church" : "Enter church access details"}
                </h2>
              </div>

              {mode === "create" && (
                <div className="space-y-2">
                  <Label htmlFor="churchName">Church / Organization Name</Label>
                  <Input
                    id="churchName"
                    value={churchName}
                    onChange={(event) => {
                      setChurchName(event.target.value);
                      setJoinCode("");
                    }}
                    placeholder="Somerset West Baptist Church"
                    required={mode === "create"}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="joinCode">Join Code</Label>
                <Input
                  id="joinCode"
                  value={joinCode || (mode === "create" ? suggestedJoinCode : "")}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="SWBC-CPT"
                  required
                />
                {mode === "create" && (
                  <p className="text-xs text-muted-foreground">
                    Share this with people who need to join your church workspace.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinPhrase">Secret Phrase</Label>
                <Input
                  id="joinPhrase"
                  value={joinPhrase}
                  onChange={(event) => setJoinPhrase(event.target.value)}
                  placeholder="Chosen by the church admin"
                  required
                />
              </div>

              <Button
                type="submit"
                className="actsix-btn-primary w-full rounded-xl"
                disabled={busy}
              >
                {mode === "create" ? <Plus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {busy
                  ? "Working..."
                  : mode === "create"
                    ? "Create Workspace"
                    : "Join Workspace"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
