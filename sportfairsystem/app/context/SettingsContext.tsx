"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { AppearancePresetKey, getAppearancePreset } from "@/app/themes/minimal/appearance-presets";

export type ThemeModePreference = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";

type SettingsContextValue = {
  themeMode: ThemeModePreference;
  resolvedThemeMode: ResolvedThemeMode;
  setThemeMode: (mode: ThemeModePreference) => void;
  appearancePreset: AppearancePresetKey;
  setAppearancePreset: (preset: AppearancePresetKey) => void;
  compactMode: boolean;
  setCompactMode: (value: boolean) => void;
  isSettingsReady: boolean;
};

const STORAGE_KEY = "sportfairsystem:theme-mode";
const APPEARANCE_STORAGE_KEY = "sportfairsystem:appearance-preset";
const DENSITY_STORAGE_KEY = "sportfairsystem:compact-mode";

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeModePreference>("system");
  const [resolvedThemeMode, setResolvedThemeMode] = useState<ResolvedThemeMode>("light");
  const [appearancePreset, setAppearancePresetState] = useState<AppearancePresetKey>("jersey");
  const [compactMode, setCompactModeState] = useState(false);
  const [isSettingsReady, setIsSettingsReady] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const savedMode = window.localStorage.getItem(STORAGE_KEY);

      if (savedMode === "light" || savedMode === "dark" || savedMode === "system") {
        setThemeModeState(savedMode);
      }

      const savedAppearancePreset = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (
        savedAppearancePreset === "jersey"
        || savedAppearancePreset === "emerald"
        || savedAppearancePreset === "sunset"
        || savedAppearancePreset === "slate"
        || savedAppearancePreset === "volt-noir"
      ) {
        setAppearancePresetState(savedAppearancePreset);
      }

      setCompactModeState(window.localStorage.getItem(DENSITY_STORAGE_KEY) === "true");

      const systemDarkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedThemeMode(systemDarkModeQuery.matches ? "dark" : "light");
      setIsSettingsReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const systemDarkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncResolvedThemeMode = () => {
      setResolvedThemeMode(systemDarkModeQuery.matches ? "dark" : "light");
    };

    syncResolvedThemeMode();
    systemDarkModeQuery.addEventListener("change", syncResolvedThemeMode);

    return () => {
      systemDarkModeQuery.removeEventListener("change", syncResolvedThemeMode);
    };
  }, []);

  useEffect(() => {
    if (!isSettingsReady) {
      return;
    }

    const activeMode = themeMode === "system" ? resolvedThemeMode : themeMode;
    const preset = getAppearancePreset(appearancePreset);
    document.documentElement.setAttribute("data-color-scheme", activeMode);
    document.documentElement.setAttribute("data-density", compactMode ? "compact" : "comfortable");
    document.documentElement.style.colorScheme = activeMode;
    document.documentElement.style.setProperty("--app-header-start", preset.header.start);
    document.documentElement.style.setProperty("--app-header-mid", preset.header.mid);
    document.documentElement.style.setProperty("--app-header-end", preset.header.end);
    document.documentElement.style.setProperty("--app-accent-main", preset.palette.primary.main);
    document.documentElement.style.setProperty("--app-accent-dark", preset.palette.primary.dark);
    document.documentElement.style.setProperty("--app-accent-soft", preset.palette.primary.lighter);
    document.documentElement.style.setProperty("--app-danger-main", preset.palette.error.main);
    document.documentElement.style.setProperty("--app-danger-soft", preset.palette.error.lighter);
    document.documentElement.style.setProperty("--app-warning-main", preset.palette.warning.main);
    document.documentElement.style.setProperty("--app-warning-soft", preset.palette.warning.lighter);
  }, [appearancePreset, compactMode, isSettingsReady, resolvedThemeMode, themeMode]);

  const setThemeMode = (mode: ThemeModePreference) => {
    setThemeModeState(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  };

  const setAppearancePreset = (preset: AppearancePresetKey) => {
    setAppearancePresetState(preset);
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preset);
  };

  const setCompactMode = (value: boolean) => {
    setCompactModeState(value);
    window.localStorage.setItem(DENSITY_STORAGE_KEY, String(value));
  };

  const value = useMemo<SettingsContextValue>(
    () => ({
      themeMode,
      resolvedThemeMode,
      setThemeMode,
      appearancePreset,
      setAppearancePreset,
      compactMode,
      setCompactMode,
      isSettingsReady
    }),
    [themeMode, resolvedThemeMode, appearancePreset, compactMode, isSettingsReady]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider.");
  }

  return context;
}
