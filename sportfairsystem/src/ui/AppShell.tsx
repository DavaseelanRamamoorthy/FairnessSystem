"use client";

import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import AppBar from "@mui/material/AppBar";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/src/db/client";
import { ErrorNote, Loading } from "./kit";
import { useSession } from "./session";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const mustSignIn = !session.loading && !session.user && !isPublic;
  const mustSetUp = !session.loading && Boolean(session.user) && !session.team && !session.error && pathname !== "/setup" && !isPublic;

  useEffect(() => {
    if (mustSignIn) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (mustSetUp) router.replace("/setup");
  }, [mustSignIn, mustSetUp, pathname, router]);

  const inSquad = Boolean(session.member && session.seasonMember && session.seasonMember.status !== "left");
  const links = [
    { href: "/", label: "Home", icon: <HomeOutlined />, show: true },
    { href: "/profile", label: "Profile", icon: <PersonOutlined />, show: inSquad },
    { href: "/dues", label: "Dues", icon: <PaymentsOutlined />, show: session.canManageMoney },
    { href: "/admin", label: "Admin", icon: <AdminPanelSettingsOutlined />, show: session.isOrganiser }
  ].filter((link) => link.show);
  const activeLink = links.filter((l) => l.href !== "/").find((l) => pathname.startsWith(l.href))?.href ?? "/";

  const signOut = async () => {
    await supabase().auth.signOut();
    router.replace("/login");
  };

  const showContent = isPublic || (!session.loading && !mustSignIn && !mustSetUp);

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", pb: { xs: 10, md: 4 } }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Typography variant="h6" component={NextLink} href="/" sx={{ color: "inherit", textDecoration: "none", flexGrow: 1 }}>
            {session.team?.name ?? "Moonwalkers"}
          </Typography>
          {session.user && (
            <Stack direction="row" spacing={1}>
              <Stack direction="row" spacing={1} sx={{ display: { xs: "none", md: "flex" } }}>
                {links.map((link) => (
                  <Button
                    key={link.href}
                    component={NextLink}
                    href={link.href}
                    color={activeLink === link.href ? "primary" : "inherit"}
                  >
                    {link.label}
                  </Button>
                ))}
              </Stack>
              <Button color="inherit" onClick={signOut}>
                Sign out
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <ErrorNote message={session.error} />
        {showContent ? children : !session.error && <Loading />}
      </Container>

      {session.user && links.length > 1 && (
        <Paper
          elevation={3}
          sx={{ position: "fixed", bottom: 0, left: 0, right: 0, display: { xs: "block", md: "none" }, zIndex: "appBar" }}
        >
          <BottomNavigation showLabels value={activeLink}>
            {links.map((link) => (
              <BottomNavigationAction
                key={link.href}
                component={NextLink}
                href={link.href}
                value={link.href}
                label={link.label}
                icon={link.icon}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
