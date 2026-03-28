"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, Button, CircularProgress, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { varAlpha } from "minimal-shared/utils";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import ReleaseIntroDialog from "@/app/components/common/ReleaseIntroDialog";
import SettingsDrawer from "@/app/components/settings/SettingsDrawer";
import { useAuth } from "@/app/context/AuthContext";
import {
  getCurrentWorkspaceAccessSnapshot
} from "@/app/services/accessControlService";
import MobileBottomNav from "./MobileBottomNav";
import MobileMoreSheet from "./MobileMoreSheet";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const PUBLIC_ROUTES = ["/login", "/signup", "/reset-password", "/accept-invite"];
const ADMIN_ONLY_ROUTES = ["/configure"];
const MEMBERSHIP_ONLY_ROUTES = ["/memberships"];
const PLANNER_ONLY_ROUTES = ["/planner"];
const ANALYTICS_ONLY_ROUTES = ["/analytics"];
const VALIDATION_ONLY_ROUTES = ["/validation"];
const MATCH_ADMIN_ONLY_ROUTES = ["/upload"];
const RELEASE_INTRO_VERSION = "v1.0";

function getReleaseIntroStorageKey(userId: string) {
  return `sportfairsystem:intro:${RELEASE_INTRO_VERSION}:dismissed:${userId}`;
}

