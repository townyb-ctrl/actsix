import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Lock, MessageSquare, Upload } from "lucide-react";
import { isSoftwareDeveloper } from "@/lib/developerAccess";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  type ActiveModuleKey,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  REQUIRED_MODULES,
  OPTIONAL_MODULES,
} from "@/lib/modules";
import { isModuleEnabled } from "@/lib/releaseMode";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const { isModuleActive, setModuleActive } = useUserSettings();
  const developer = isSoftwareDeveloper({ user, workspace });
  const settingsModules = [...REQUIRED_MODULES, ...OPTIONAL_MODULES].filter((moduleKey) =>
    isModuleEnabled(moduleKey)
  );

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

        <Card className="border-border/60 p-6 shadow-soft">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-display italic">
            Navigation
          </div>
          <div className="mt-2 font-display text-2xl">Modules</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which ACTSIX modules appear in your left menu. Home, Tasks, and People stay active for every user.
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-border/70">
            {settingsModules.map((moduleKey) => {
              const locked = REQUIRED_MODULES.includes(moduleKey);
              const active = isModuleActive(moduleKey as ActiveModuleKey);

              return (
                <div
                  key={moduleKey}
                  className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold">{MODULE_LABELS[moduleKey]}</p>
                      {locked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          Required
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {MODULE_DESCRIPTIONS[moduleKey]}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setModuleActive(moduleKey as ActiveModuleKey, !active)}
                    className={`flex h-8 w-14 shrink-0 items-center rounded-full border px-1 transition ${
                      active
                        ? "border-brand-teal bg-brand-teal"
                        : "border-border bg-muted"
                    } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
                    aria-label={`${active ? "Deactivate" : "Activate"} ${MODULE_LABELS[moduleKey]}`}
                    aria-pressed={active}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        active ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

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
