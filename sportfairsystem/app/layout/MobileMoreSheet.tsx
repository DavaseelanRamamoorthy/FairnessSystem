"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";

import {
  panelActionButtonSx,
  panelDangerActionButtonSx
} from "@/app/components/common/accountActionButtonStyles";
import { useAuth } from "@/app/context/AuthContext";
import { getMobileMoreNavItems, isNavPathActive } from "@/app/layout/navigationConfig";

type MobileMoreSheetProps = {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
};

export default function MobileMoreSheet({
  open,
  isAdmin,
  onClose,
  onOpenSettings
}: MobileMoreSheetProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const moreItems = getMobileMoreNavItems(isAdmin);
  const profileLetter = (profile?.firstName ?? profile?.email ?? "P").charAt(0).toUpperCase();
  const profileDisplayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim()
    || profile?.username
    || profile?.email
    || "Profile";

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 2
      }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "min(82vh, 720px)",
          overflowY: "auto",
          px: 2.5,
          pt: 1.5,
          pb: "calc(20px + env(safe-area-inset-bottom))"
        }
      }}
    >
      <Stack spacing={2}>
        <Box
          sx={{
            width: 44,
            height: 4,
            borderRadius: 999,
            backgroundColor: "divider",
            alignSelf: "center"
          }}
        />

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              width: 44,
              height: 44,
              fontWeight: 800,
              color: "#061230",
              backgroundColor: alpha("#FFFFFF", 0.92)
            }}
          >
            {profileLetter}
          </Avatar>

          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography fontWeight={800} noWrap>
              {profileDisplayName}
            </Typography>
            <Chip
              label={profile?.role === "admin" ? "Admin Access" : "Member Access"}
              size="small"
              sx={{
                alignSelf: "flex-start",
                fontWeight: 700,
                color: "text.primary",
                backgroundColor: "background.neutral"
              }}
            />
          </Stack>
        </Stack>

        <Divider />

        <List sx={{ py: 0 }}>
          {moreItems.map((item) => (
            <ListItemButton
              key={item.key}
              component={Link}
              href={item.path}
              selected={isNavPathActive(pathname, item.path)}
              onClick={onClose}
              sx={{
                borderRadius: 2.5,
                mb: 0.75
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.title} />
            </ListItemButton>
          ))}
        </List>

        <Stack spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<SettingsRoundedIcon />}
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            sx={panelActionButtonSx}
          >
            Settings
          </Button>

          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LogoutRoundedIcon />}
            onClick={() => {
              onClose();
              void signOut();
            }}
            sx={panelDangerActionButtonSx}
          >
            Sign Out
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
