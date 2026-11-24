"use client";

import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import BalanceOutlined from "@mui/icons-material/BalanceOutlined";
import EventOutlined from "@mui/icons-material/EventOutlined";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import Avatar from "@mui/material/Avatar";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { supabase } from "@/src/db/client";
import { LABELS } from "@/src/membership/form";
import { KIT, Logo, ShellContext } from "./brand";
import { ErrorNote, Loading } from "./kit";
import { useSession } from "./session";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];
/** Pages drawn on the centred club card instead of inside the app. */
const isBarePath = (path: string) => PUBLIC_PATHS.includes(path) || path === "/setup" || path.startsWith("/claim/");

const SIDEBAR_WIDTH = 232;

type NavLink = { href: string; label: string; icon: React.ReactNode; show: boolean; heading: string; blurb: string; eyebrow: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const bare = isBarePath(pathname);
  const mustSignIn = !session.loading && !session.user && !isPublic;
  const mustSetUp = !session.loading && Boolean(session.user) && !session.team && !session.error && pathname !== "/setup" && !isPublic;

  useEffect(() => {
    if (mustSignIn) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (mustSetUp) router.replace("/setup");
  }, [mustSignIn, mustSetUp, pathname, router]);

  const teamName = session.team?.name ?? "Moonwalkers";
  const inSquad = Boolean(session.member && session.seasonMember && session.seasonMember.status !== "left");
  const allLinks: NavLink[] = [
    { href: "/", label: "Home", icon: <HomeOutlined />, show: true, heading: `Welcome to ${teamName}`, blurb: "Your next match, your membership and your fair chances.", eyebrow: "Team space" },
    { href: "/fixtures", label: "Fixtures", icon: <EventOutlined />, show: inSquad, heading: `${teamName} Fixtures`, blurb: "Upcoming matches, availability, team picks and scorecards.", eyebrow: "Match workspace" },
    { href: "/fairness", label: "Fairness", icon: <BalanceOutlined />, show: inSquad, heading: `${teamName} Fairness`, blurb: "Chances owed and given for every player, and the rules behind them.", eyebrow: "Fairness" },
    { href: "/dashboard", label: "Stats", icon: <InsightsOutlined />, show: inSquad, heading: `${teamName} Dashboard`, blurb: "Results, leaders and head-to-head across every season.", eyebrow: "Dashboard" },
    { href: "/profile", label: "Profile", icon: <PersonOutlined />, show: inSquad, heading: `${teamName} Profile`, blurb: "Your details, preferences and time away.", eyebrow: "My account" },
    { href: "/dues", label: "Dues", icon: <PaymentsOutlined />, show: session.canManageMoney, heading: `${teamName} Dues`, blurb: "Membership fees and payments for the season.", eyebrow: "Finance" },
    { href: "/admin", label: "Admin", icon: <AdminPanelSettingsOutlined />, show: session.isOrganiser, heading: `${teamName} Admin`, blurb: "Season settings, applications and members.", eyebrow: "Admin workspace" }
  ];
  const links = allLinks.filter((link) => link.show);
  // Player pages sit under Fairness, where you reach them from. Matched against
  // every section so the title is right while the session is still loading.
  const section = pathname.startsWith("/players/") ? "/fairness" : pathname;
  const active = allLinks.filter((l) => l.href !== "/").find((l) => section.startsWith(l.href)) ?? allLinks[0];

  const signOut = async () => {
    await supabase().auth.signOut();
    router.replace("/login");
  };

  const showContent = isPublic || (!session.loading && !mustSignIn && !mustSetUp);
  const shell = useMemo(() => ({ bare, eyebrow: bare ? teamName : active.eyebrow }), [bare, teamName, active.eyebrow]);
  const body = showContent ? children : !session.error && <Loading />;

  if (bare) {
    return (
      <ShellContext.Provider value={shell}>
        <Box
          sx={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            px: 2,
            py: 4,
            background: `radial-gradient(circle at 20% 0%, ${KIT.navy2} 0%, transparent 55%), radial-gradient(circle at 100% 100%, rgba(215,25,45,.25) 0%, transparent 40%), linear-gradient(160deg, ${KIT.navy0}, ${KIT.navy1})`
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 520 }}>
            <ErrorNote message={session.error} />
            {body}
          </Box>
        </Box>
      </ShellContext.Provider>
    );
  }

  const roleLabel = session.isOrganiser ? "Organiser" : session.seasonMember ? (LABELS[session.seasonMember.role] ?? "Player") : "";
  const name = session.member?.display_name ?? session.user?.email ?? "";

  return (
    <ShellContext.Provider value={shell}>
      <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", display: "flex" }}>
        {/* Sidebar (tablet and up) */}
        {session.user && (
          <Box
            component="nav"
            aria-label="Main"
            sx={{
              display: { xs: "none", md: "flex" },
              flexDirection: "column",
              gap: 2,
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              position: "sticky",
              top: 0,
              height: "100dvh",
              px: 1.5,
              py: 2,
              bgcolor: "background.paper",
              borderRight: 1,
              borderColor: "divider"
            }}
          >
            <Stack direction="row" spacing={1.25} component={NextLink} href="/" sx={{ alignItems: "center", px: 0.5, color: "inherit", textDecoration: "none" }}>
              <Logo size={40} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "text.secondary" }}>Team space</Typography>
                <Typography variant="subtitle1" sx={{ fontFamily: "var(--font-lexend-deca)", fontWeight: 700, lineHeight: 1.2 }} noWrap>
                  {teamName}
                </Typography>
              </Box>
            </Stack>
            <Stack spacing={0.25} sx={{ flex: 1 }}>
              {links.map((link) => {
                const on = link.href === active.href;
                return (
                  <ButtonBase
                    key={link.href}
                    component={NextLink}
                    href={link.href}
                    aria-current={on ? "page" : undefined}
                    sx={{
                      justifyContent: "flex-start",
                      gap: 1.5,
                      px: 1.5,
                      py: 1.1,
                      borderRadius: 1.25,
                      fontWeight: 600,
                      fontSize: 14,
                      position: "relative",
                      color: on ? "primary.main" : "text.secondary",
                      bgcolor: on ? "action.selected" : "transparent",
                      "&:hover": { bgcolor: "action.hover" },
                      "&::before": on
                        ? { content: '""', position: "absolute", left: -12, top: 8, bottom: 8, width: 3, borderRadius: "0 3px 3px 0", bgcolor: KIT.red }
                        : undefined,
                      "& svg": { fontSize: 20 }
                    }}
                  >
                    {link.icon}
                    {link.label}
                  </ButtonBase>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", borderTop: 1, borderColor: "divider", pt: 1.5 }}>
              <Avatar sx={{ width: 32, height: 32, fontSize: 14, color: "common.white", background: `linear-gradient(135deg, ${KIT.navy2}, ${KIT.red})` }}>
                {name.slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" noWrap>
                  {name}
                </Typography>
                {roleLabel && (
                  <Typography variant="caption" color="text.secondary" component="div" noWrap>
                    {roleLabel}
                  </Typography>
                )}
              </Box>
              <Tooltip title="Sign out">
                <IconButton size="small" onClick={signOut} aria-label="Sign out">
                  <LogoutOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0, pb: { xs: 10, md: 4 } }}>
          {/* Page title bar */}
          <Box
            component="header"
            sx={{
              position: "sticky",
              top: 0,
              zIndex: "appBar",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: { xs: 2, md: 3 },
              py: 1.5,
              bgcolor: "background.default",
              borderBottom: 1,
              borderColor: "divider"
            }}
          >
            <Box sx={{ display: { xs: "block", md: session.user ? "none" : "block" } }}>
              <Logo size={34} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }} noWrap>
                {active.heading}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {active.blurb}
              </Typography>
            </Box>
            {session.user && (
              <Tooltip title="Sign out">
                <IconButton onClick={signOut} aria-label="Sign out" sx={{ display: { md: "none" } }}>
                  <LogoutOutlined />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Container maxWidth="lg" sx={{ py: 3 }}>
            <ErrorNote message={session.error} />
            {body}
          </Container>
        </Box>

        {/* Bottom navigation (phones) */}
        {session.user && links.length > 1 && (
          <Paper elevation={3} sx={{ position: "fixed", bottom: 0, left: 0, right: 0, display: { xs: "block", md: "none" }, zIndex: "appBar" }}>
            <BottomNavigation showLabels value={active.href}>
              {links.map((link) => (
                <BottomNavigationAction
                  key={link.href}
                  component={NextLink}
                  href={link.href}
                  value={link.href}
                  label={link.label}
                  icon={link.icon}
                  sx={{
                    minWidth: 0,
                    px: 0.5,
                    "& .MuiBottomNavigationAction-label": { fontSize: "0.7rem" },
                    "&.Mui-selected": { color: "primary.main" },
                    "&.Mui-selected svg": { color: KIT.red }
                  }}
                />
              ))}
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    </ShellContext.Provider>
  );
}
