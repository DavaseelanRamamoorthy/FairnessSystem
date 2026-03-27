import type { ReactNode } from "react";

import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AnalyticsRoundedIcon from "@mui/icons-material/QueryStats";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import DashboardRoundedIcon from "@mui/icons-material/Dashboard";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import FeedbackRoundedIcon from "@mui/icons-material/FeedbackRounded";
import GroupRoundedIcon from "@mui/icons-material/Group";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import SportsCricketRoundedIcon from "@mui/icons-material/SportsCricket";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";

export type ShellNavItem = {
  key: string;
  title: string;
  path: string;
  icon: ReactNode;
  mobileLabel?: string;
};

export const desktopBaseNavItems: ShellNavItem[] = [
  { key: "dashboard", title: "Dashboard", path: "/dashboard", icon: <DashboardRoundedIcon /> },
  { key: "matches", title: "Matches", path: "/matches", icon: <SportsCricketRoundedIcon /> },
  { key: "players", title: "Squad", path: "/players", icon: <GroupRoundedIcon /> }
];

const desktopProfileOnlyNavItems: ShellNavItem[] = [
  { key: "profile", title: "Profile", path: "/profile", icon: <AccountCircleRoundedIcon /> }
];

export const desktopAdminNavItems: ShellNavItem[] = [
  { key: "memberships", title: "Membership", path: "/memberships", icon: <BadgeRoundedIcon /> },
  { key: "planner", title: "Planner", path: "/planner", icon: <EventAvailableRoundedIcon /> },
  { key: "analytics", title: "Analytics", path: "/analytics", icon: <AnalyticsRoundedIcon /> },
  { key: "validation", title: "Validation", path: "/validation", icon: <RuleRoundedIcon /> }
];

const desktopFairnessNavItem: ShellNavItem = {
  key: "fairness",
  title: "Fairness",
  path: "/fairness",
  icon: <FactCheckRoundedIcon />
};

const desktopFeedbackNavItem: ShellNavItem = {
  key: "feedback",
  title: "Feedback",
  path: "/feedback",
  icon: <FeedbackRoundedIcon />
};

const mobileMemberPrimaryNavItems: ShellNavItem[] = [
  { key: "home", title: "Dashboard", mobileLabel: "Home", path: "/dashboard", icon: <DashboardRoundedIcon /> },
  { key: "matches", title: "Matches", path: "/matches", icon: <SportsCricketRoundedIcon /> },
  { key: "players", title: "Squad", path: "/players", icon: <GroupRoundedIcon /> },
  { key: "fairness", title: "Fairness", path: "/fairness", icon: <FactCheckRoundedIcon /> }
];

const mobileAdminPrimaryNavItems: ShellNavItem[] = [
  { key: "home", title: "Dashboard", mobileLabel: "Home", path: "/dashboard", icon: <DashboardRoundedIcon /> },
  { key: "matches", title: "Matches", path: "/matches", icon: <SportsCricketRoundedIcon /> },
  { key: "players", title: "Squad", path: "/players", icon: <GroupRoundedIcon /> },
  { key: "planner", title: "Planner", path: "/planner", icon: <EventAvailableRoundedIcon /> }
];

const mobileProfileOnlyPrimaryNavItems: ShellNavItem[] = [
  {
    key: "profile",
    title: "Profile",
    mobileLabel: "Profile",
    path: "/profile",
    icon: <AccountCircleRoundedIcon />
  }
];

const mobileMemberMoreNavItems: ShellNavItem[] = [
  { key: "profile", title: "Profile", path: "/profile", icon: <AccountCircleRoundedIcon /> },
  { key: "feedback", title: "Feedback", path: "/feedback", icon: <FeedbackRoundedIcon /> }
];

