export type CricketRuleSeverity = "error" | "warning" | "info";

export type CricketRuleFinding = {
  id: string;
  severity: CricketRuleSeverity;
  title: string;
  summary: string;
  recommendation: string;
};

export type CricketRulebook = {
  id: string;
  name: string;
  governingBody: string;
  baseLaws: string;
  defaultFormat: string;
  playingXiSize: number;
  allowsSubstituteFielders: boolean;
  substituteRestrictions: string[];
};

export const iccT20Rulebook: CricketRulebook = {
  id: "icc-t20-baseline",
  name: "ICC T20 Cricket Guidance",
  governingBody: "ICC",
  baseLaws: "MCC Laws of Cricket",
  defaultFormat: "ICC T20",
  playingXiSize: 11,
  allowsSubstituteFielders: true,
  substituteRestrictions: [
    "Substitute fielders are not part of the playing XI by default.",
    "A substitute should not be treated as a batter, bowler, or captain.",
    "Wicket keeping by a substitute requires explicit match-official approval."
  ]
};

export const iccOdiRulebook: CricketRulebook = {
  ...iccT20Rulebook,
  id: "icc-odi-baseline",
  name: "ICC ODI Cricket Guidance",
  defaultFormat: "ICC ODI"
};

export const iccTestRulebook: CricketRulebook = {
  ...iccT20Rulebook,
  id: "icc-test-baseline",
  name: "ICC Test Cricket Guidance",
  defaultFormat: "ICC Test"
};

export const clubT10Rulebook: CricketRulebook = {
  ...iccT20Rulebook,
  id: "club-t10-override",
  name: "Club T10 Cricket Guidance",
  governingBody: "Club Override",
  defaultFormat: "Local T10 Override"
};

export function inferCricketRulebook(matchTitle?: string | null, competitionName?: string | null) {
  const haystack = `${matchTitle ?? ""} ${competitionName ?? ""}`.toLowerCase();

  if (haystack.includes("test")) {
    return iccTestRulebook;
  }

  if (haystack.includes("odi")) {
    return iccOdiRulebook;
  }

  if (haystack.includes("t10")) {
    return clubT10Rulebook;
  }

  return iccT20Rulebook;
}
