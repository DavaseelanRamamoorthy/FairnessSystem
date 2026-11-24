"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Account } from "@/src/engine/types";

/** "+1.4 owed", "even" or "0.6 ahead": positive means the team owes the player. */
export function balanceText(balance: number) {
  if (Math.abs(balance) < 0.05) return "even";
  return balance > 0 ? `${balance.toFixed(1)} owed` : `${Math.abs(balance).toFixed(1)} ahead`;
}

export function balanceColor(balance: number) {
  if (balance >= 1) return "warning.main";
  if (balance <= -1) return "info.main";
  return "text.primary";
}

export function BalanceCell({ label, account, unit }: { label: string; account: Account | undefined; unit: string }) {
  const a = account ?? { owed: 0, given: 0, balance: 0 };
  return (
    <Stack sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, color: balanceColor(a.balance) }}>{balanceText(a.balance)}</Typography>
      <Typography variant="caption" color="text.secondary">
        {a.given.toFixed(1)} of {a.owed.toFixed(1)} {unit}
      </Typography>
    </Stack>
  );
}