function getReleaseIntroSessionKey(userId: string) {
  return `sportfairsystem:intro:${RELEASE_INTRO_VERSION}:seen:${userId}`;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {

  const [collapsed, setCollapsed] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [dontShowReleaseIntroAgain, setDontShowReleaseIntroAgain] = useState(false);
  const [canSeeFairness, setCanSeeFairness] = useState(false);
  const [canAccessMemberships, setCanAccessMemberships] = useState(false);
  const [canAccessPlanner, setCanAccessPlanner] = useState(false);
  const [canAccessAnalytics, setCanAccessAnalytics] = useState(false);
  const [canAccessValidation, setCanAccessValidation] = useState(false);
  const [canManageMatches, setCanManageMatches] = useState(false);
  const [hasResolvedWorkspaceAccess, setHasResolvedWorkspaceAccess] = useState(false);
  const [, setReleaseIntroVisibilityVersion] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobileShell = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });
  const {
    isLoading,
    isAuthenticated,
    isProfileComplete,
    profile,
    profileError,
    signOut
  } = useAuth();
  const isMatchesPage = pathname === "/matches";
  const useDesktopMatchesLayout = !isMobileShell && isMatchesPage;
  const isEntryAuthRoute = pathname === "/login" || pathname === "/signup";
  const isProfileRoute = pathname === "/profile";
  const hasTeam = Boolean(profile?.teamId);
  const isPublicRoute = useMemo(
    () => PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isAdminRoute = useMemo(
    () => ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isFairnessLeadershipDetailRoute = useMemo(
    () => pathname.startsWith("/fairness/member/"),
    [pathname]
  );
  const isMembershipRoute = useMemo(
    () => MEMBERSHIP_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isPlannerRoute = useMemo(
    () => PLANNER_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isAnalyticsRoute = useMemo(
    () => ANALYTICS_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isValidationRoute = useMemo(
    () => VALIDATION_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isMatchAdminRoute = useMemo(
    () => MATCH_ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const nextPath = searchParams.get("next");
  const safeNextPath = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : null;

  useEffect(() => {
    let isActive = true;

    if (!isAuthenticated) {
      return () => {
        isActive = false;
      };
    }

    const loadWorkspaceVisibility = async () => {
      try {
        const workspaceAccess = await getCurrentWorkspaceAccessSnapshot();

        if (isActive) {
          setCanSeeFairness(workspaceAccess.canSeeFairness);
          setCanAccessMemberships(workspaceAccess.canAccessMemberships);
          setCanAccessPlanner(workspaceAccess.canAccessPlanner);
          setCanAccessAnalytics(workspaceAccess.canAccessAnalytics);
          setCanAccessValidation(workspaceAccess.canAccessValidation);
          setCanManageMatches(workspaceAccess.canManageMatches);
          setHasResolvedWorkspaceAccess(true);
        }
      } catch {
        if (isActive) {
          setCanSeeFairness(false);
          setCanAccessMemberships(false);
          setCanAccessPlanner(false);
          setCanAccessAnalytics(false);
          setCanAccessValidation(false);
          setCanManageMatches(false);
          setHasResolvedWorkspaceAccess(true);
        }
      }
    };

    void loadWorkspaceVisibility();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, profile?.id, profile?.teamId]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isEntryAuthRoute) {
      router.replace(safeNextPath ?? (isProfileComplete && profile?.teamId ? "/dashboard" : "/profile"));
      return;
    }

    if (isAuthenticated && (!isProfileComplete || !profile?.teamId) && !isProfileRoute && !isPublicRoute) {
      router.replace("/profile");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isMembershipRoute && !canAccessMemberships) {
      router.replace("/dashboard");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isPlannerRoute && !canAccessPlanner) {
      router.replace("/dashboard");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isAnalyticsRoute && !canAccessAnalytics) {
      router.replace("/dashboard");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isValidationRoute && !canAccessValidation) {
      router.replace("/dashboard");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isMatchAdminRoute && !canManageMatches) {
      router.replace("/dashboard");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isAdminRoute && !canAccessMemberships) {
      router.replace("/dashboard");
      return;
    }

    if (isAuthenticated && hasResolvedWorkspaceAccess && isFairnessLeadershipDetailRoute && !canSeeFairness) {
      router.replace("/dashboard");
    }
  }, [
    canAccessAnalytics,
    canAccessMemberships,
    canAccessPlanner,
    canAccessValidation,
    canManageMatches,
    canSeeFairness,
    hasResolvedWorkspaceAccess,
    isAdminRoute,
    isAnalyticsRoute,
    isAuthenticated,
    isEntryAuthRoute,
    isFairnessLeadershipDetailRoute,
    isMatchAdminRoute,
    isMembershipRoute,
    isPlannerRoute,
    isLoading,
    isProfileComplete,
    isProfileRoute,
    isPublicRoute,
    isValidationRoute,
    profile?.teamId,
    router,
    safeNextPath
  ]);

  const isReleaseIntroOpen = (() => {
    if (typeof window === "undefined" || !profile?.id || isPublicRoute) {
      return false;
    }

    const persistentKey = getReleaseIntroStorageKey(profile.id);
    const sessionKey = getReleaseIntroSessionKey(profile.id);
    const isDismissedPermanently = window.localStorage.getItem(persistentKey) === "true";
    const isSeenThisSession = window.sessionStorage.getItem(sessionKey) === "true";

    return !isDismissedPermanently && !isSeenThisSession;
  })();

  const handleCloseReleaseIntro = () => {
    if (!profile?.id || typeof window === "undefined") {
      setReleaseIntroVisibilityVersion((current) => current + 1);
      setDontShowReleaseIntroAgain(false);
      return;
    }

    const persistentKey = getReleaseIntroStorageKey(profile.id);
    const sessionKey = getReleaseIntroSessionKey(profile.id);

    if (dontShowReleaseIntroAgain) {
      window.localStorage.setItem(persistentKey, "true");
    }

    window.sessionStorage.setItem(sessionKey, "true");
    setDontShowReleaseIntroAgain(false);
    setReleaseIntroVisibilityVersion((current) => current + 1);
  };

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isPublicRoute && isAuthenticated && !hasResolvedWorkspaceAccess) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (profileError || !profile) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3
        }}
      >
        <Stack spacing={2.5} sx={{ width: "100%", maxWidth: 560 }}>
          <AutoHideAlert severity="warning" variant="outlined">
            {profileError ?? "Signed in, but the application profile is not ready yet."}
          </AutoHideAlert>
          <Typography color="text.secondary">
            This usually means the signed-in account is missing required workspace access or profile data.
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" onClick={() => router.replace("/login")}>
              Back to Login
            </Button>
            <Button variant="outlined" onClick={() => void signOut()}>
              Sign Out
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <>
      <ReleaseIntroDialog
        open={isReleaseIntroOpen}
        dontShowAgain={dontShowReleaseIntroAgain}
        onDontShowAgainChange={setDontShowReleaseIntroAgain}
        onContinue={handleCloseReleaseIntro}
      />

      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          height: useDesktopMatchesLayout ? "100vh" : "auto",
          overflow: useDesktopMatchesLayout ? "hidden" : "visible"
        }}
      >
        {!isMobileShell && (
          <Sidebar
            collapsed={collapsed}
            hasTeam={hasTeam}
            canAccessMemberships={canAccessMemberships}
            canAccessPlanner={canAccessPlanner}
            canAccessAnalytics={canAccessAnalytics}
            canAccessValidation={canAccessValidation}
            onOpenSettings={() => setIsSettingsDrawerOpen(true)}
          />
        )}
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            ml: !isMobileShell ? (collapsed ? "80px" : "260px") : 0,
            transition: !isMobileShell ? "margin-left .2s" : undefined
          }}
        >
          {!isMobileShell && (
    <Topbar hasTeam={hasTeam} toggleSidebar={() => setCollapsed(!collapsed)} />
          )}

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              px: { xs: 2, sm: 2.5, md: 4 },
              pt: { xs: 2, sm: 2.5, md: 4 },
              pb: isMobileShell
                ? "calc(88px + env(safe-area-inset-bottom))"
                : 4,
              overflow: useDesktopMatchesLayout ? "hidden" : "auto",
              bgcolor: "background.default",
              backgroundImage: (theme) => [
                `linear-gradient(180deg, ${varAlpha(theme.vars.palette.primary.mainChannel, 0.12)} 0%, transparent 28%)`,
                `radial-gradient(circle at top right, ${varAlpha(theme.vars.palette.secondary.mainChannel, 0.08)}, transparent 24%)`
              ].join(", ")
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>

      {isMobileShell && (
        <>
          {!isMobileMoreOpen && (
            <MobileBottomNav
            hasTeam={hasTeam}
            canAccessPlanner={canAccessPlanner}
            onOpenMore={() => setIsMobileMoreOpen(true)}
            />
          )}

          <MobileMoreSheet
            open={isMobileMoreOpen}
            hasTeam={hasTeam}
            canSeeFairness={canSeeFairness}
            canAccessPlanner={canAccessPlanner}
            canAccessMemberships={canAccessMemberships}
            canAccessAnalytics={canAccessAnalytics}
            canAccessValidation={canAccessValidation}
            canAccessUpload={canManageMatches}
            onClose={() => setIsMobileMoreOpen(false)}
            onOpenSettings={() => setIsSettingsDrawerOpen(true)}
          />
        </>
      )}

      <SettingsDrawer
        open={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
      />
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={(
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <CircularProgress />
        </Box>
      )}
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