const mobileAdminMoreNavItems: ShellNavItem[] = [
  { key: "profile", title: "Profile", path: "/profile", icon: <AccountCircleRoundedIcon /> },
  { key: "memberships", title: "Membership", path: "/memberships", icon: <BadgeRoundedIcon /> },
  { key: "fairness", title: "Fairness", path: "/fairness", icon: <FactCheckRoundedIcon /> },
  { key: "analytics", title: "Analytics", path: "/analytics", icon: <AnalyticsRoundedIcon /> },
  { key: "validation", title: "Validation", path: "/validation", icon: <RuleRoundedIcon /> },
  { key: "feedback", title: "Feedback", path: "/feedback", icon: <FeedbackRoundedIcon /> },
  { key: "upload", title: "Upload", path: "/upload", icon: <UploadFileRoundedIcon /> }
];

const mobileProfileOnlyMoreNavItems: ShellNavItem[] = [];

export function getDesktopNavItems(
  hasTeam = true,
  canAccessMemberships = false,
  canAccessPlanner = false,
  canAccessAnalytics = false,
  canAccessValidation = false
) {
  if (!hasTeam) {
    return desktopProfileOnlyNavItems;
  }

  const items: ShellNavItem[] = [...desktopBaseNavItems];

  if (canAccessMemberships) {
    items.push(desktopAdminNavItems.find((item) => item.key === "memberships")!);
  }

  if (canAccessPlanner) {
    items.push(desktopAdminNavItems.find((item) => item.key === "planner")!);
  }

  items.push(desktopFairnessNavItem);

  if (canAccessAnalytics) {
    items.push(desktopAdminNavItems.find((item) => item.key === "analytics")!);
  }

  if (canAccessValidation) {
    items.push(desktopAdminNavItems.find((item) => item.key === "validation")!);
  }

  items.push(desktopFeedbackNavItem);

  return items;
}

export function getMobilePrimaryNavItems(hasTeam = true, canAccessPlanner = false) {
  if (!hasTeam) {
    return mobileProfileOnlyPrimaryNavItems;
  }

  if (canAccessPlanner) {
    return mobileAdminPrimaryNavItems;
  }

  return mobileMemberPrimaryNavItems;
}

export function getMobileMoreNavItems(
  hasTeam = true,
  canAccessPlanner = false,
  canAccessMemberships = false,
  canAccessAnalytics = false,
  canAccessValidation = false,
  canAccessUpload = false
) {
  if (!hasTeam) {
    return mobileProfileOnlyMoreNavItems;
  }

  const membershipItem = mobileAdminMoreNavItems.find((item) => item.key === "memberships");
  const analyticsItem = mobileAdminMoreNavItems.find((item) => item.key === "analytics");
  const validationItem = mobileAdminMoreNavItems.find((item) => item.key === "validation");
  const feedbackItem = mobileAdminMoreNavItems.find((item) => item.key === "feedback");
  const uploadItem = mobileAdminMoreNavItems.find((item) => item.key === "upload");
  const items = canAccessPlanner
    ? [...mobileAdminMoreNavItems].filter((item) => !["memberships", "analytics", "validation", "feedback", "upload"].includes(item.key))
    : [...mobileMemberMoreNavItems];

  if (canAccessMemberships && membershipItem && !items.some((item) => item.key === "memberships")) {
    items.push(membershipItem);
  }

  if (canAccessAnalytics && analyticsItem && !items.some((item) => item.key === "analytics")) {
    items.push(analyticsItem);
  }

  if (canAccessValidation && validationItem && !items.some((item) => item.key === "validation")) {
    items.push(validationItem);
  }

  if (feedbackItem && !items.some((item) => item.key === "feedback")) {
    items.push(feedbackItem);
  }

  if (canAccessUpload && uploadItem && !items.some((item) => item.key === "upload")) {
    items.push(uploadItem);
  }

  return items;
}

export function isNavPathActive(pathname: string, path: string) {
  if (path === "/fairness" && pathname === "/my-fairness") {
    return true;
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

export function getMobileNavigationValue(
  pathname: string,
  hasTeam = true,
  canAccessPlanner = false
) {
  const activePrimaryItem = getMobilePrimaryNavItems(hasTeam, canAccessPlanner).find((item) =>
    isNavPathActive(pathname, item.path)
  );

  if (activePrimaryItem) {
    return activePrimaryItem.path;
  }

  return "more";
}

export const MOBILE_MORE_ACTION = {
  key: "more",
  label: "More",
  icon: <MoreHorizRoundedIcon />
} as const;
