"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { varAlpha } from "minimal-shared/utils";

import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const PUBLIC_ROUTES = ["/login", "/signup", "/reset-password"];
const ADMIN_ONLY_ROUTES = ["/configure", "/planner", "/analytics", "/validation", "/upload"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {

  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
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
          <Alert severity="warning" variant="outlined">
            {profileError ?? "Signed in, but the application profile is not ready yet."}
          </Alert>
          <Typography color="text.secondary">
            This usually means the auth migration has not been applied yet, or the signed-in user
            does not have a mapped row in `public.users`.
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
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        height: isMatchesPage ? "100vh" : "auto",
        overflow: isMatchesPage ? "hidden" : "visible"
      }}
    >
      <Sidebar collapsed={collapsed} />
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          ml: collapsed ? "80px" : "260px",
          transition: "margin-left .2s"
        }}
      >
        <Topbar toggleSidebar={() => setCollapsed(!collapsed)} />

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            p: 4,
            overflow: isMatchesPage ? "hidden" : "auto",
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
  );
}
