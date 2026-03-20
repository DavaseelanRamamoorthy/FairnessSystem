"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, Button, CircularProgress, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { varAlpha } from "minimal-shared/utils";

import AutoHideAlert from "@/app/components/common/AutoHideAlert";
import ReleaseIntroDialog from "@/app/components/common/ReleaseIntroDialog";
import SettingsDrawer from "@/app/components/settings/SettingsDrawer";
import { useAuth } from "@/app/context/AuthContext";
import MobileBottomNav from "./MobileBottomNav";
import MobileMoreSheet from "./MobileMoreSheet";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const PUBLIC_ROUTES = ["/login", "/signup", "/reset-password"];
const ADMIN_ONLY_ROUTES = ["/configure", "/planner", "/analytics", "/validation", "/upload"];
const RELEASE_INTRO_VERSION = "v1.0";

function getReleaseIntroStorageKey(userId: string) {
  return `sportfairsystem:intro:${RELEASE_INTRO_VERSION}:dismissed:${userId}`;
}

function getReleaseIntroSessionKey(userId: string) {
  return `sportfairsystem:intro:${RELEASE_INTRO_VERSION}:seen:${userId}`;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {

  const [collapsed, setCollapsed] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [dontShowReleaseIntroAgain, setDontShowReleaseIntroAgain] = useState(false);
  const [, setReleaseIntroVisibilityVersion] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobileShell = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });
  const {
    isLoading,
    isAuthenticated,
    isAdmin,
    isProfileComplete,
    profile,
    profileError,
    signOut
  } = useAuth();
  const isMatchesPage = pathname === "/matches";
  const useDesktopMatchesLayout = !isMobileShell && isMatchesPage;
  const isEntryAuthRoute = pathname === "/login" || pathname === "/signup";
  const isProfileRoute = pathname === "/profile";
  const isPublicRoute = useMemo(
    () => PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );
  const isAdminRoute = useMemo(
    () => ADMIN_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname]
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isEntryAuthRoute) {
      router.replace(isProfileComplete && profile?.teamId ? "/dashboard" : "/profile");
      return;
    }

    if (isAuthenticated && (!isProfileComplete || !profile?.teamId) && !isProfileRoute) {
      router.replace("/profile");
      return;
    }

    if (isAuthenticated && isAdminRoute && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [
    isAdmin,
    isAdminRoute,
    isAuthenticated,
    isEntryAuthRoute,
    isLoading,
    isProfileComplete,
    isProfileRoute,
    isPublicRoute,
    profile?.teamId,
    router
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
            <Topbar toggleSidebar={() => setCollapsed(!collapsed)} />
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
              isAdmin={isAdmin}
              onOpenMore={() => setIsMobileMoreOpen(true)}
            />
          )}

          <MobileMoreSheet
            open={isMobileMoreOpen}
            isAdmin={isAdmin}
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
