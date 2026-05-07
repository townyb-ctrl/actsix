import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) toast.error(error.message);
      else { toast.success("Welcome — check your inbox to confirm."); navigate("/"); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate("/");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-sidebar text-sidebar-foreground relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-teal/20 blur-3xl" />
        <div className="absolute -left-12 bottom-0 h-72 w-72 rounded-full bg-brand-coral/10 blur-3xl" />
        <Logo />
        <div className="relative z-10">
          <p className="text-5xl font-extrabold leading-[1.05] tracking-tight text-balance">
            Organize the work.<br/>
            <span className="text-brand-teal-bright">Serve</span> the word.
          </p>
          <p className="mt-6 text-sm uppercase tracking-[0.2em] text-sidebar-foreground/50 font-semibold">
            A calm command center for ministry work
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/40">© ACTSIX · 2026</div>
      </div>

      <div className="flex items-center justify-center p-8 bg-gradient-content">
        <form onSubmit={handle} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === "signin" ? "Sign in to your workspace." : "Begin organizing your work."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white rounded-full" disabled={busy}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {mode === "signin" ? "No account? Create one." : "Already have an account? Sign in."}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
