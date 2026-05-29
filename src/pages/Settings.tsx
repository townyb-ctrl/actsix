import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, MessageSquare, Upload } from "lucide-react";
import { isSoftwareDeveloper } from "@/lib/developerAccess";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const developer = isSoftwareDeveloper({ user, workspace });

  return (
    <div>
      <PageHeader eyebrow="Settings" title="The studio" subtitle="Account and preferences." />
      <div className="w-full space-y-6 px-4 py-10 sm:px-6 xl:px-8 2xl:px-10">
        {developer && (
          <Card className="p-6 shadow-soft border-brand-teal/25 bg-brand-teal/5">
            <div className="text-xs uppercase tracking-[0.2em] text-brand-teal font-display italic">
              Software Developer
            </div>
            <div className="mt-2 font-display text-2xl">Alpha Feedback</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Review comments submitted by alpha testers from the floating feedback chat.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-6 gap-2 rounded-xl border-brand-teal/30 text-brand-teal hover:bg-brand-teal/10 hover:text-brand-teal"
            >
              <a href="/settings/alpha-feedback">
                <MessageSquare className="h-4 w-4" />
                Open Alpha Feedback
              </a>
            </Button>
          </Card>
        )}

        <Card className="p-6 shadow-soft border-border/60">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-display italic">
            Admin
          </div>
          <div className="mt-2 font-display text-2xl">Workspace Settings</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your church workspace, join code, secret phrase, and member roles.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="/settings/workspace">Open Workspace Settings</a>
          </Button>
        </Card>

        <Card className="p-6 shadow-soft border-border/60">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-display italic">
            Data
          </div>
          <div className="mt-2 font-display text-2xl">Import and export</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage ACTSIX data movement from one place instead of showing these tools across every module.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="rounded-xl gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </div>
        </Card>

        <Card className="p-6 shadow-soft border-border/60">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-display italic">Account</div>
          <div className="mt-2 font-display text-2xl">{user?.email}</div>
          <Button variant="outline" className="mt-6" onClick={signOut}>Sign out</Button>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
