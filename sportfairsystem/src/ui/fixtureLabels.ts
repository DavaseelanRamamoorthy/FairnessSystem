import type { FixtureStatus } from "@/src/db/fixtures";

export const FIXTURE_STATUS: Record<FixtureStatus, { label: string; color: "default" | "info" | "warning" | "success" | "error" }> = {
  open: { label: "Taking availability", color: "info" },
  locked: { label: "Availability closed", color: "warning" },
  selected: { label: "Team published", color: "success" },
  played: { label: "Played", color: "default" },
  abandoned: { label: "Abandoned", color: "error" }
};

export const SLOT_LABEL = { xi: "Playing XI", twelfth: "12th player", reserve: "Reserve" } as const;

/** "You're …" phrasing for a player's own slot. */
export const SLOT_SENTENCE = { xi: "in the playing XI", twelfth: "12th player", reserve: "a reserve" } as const;

export const KIND_LABEL = { friendly_series: "Friendlies", tournament: "Tournament", league: "League" } as const;

export function formatMatchDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function formatDeadline(iso: string | null) {
  if (!iso) return "No deadline set";
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function oversText(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}
