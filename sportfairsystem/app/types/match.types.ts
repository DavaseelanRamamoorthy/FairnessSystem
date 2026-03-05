export type MatchResult = "Won" | "Lost" | "Unknown";

export type Innings = {
  teamName: string | null;
  runs: number | null;
  wickets: number | null;
  overs: number | null;
  extras?: number;

  battingStats?: {
    player_name: string;
    dismissal?: string;
    runs: number;
    balls: number;
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
  matchDate: string | null;
  teamA: string | null;
  teamB: string | null;
  winner: string | null;
  matchResult: MatchResult;
  innings: Innings[];
};