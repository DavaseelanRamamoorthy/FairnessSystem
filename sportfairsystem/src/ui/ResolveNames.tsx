"use client";

import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { NameDecision, NameRow } from "@/src/fairness/imports";
import type { MemberRef } from "@/src/import/nameMatching";

const GUEST = "__guest__";
const SKIP = "__skip__";

/**
 * Lets a captain confirm who each outside name is. Exact matches are already
 * decided and shown as confirmed; everything else needs a choice. A linked
 * name is remembered so it is matched automatically next time.
 */
export function ResolveNames({
  rows,
  onChange,
  members,
  allowGuest,
  allowSkip
}: {
  rows: NameRow[];
  onChange: (rows: NameRow[]) => void;
  members: MemberRef[];
  allowGuest?: boolean;
  allowSkip?: boolean;
}) {
  const pending = rows.filter((row) => row.resolution.status !== "matched");
  const matched = rows.length - pending.length;
  const undecided = rows.filter((row) => row.decision === null).length;
  const prefilled = pending.length - undecided;

  const decide = (index: number, decision: NameDecision | null) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, decision } : row)));

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {matched} of {rows.length} names are already known.
        {prefilled > 0 ? ` ${prefilled} more have an exact name match: check them below.` : ""}
        {undecided > 0 ? ` ${undecided} need${undecided === 1 ? "s" : ""} you to choose.` : ""}
        {pending.length > 0 ? " Linked names are remembered for next time." : ""}
      </Typography>
      {rows.map((row, index) => {
        if (row.resolution.status === "matched") return null;
        const suggestions = row.resolution.status === "suggested" ? row.resolution.suggestions : [];
        const value =
          row.decision?.kind === "member" ? row.decision.memberId : row.decision?.kind === "guest" ? GUEST : row.decision?.kind === "skip" ? SKIP : "";
        return (
          <Stack key={`${row.outside.name}-${index}`} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            <Stack sx={{ minWidth: 170 }}>
              <Typography sx={{ fontWeight: 600 }}>{row.outside.name}</Typography>
              {row.decision === null ? (
                <Chip size="small" color="warning" label="Needs a decision" sx={{ alignSelf: "flex-start" }} />
              ) : (
                <Chip size="small" variant="outlined" label="Check this" sx={{ alignSelf: "flex-start" }} />
              )}
            </Stack>
            <TextField
              select
              fullWidth
              size="small"
              label="This is"
              value={value}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              onChange={(event) => {
                const next = event.target.value;
                if (next === GUEST) decide(index, { kind: "guest" });
                else if (next === SKIP) decide(index, { kind: "skip" });
                else if (next) decide(index, { kind: "member", memberId: next, remember: true });
                else decide(index, null);
              }}
            >
              <MenuItem value="">Choose…</MenuItem>
              {suggestions.length > 0 && <ListSubheader>Suggested</ListSubheader>}
              {suggestions.map((s) => (
                <MenuItem key={`s-${s.memberId}`} value={s.memberId}>
                  {s.displayName} ({s.why})
                </MenuItem>
              ))}
              <ListSubheader>All players</ListSubheader>
              {members
                .filter((m) => !suggestions.some((s) => s.memberId === m.id))
                .map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.displayName}
                  </MenuItem>
                ))}
              {allowGuest && <MenuItem value={GUEST}>A guest (not a member)</MenuItem>}
              {allowSkip && <MenuItem value={SKIP}>Ignore this name</MenuItem>}
            </TextField>
            {row.decision?.kind === "member" && (
              <FormControlLabel
                sx={{ flexShrink: 0 }}
                label="Remember"
                control={
                  <Checkbox
                    checked={row.decision.remember}
                    onChange={(event) =>
                      decide(index, { kind: "member", memberId: (row.decision as { memberId: string }).memberId, remember: event.target.checked })
                    }
                  />
                }
              />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
