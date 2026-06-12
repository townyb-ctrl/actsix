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

const SettingsPage = () => {
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
      <div className="actsix-page-body actsix-page-stack pt-5 pb-10 sm:pt-6">
        {developer && (
          <Card className="actsix-panel-soft border-brand-teal/25 bg-brand-teal/5 p-4 sm:p-5">
            <div className="label-eyebrow text-brand-teal">
              Software Developer
            </div>
            <div className="mt-1.5 text-xl font-extrabold tracking-tight">Alpha Feedback</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Review comments submitted by alpha testers from the floating feedback chat.
            </p>
            <Button
              asChild
              variant="outline"
              className="actsix-btn-outline mt-4 gap-2 border-brand-teal/30 text-brand-teal hover:text-brand-teal"
            >
              <a href="/settings/alpha-feedback">
                <MessageSquare className="h-4 w-4" />
                Open Alpha Feedback
              </a>
            </Button>
          </Card>
        )}

        <Card className="actsix-panel-soft border-border/60 p-4 sm:p-5">
          <div className="label-eyebrow">
            Navigation
          </div>
          <div className="mt-1.5 text-xl font-extrabold tracking-tight">Modules</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which ACTSIX modules appear in your left menu. Home, Tasks, and People stay active for every user.
            Groups is its own module and starts active for every workspace.
          </p>

          <div className="mt-4 overflow-hidden rounded-[var(--radius-panel)] border border-border/70">
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

        <Card className="actsix-panel-soft border-border/60 p-4 sm:p-5">
          <div className="label-eyebrow">
            Admin
          </div>
          <div className="mt-1.5 text-xl font-extrabold tracking-tight">Workspace Settings</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your church workspace, join code, secret phrase, and member roles.
          </p>
          <Button asChild variant="outline" className="actsix-btn-outline mt-4">
            <a href="/settings/workspace">Open Workspace Settings</a>
          </Button>
        </Card>

        <Card className="actsix-panel-soft border-border/60 p-4 sm:p-5">
          <div className="label-eyebrow">
            Data
          </div>
          <div className="mt-1.5 text-xl font-extrabold tracking-tight">Import and export</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage ACTSIX data movement from one place instead of showing these tools across every module.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="actsix-btn-outline gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="actsix-btn-outline gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </div>
        </Card>

        <Card className="actsix-panel-soft border-border/60 p-4 sm:p-5">
          <div className="label-eyebrow">Account</div>
          <div className="mt-1.5 text-xl font-extrabold tracking-tight">{user?.email}</div>
          <Button variant="outline" className="actsix-btn-outline mt-4" onClick={signOut}>Sign out</Button>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
