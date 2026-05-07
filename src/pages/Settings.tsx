import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Settings = () => {
  const { user, signOut } = useAuth();
  return (
    <div>
      <PageHeader eyebrow="§ Settings" title="The studio" subtitle="Account and preferences." />
      <div className="px-8 py-10 max-w-2xl space-y-6">
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
