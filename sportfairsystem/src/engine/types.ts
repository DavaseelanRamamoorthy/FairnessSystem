export type BatPref = "top" | "middle" | "lower" | "flexible";
export type BowlPref = "powerplay" | "middle" | "death" | "flexible";
export type SeasonRole = "organiser" | "captain" | "vice_captain" | "player";

/** Mirrors one row of the `v_fixture_facts` view. */
export type FixtureFact = {
  fixtureId: string;
  seasonId: string;
  matchDate: string; // YYYY-MM-DD
  slot: number;
  status: "open" | "locked" | "selected" | "played" | "abandoned";
  overs: number;
  fairnessWeight: number;
  memberId: string;
  bowls: boolean;
  isWicketkeeper: boolean;
  batPref: BatPref;
  seasonRole: SeasonRole | null;
  joinedOn: string | null;
  leftOn: string | null;
  membershipPaid: boolean;
  unavailable: boolean;
  answer: "yes" | "no" | "maybe" | null;
  onTime: boolean;
  played: boolean;
  batPosition: number | null;
  ballsBowled: number;
  teamBallsBowled: number;
};

export type Eligibility =
  | "on_time" // paid, available, answered before the deadline snapshot
  | "late" // paid, available, answered after the snapshot: fills gaps only
  | "unpaid" // available but membership not paid: never selected
  | "unavailable" // long-term unavailability covers the date
  | "not_available" // answered no/maybe or did not answer
  | "not_member"; // not in the squad on that date (joined later / left earlier)

export type Account = { owed: number; given: number; balance: number };

export type LedgerHistoryEntry = {
  fixtureId: string;
  matchDate: string;
  eligibility: Eligibility;
  played: boolean;
  xi: { owed: number; given: number };
  bat: { owed: number; given: number; position: number | null };
  bowl: { owed: number; given: number };
};

export type LedgerEntry = {
  memberId: string;
  xi: Account; // unit: matches
  bat: Account; // unit: batting-slot weight
  bowl: Account; // unit: overs
  matchesPlayed: number;
  matchesEligible: number;
  history: LedgerHistoryEntry[];
};

export type Ledger = Map<string, LedgerEntry>;

export type FairnessRules = {
  xiSize: number;
  battingWeights: { top: number; middle: number; lower: number };
  minBowlers: number;
  /** null = ceil(overs / 5), the usual limited-overs cap. */
  maxOversPerBowler: number | null;
  lockCaptain: boolean;
  /** Share of last season's balance carried into a new season (0..1). */
  carryOver: number;
  /** Cap what a player is owed at the band they asked to bat in. */
  respectBatPref: boolean;
};

export type Candidate = {
  memberId: string;
  name: string;
  eligibility: Eligibility;
  isCaptain: boolean;
  isWicketkeeper: boolean;
  bowls: boolean;
  batPref: BatPref;
  bowlPref: BowlPref;
  balance: { xi: number; bat: number; bowl: number };
  seasonXiCount: number;
};

export type SelectionSlot = "xi" | "twelfth" | "reserve" | "left_out";

export type Pick = {
  memberId: string;
  name: string;
  slot: SelectionSlot;
  battingPosition: number | null;
  plannedOvers: number | null;
  reason: string;
};

export type Suggestion = {
  picks: Pick[];
  warnings: string[];
};
