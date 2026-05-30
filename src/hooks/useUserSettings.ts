import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  type ActiveModuleKey,
  DEFAULT_ACTIVE_MODULES,
  normalizeActiveModules,
} from "@/lib/modules";

export type TourKey = ActiveModuleKey;

type OnboardingSettings = {
  homeTourComplete: boolean;
  completedModuleTours: Partial<Record<TourKey, boolean>>;
};

export type ActsixUserSettings = {
  onboarding: OnboardingSettings;
  modules: Record<ActiveModuleKey, boolean>;
};

const DEFAULT_USER_SETTINGS: ActsixUserSettings = {
  onboarding: {
    homeTourComplete: false,
    completedModuleTours: {},
  },
  modules: DEFAULT_ACTIVE_MODULES,
};

const USER_SETTINGS_UPDATED_EVENT = "actsix:user-settings-updated";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const normalizeUserSettings = (value: unknown): ActsixUserSettings => {
  if (!isRecord(value)) return DEFAULT_USER_SETTINGS;

  const onboarding = isRecord(value.onboarding) ? value.onboarding : {};
  const completedModuleTours = isRecord(onboarding.completedModuleTours)
    ? onboarding.completedModuleTours
    : {};
  const modules = isRecord(value.modules) ? value.modules : {};

  return {
    onboarding: {
      homeTourComplete: Boolean(onboarding.homeTourComplete),
      completedModuleTours: completedModuleTours as Partial<Record<TourKey, boolean>>,
    },
    modules: normalizeActiveModules(modules as Partial<Record<ActiveModuleKey, boolean>>),
  };
};

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ActsixUserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setSettings(DEFAULT_USER_SETTINGS);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from("user_settings")
        .select("settings")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Could not load user settings", error.message);
        setSettings(DEFAULT_USER_SETTINGS);
      } else {
        setSettings(normalizeUserSettings(data?.settings));
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      setSettings(normalizeUserSettings((event as CustomEvent<ActsixUserSettings>).detail));
    };

    window.addEventListener(USER_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => window.removeEventListener(USER_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
  }, []);

  const saveSettings = useCallback(
    async (nextSettings: ActsixUserSettings) => {
      if (!user) return;

      const normalized = normalizeUserSettings(nextSettings);
      setSettings(normalized);
      window.dispatchEvent(new CustomEvent(USER_SETTINGS_UPDATED_EVENT, { detail: normalized }));

      const { error } = await (supabase as any).from("user_settings").upsert(
        {
          user_id: user.id,
          settings: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("Could not save user settings", error.message);
      }
    },
    [user]
  );

  const setModuleActive = useCallback(
    async (moduleKey: ActiveModuleKey, active: boolean) => {
      if (moduleKey === "home" || moduleKey === "tasks" || moduleKey === "people") return;

      await saveSettings({
        ...settings,
        modules: normalizeActiveModules({
          ...settings.modules,
          [moduleKey]: active,
        }),
      });
    },
    [saveSettings, settings]
  );

  const completeTour = useCallback(
    async (tourKey: TourKey) => {
      const nextOnboarding =
        tourKey === "home"
          ? {
              ...settings.onboarding,
              homeTourComplete: true,
            }
          : {
              ...settings.onboarding,
              completedModuleTours: {
                ...settings.onboarding.completedModuleTours,
                [tourKey]: true,
              },
            };

      await saveSettings({
        ...settings,
        onboarding: nextOnboarding,
      });
    },
    [saveSettings, settings]
  );

  const isModuleActive = useCallback(
    (moduleKey: ActiveModuleKey) => normalizeActiveModules(settings.modules)[moduleKey],
    [settings.modules]
  );

  return useMemo(
    () => ({
      settings,
      loading,
      isModuleActive,
      setModuleActive,
      completeTour,
    }),
    [completeTour, isModuleActive, loading, setModuleActive, settings]
  );
};
