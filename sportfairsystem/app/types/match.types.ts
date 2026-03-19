export type MatchResult = "Won" | "Lost" | "Unknown";

export type MatchOfficial = {
  name: string;
  role: string;
};

export type SquadPlayer = {
  name: string;
  playerOrder: number;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  battingStyle?: string | null;
};

export type TeamSquad = {
  teamName: string;
  players: SquadPlayer[];
};

export type Innings = {
  innings_number?: number;
  teamName: string | null;
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  extras?: number;
  crr?: number | null;
  extrasBreakdown?: {
    byes?: number;
    legByes?: number;
    wides?: number;
    noBalls?: number;
  };

  battingStats?: {
    player_name: string;
    batting_position?: number;
    batting_style?: string | null;
    isCaptain?: boolean;
    isWicketKeeper?: boolean;
    dismissal?: string;
    runs: number;
    balls: number;
    minutes?: number | null;
    fours: number;
    sixes: number;
    strike_rate: number;
  }[];

  bowlingStats?: {
    player_name: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    dot_balls?: number | null;
    fours_conceded?: number | null;
    sixes_conceded?: number | null;
    wides?: number | null;
    no_balls?: number | null;
    economy: number;
  }[];

  fallOfWickets?: {
    score: number;
    wicket_number: number;
    batsman: string;
    over: number;
  }[];

  playing11?: string[];
};

export type ParsedMatch = {
  matchTitle?: string | null;
  competitionName?: string | null;
  ground?: string | null;
  matchDate: string | null;
  teamA: string | null;
  teamB: string | null;
  tossWinner?: string | null;
  tossDecision?: string | null;
  winner: string | null;
  matchResult: MatchResult;
  resultSummary?: string | null;
  officials?: MatchOfficial[];
  squads?: TeamSquad[];
  rawText?: string | null;
  innings: Innings[];
};
