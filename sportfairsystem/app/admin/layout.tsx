"use client";

import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { NoAccess } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

const TABS = [
  { href: "/admin", label: "Applications" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/season", label: "Season" }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isOrganiser } = useSession();
  const pathname = usePathname();
  if (!isOrganiser) return <NoAccess />;
  const active = [...TABS].reverse().find((tab) => pathname.startsWith(tab.href))?.href;

  return (
    <Stack spacing={3}>
      <Tabs value={active} variant="scrollable" aria-label="Admin sections">
        {TABS.map((tab) => (
          <Tab key={tab.href} component={NextLink} href={tab.href} value={tab.href} label={tab.label} />
        ))}
      </Tabs>
      {children}
    </Stack>
  );
}
