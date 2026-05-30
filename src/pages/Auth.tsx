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
  const [googleBusy, setGoogleBusy] = useState(false);

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

  const signInWithGoogle = async () => {
    setGoogleBusy(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast.error(error.message);
      setGoogleBusy(false);
    }
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

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full border-border/80 bg-background/70 font-bold hover:bg-background"
            disabled={googleBusy || busy}
            onClick={signInWithGoogle}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
              />
            </svg>
            {googleBusy ? "Opening Google..." : "Continue with Gmail"}
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
