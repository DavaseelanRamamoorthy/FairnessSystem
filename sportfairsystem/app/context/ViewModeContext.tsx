"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";

import { squadAdminEnabled } from "@/app/config/teamConfig";

export type ViewMode = "admin" | "member";

type ViewModeContextValue = {
  canUseAdminMode: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdminMode: boolean;
  isMemberMode: boolean;
};

const STORAGE_KEY = "sportfair-view-mode";

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const canUseAdminMode = squadAdminEnabled;
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") {
      return canUseAdminMode ? "admin" : "member";
    }

    const savedMode = window.localStorage.getItem(STORAGE_KEY);

    if (savedMode === "member") {
      return "member";
    }

    if (savedMode === "admin" && canUseAdminMode) {
      return "admin";
    }

    return canUseAdminMode ? "admin" : "member";
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    const nextMode = mode === "admin" && !canUseAdminMode ? "member" : mode;
    setViewModeState(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
  }, [canUseAdminMode]);

  const value = useMemo(() => ({
    canUseAdminMode,
    viewMode,
    setViewMode,
    isAdminMode: viewMode === "admin" && canUseAdminMode,
    isMemberMode: viewMode === "member" || !canUseAdminMode
  }), [canUseAdminMode, setViewMode, viewMode]);

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);

  if (!context) {
    throw new Error("useViewMode must be used within ViewModeProvider.");
  }

  return context;
}
