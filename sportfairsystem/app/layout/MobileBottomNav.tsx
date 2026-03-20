"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import {
  getMobileNavigationValue,
  getMobilePrimaryNavItems,
  MOBILE_MORE_ACTION
} from "@/app/layout/navigationConfig";

type MobileBottomNavProps = {
  isAdmin: boolean;
  onOpenMore: () => void;
};

export default function MobileBottomNav({
  isAdmin,
  onOpenMore
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navigationValue = getMobileNavigationValue(pathname, isAdmin);
  const primaryItems = getMobilePrimaryNavItems(isAdmin);

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        borderTop: "1px solid",
        borderColor: "divider",
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.96),
        backdropFilter: "blur(18px)"
      }}
    >
      <BottomNavigation
        showLabels
        value={navigationValue}
        onChange={(_event, nextValue) => {
          if (nextValue === "more") {
            onOpenMore();
            return;
          }

          if (typeof nextValue === "string" && nextValue !== pathname) {
            router.push(nextValue);
          }
        }}
        sx={{
          height: "calc(72px + env(safe-area-inset-bottom))",
          pb: "env(safe-area-inset-bottom)",
          px: 0.5,
          backgroundColor: "transparent",
          "& .MuiBottomNavigationAction-root": {
            minWidth: 0,
            px: 0.5,
            py: 0.75
          },
          "& .MuiBottomNavigationAction-label": {
            fontSize: "0.72rem",
            fontWeight: 700,
            mt: 0.5
          }
        }}
      >
        {primaryItems.map((item) => (
          <BottomNavigationAction
            key={item.key}
            label={item.mobileLabel ?? item.title}
            value={item.path}
            icon={item.icon}
          />
        ))}

        <BottomNavigationAction
          label={MOBILE_MORE_ACTION.label}
          value="more"
          icon={MOBILE_MORE_ACTION.icon}
        />
      </BottomNavigation>
    </Paper>
  );
}
