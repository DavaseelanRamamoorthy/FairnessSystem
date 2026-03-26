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
  { key: "players", title: "Players", path: "/players", icon: <GroupRoundedIcon /> },
  { key: "my-fairness", title: "My Fairness", path: "/my-fairness", icon: <FactCheckRoundedIcon /> },
  { key: "feedback", title: "Feedback", path: "/feedback", icon: <FeedbackRoundedIcon /> }
];

const desktopProfileOnlyNavItems: ShellNavItem[] = [
  { key: "profile", title: "Profile", path: "/profile", icon: <AccountCircleRoundedIcon /> }
];

export const desktopAdminNavItems: ShellNavItem[] = [
  { key: "memberships", title: "Memberships", path: "/memberships", icon: <BadgeRoundedIcon /> },
  { key: "planner", title: "Planner", path: "/planner", icon: <EventAvailableRoundedIcon /> },
  { key: "analytics", title: "Analytics", path: "/analytics", icon: <AnalyticsRoundedIcon /> },
  { key: "validation", title: "Validation", path: "/validation", icon: <RuleRoundedIcon /> }
];

const mobileMemberPrimaryNavItems: ShellNavItem[] = [
  { key: "home", title: "Dashboard", mobileLabel: "Home", path: "/dashboard", icon: <DashboardRoundedIcon /> },
  { key: "matches", title: "Matches", path: "/matches", icon: <SportsCricketRoundedIcon /> },
  { key: "players", title: "Players", path: "/players", icon: <GroupRoundedIcon /> },
  { key: "feedback", title: "Feedback", path: "/feedback", icon: <FeedbackRoundedIcon /> }
];

const mobileAdminPrimaryNavItems: ShellNavItem[] = [
  { key: "home", title: "Dashboard", mobileLabel: "Home", path: "/dashboard", icon: <DashboardRoundedIcon /> },
  { key: "matches", title: "Matches", path: "/matches", icon: <SportsCricketRoundedIcon /> },
  { key: "players", title: "Players", path: "/players", icon: <GroupRoundedIcon /> },
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
  { key: "my-fairness", title: "My Fairness", path: "/my-fairness", icon: <FactCheckRoundedIcon /> },
  { key: "profile", title: "Profile", path: "/profile", icon: <AccountCircleRoundedIcon /> }
];

const mobileAdminMoreNavItems: ShellNavItem[] = [
  { key: "feedback", title: "Feedback", path: "/feedback", icon: <FeedbackRoundedIcon /> },
  { key: "my-fairness", title: "My Fairness", path: "/my-fairness", icon: <FactCheckRoundedIcon /> },
  { key: "profile", title: "Profile", path: "/profile", icon: <AccountCircleRoundedIcon /> },
  { key: "memberships", title: "Memberships", path: "/memberships", icon: <BadgeRoundedIcon /> },
  { key: "analytics", title: "Analytics", path: "/analytics", icon: <AnalyticsRoundedIcon /> },
  { key: "validation", title: "Validation", path: "/validation", icon: <RuleRoundedIcon /> },
  { key: "upload", title: "Upload", path: "/upload", icon: <UploadFileRoundedIcon /> }
];

const mobileProfileOnlyMoreNavItems: ShellNavItem[] = [];

function maybeAppendFairnessNavItem(items: ShellNavItem[], canSeeFairness: boolean) {
  if (!canSeeFairness) {
    return items;
  }

  return [
    ...items,
    { key: "fairness", title: "Fairness", path: "/fairness", icon: <FactCheckRoundedIcon /> }
  ];
}

export function getDesktopNavItems(
  isAdmin: boolean,
  canSeeFairness = false,
  hasTeam = true,
  canAccessMemberships = false,
  canAccessPlanner = false,
  canAccessAnalytics = false,
  canAccessValidation = false
) {
  if (!hasTeam) {
    return desktopProfileOnlyNavItems;
  }

  const elevatedItems = desktopAdminNavItems.filter((item) => {
    if (item.key === "memberships") {
      return canAccessMemberships;
    }

    if (item.key === "planner") {
      return canAccessPlanner;
    }

    if (item.key === "analytics") {
      return canAccessAnalytics;
    }

    if (item.key === "validation") {
      return canAccessValidation;
    }

    return isAdmin;
  });
  const items = [...desktopBaseNavItems, ...elevatedItems];
  return maybeAppendFairnessNavItem(items, canSeeFairness);
}

export function getMobilePrimaryNavItems(isAdmin: boolean, hasTeam = true, canAccessPlanner = false) {
  if (!hasTeam) {
    return mobileProfileOnlyPrimaryNavItems;
  }

  if (canAccessPlanner) {
    return mobileAdminPrimaryNavItems;
  }

  return isAdmin ? mobileAdminPrimaryNavItems.filter((item) => item.key !== "planner") : mobileMemberPrimaryNavItems;
}

export function getMobileMoreNavItems(
  isAdmin: boolean,
  canSeeFairness = false,
  hasTeam = true,
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
  const uploadItem = mobileAdminMoreNavItems.find((item) => item.key === "upload");
  const items = isAdmin
    ? [...mobileAdminMoreNavItems].filter((item) => {
      if (item.key === "memberships") {
        return canAccessMemberships;
      }

      if (item.key === "analytics") {
        return canAccessAnalytics;
      }

      if (item.key === "validation") {
        return canAccessValidation;
      }

      if (item.key === "upload") {
        return canAccessUpload;
      }

      return true;
    })
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

  if (canAccessUpload && uploadItem && !items.some((item) => item.key === "upload")) {
    items.push(uploadItem);
  }

  return maybeAppendFairnessNavItem(items, canSeeFairness);
}

export function isNavPathActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function getMobileNavigationValue(
  pathname: string,
  isAdmin: boolean,
  hasTeam = true,
  canAccessPlanner = false
) {
  const activePrimaryItem = getMobilePrimaryNavItems(isAdmin, hasTeam, canAccessPlanner).find((item) =>
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
