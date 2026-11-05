import { z } from "zod";
import type { BatPref, FairnessRules } from "./types";

export const DEFAULT_RULES: FairnessRules = {
  xiSize: 11,
  battingWeights: { top: 3, middle: 2, lower: 1 },
  minBowlers: 5,
  maxOversPerBowler: null,
  lockCaptain: true,
  carryOver: 0,
  respectBatPref: true
};

/** Shape of `seasons.rules`; every key is optional and falls back to the default. */
export const rulesSchema = z
  .object({
    xiSize: z.number().int().min(6).max(11),
    battingWeights: z.object({
      top: z.number().min(0),
      middle: z.number().min(0),
      lower: z.number().min(0)
    }),
    minBowlers: z.number().int().min(0).max(11),
    maxOversPerBowler: z.number().int().min(1).nullable(),
    lockCaptain: z.boolean(),
    carryOver: z.number().min(0).max(1),
    respectBatPref: z.boolean()
  })
  .partial();

export function resolveRules(raw: unknown): FairnessRules {
  const parsed = rulesSchema.parse(raw ?? {});
  return {
    ...DEFAULT_RULES,
    ...parsed,
    battingWeights: { ...DEFAULT_RULES.battingWeights, ...parsed.battingWeights }
  };
}

export type BattingBand = "top" | "middle" | "lower";

export function bandOf(position: number): BattingBand {
  if (position <= 4) return "top";
  if (position <= 7) return "middle";
  return "lower";
}

export function weightOf(position: number | null, rules: FairnessRules): number {
  if (position === null) return 0;
  return rules.battingWeights[bandOf(position)];
}

/** Highest batting weight a player is owed, given where they asked to bat. */
export function batPrefCap(pref: BatPref, rules: FairnessRules): number {
  if (!rules.respectBatPref) return Number.POSITIVE_INFINITY;
  if (pref === "lower") return rules.battingWeights.lower;
  if (pref === "middle") return rules.battingWeights.middle;
  return Number.POSITIVE_INFINITY;
}

export function maxOvers(overs: number, rules: FairnessRules) {
  return rules.maxOversPerBowler ?? Math.ceil(overs / 5);
}

/** Rounds to 2 decimals so balances stay readable and tests stay stable. */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}
