import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";

const Settings = () => {
  const { user, signOut } = useAuth();
  return (
    <div>
      <PageHeader eyebrow="Â§ Settings" title="The studio" subtitle="Account and preferences." />
      <div className="w-full space-y-6 px-4 py-10 sm:px-6 xl:px-8 2xl:px-10">
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


