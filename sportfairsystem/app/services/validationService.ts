import { currentTeamName } from "@/app/config/teamConfig";
import { cleanName } from "@/app/services/cleanName";
import { CricketRuleSeverity } from "@/app/services/cricketRulebook";
import { evaluateParsedMatchAgainstCricketRulebook } from "@/app/services/ruleEvaluationService";
import { getCurrentTeamId } from "@/app/services/squadService";
import { supabase } from "@/app/services/supabaseClient";
import { normalizeTeamName } from "@/app/services/teamValidationService";
import { ParsedMatch } from "@/app/types/match.types";
import { getOpponentName } from "@/app/utils/matchOpponent";

export type ValidationSeasonOption = {
  value: string;
  label: string;
};

type MatchRow = {
  id: string;
  match_date: string | null;
  match_code: string | null;
  competition_name?: string | null;
  team_a: string | null;
  team_b: string | null;
  parsed_payload?: ParsedMatch | null;
};

type PlayerRow = {
  id: string;
  name: string;
  is_guest: boolean | null;
};

type MatchPlayerRow = {
  match_id: string;
  team_name: string | null;
  player_name: string;
  player_id: string | null;
  did_bat: boolean | null;
  did_bowl: boolean | null;
};

type InningsRow = {
  id: string;
  match_id: string;
  team_name: string | null;
};

type BattingStatRow = {
  innings_id: string;
  player_name: string | null;
  player_id: string | null;
};

type BowlingStatRow = {
  innings_id: string;
  player_name: string | null;
  player_id: string | null;
};

export type ValidationIssueItem = {
  matchId: string;
  matchCode: string | null;
  matchDate: string | null;
  opponentName: string | null;
  playerName: string;
  source: "Match XI" | "Batting" | "Bowling";
  detail: string;
};

export type DuplicateNameRiskItem = {
  normalizedName: string;
  displayName: string;
  teams: string[];
  appearances: number;
  note: string;
};

export type GuestPromotionCandidate = {
  playerId: string;
  playerName: string;
  matchCount: number;
  battingMatches: number;
  bowlingMatches: number;
};

export type RulebookIssueItem = {
  matchId: string;
  matchCode: string | null;
  matchDate: string | null;
  opponentName: string | null;
  rulebookName: string;
  severity: CricketRuleSeverity;
  title: string;
  detail: string;
  recommendation: string;
};

export type XiWarningItem = {
  matchId: string;
  matchCode: string | null;
  matchDate: string | null;
  opponentName: string | null;
  xiCount: number;
  activeCount: number;
  note: string;
};

export type ValidationSnapshot = {
  seasons: ValidationSeasonOption[];
  metrics: {
    totalIssues: number;
    missingPlayerLinks: number;
    duplicateNameRisks: number;
    guestPromotionCandidates: number;
    rulebookFindings: number;
    xiWarnings: number;
  };
  missingPlayerLinks: ValidationIssueItem[];
  duplicateNameRisks: DuplicateNameRiskItem[];
  guestPromotionCandidates: GuestPromotionCandidate[];
  rulebookFindings: RulebookIssueItem[];
  xiWarnings: XiWarningItem[];
};

function getSeasonValue(matchDate: string | null) {
  return matchDate?.slice(0, 4) ?? null;
}

function buildSeasonOptions(matches: MatchRow[]): ValidationSeasonOption[] {
  return Array.from(
    new Set(
      matches
        .map((match) => getSeasonValue(match.match_date))
        .filter((season): season is string => Boolean(season))
    )
  )
    .sort((left, right) => right.localeCompare(left))
    .map((season) => ({
      value: season,
      label: season
    }));
}

function buildEmptySnapshot(seasons: ValidationSeasonOption[]): ValidationSnapshot {
  return {
    seasons,
    metrics: {
      totalIssues: 0,
      missingPlayerLinks: 0,
      duplicateNameRisks: 0,
      guestPromotionCandidates: 0,
      rulebookFindings: 0,
      xiWarnings: 0
    },
    missingPlayerLinks: [],
    duplicateNameRisks: [],
    guestPromotionCandidates: [],
    rulebookFindings: [],
    xiWarnings: []
  };
}

function isCurrentTeamContext(teamName: string | null | undefined) {
  return normalizeTeamName(teamName) === normalizeTeamName(currentTeamName);
}

function dedupeValidationIssueItems(items: ValidationIssueItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      item.matchId,
      cleanName(item.playerName),
      item.source,
      item.detail
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function getValidationSnapshot(season?: string): Promise<ValidationSnapshot> {
  const teamId = await getCurrentTeamId();

  const [
    { data: matchData, error: matchError },
    { data: playerData, error: playerError }
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id, match_date, match_code, competition_name, team_a, team_b, parsed_payload")
      .eq("team_id", teamId)
      .order("match_date", { ascending: false }),
    supabase
      .from("players")
      .select("id, name, is_guest")
      .eq("team_id", teamId)
      .order("name", { ascending: true })
  ]);

  if (matchError) {
    throw new Error("Could not load validation matches.");
  }

  if (playerError) {
    throw new Error("Could not load validation players.");
  }

  const allMatches = (matchData ?? []) as MatchRow[];
  const seasons = buildSeasonOptions(allMatches);
  const matches = season
    ? allMatches.filter((match) => getSeasonValue(match.match_date) === season)
    : allMatches;

  if (matches.length === 0) {
    return buildEmptySnapshot(seasons);
  }

  const players = (playerData ?? []) as PlayerRow[];
  const matchIds = matches.map((match) => match.id);
  const matchById = new Map(matches.map((match) => [match.id, match]));

  const [
    { data: matchPlayersData, error: matchPlayersError },
    { data: inningsData, error: inningsError }
  ] = await Promise.all([
    supabase
      .from("match_players")
      .select("match_id, team_name, player_name, player_id, did_bat, did_bowl")
      .in("match_id", matchIds),
    supabase
      .from("innings")
      .select("id, match_id, team_name")
      .in("match_id", matchIds)
  ]);

  if (matchPlayersError) {
    throw new Error("Could not load validation match players.");
  }

  if (inningsError) {
    throw new Error("Could not load validation innings.");
  }

  const inningsRows = (inningsData ?? []) as InningsRow[];
  const inningsIds = inningsRows.map((innings) => innings.id);
  const inningsById = new Map(inningsRows.map((innings) => [innings.id, innings]));

  let battingStats: BattingStatRow[] = [];
  let bowlingStats: BowlingStatRow[] = [];

  if (inningsIds.length > 0) {
    const [
      { data: battingData, error: battingError },
      { data: bowlingData, error: bowlingError }
    ] = await Promise.all([
      supabase
        .from("batting_stats")
        .select("innings_id, player_name, player_id")
        .in("innings_id", inningsIds),
      supabase
        .from("bowling_stats")
        .select("innings_id, player_name, player_id")
        .in("innings_id", inningsIds)
    ]);

    if (battingError) {
      throw new Error("Could not load validation batting stats.");
    }

    if (bowlingError) {
      throw new Error("Could not load validation bowling stats.");
    }

    battingStats = (battingData ?? []) as BattingStatRow[];
    bowlingStats = (bowlingData ?? []) as BowlingStatRow[];
  }

  const matchPlayers = (matchPlayersData ?? []) as MatchPlayerRow[];
  const currentTeamMatchPlayers = matchPlayers.filter((row) => isCurrentTeamContext(row.team_name));

  const missingPlayerLinks: ValidationIssueItem[] = [];

  currentTeamMatchPlayers
    .filter((row) => !row.player_id)
    .forEach((row) => {
      const match = matchById.get(row.match_id);
      missingPlayerLinks.push({
        matchId: row.match_id,
        matchCode: match?.match_code ?? null,
        matchDate: match?.match_date ?? null,
        opponentName: getOpponentName(match?.team_a ?? null, match?.team_b ?? null, currentTeamName),
        playerName: row.player_name,
        source: "Match XI",
        detail: "Moonwalkers XI player is missing player_id in match_players."
      });
    });

  battingStats
    .filter((row) => {
      const innings = inningsById.get(row.innings_id);
      return isCurrentTeamContext(innings?.team_name) && !row.player_id && Boolean(row.player_name);
    })
    .forEach((row) => {
      const innings = inningsById.get(row.innings_id);
      const match = innings ? matchById.get(innings.match_id) : null;

      missingPlayerLinks.push({
        matchId: innings?.match_id ?? "",
        matchCode: match?.match_code ?? null,
        matchDate: match?.match_date ?? null,
        opponentName: getOpponentName(match?.team_a ?? null, match?.team_b ?? null, currentTeamName),
        playerName: row.player_name ?? "Unknown Player",
        source: "Batting",
        detail: "Moonwalkers batting row is missing player_id."
      });
    });

  bowlingStats
    .filter((row) => {
      const innings = inningsById.get(row.innings_id);
      return Boolean(innings?.team_name)
        && !isCurrentTeamContext(innings?.team_name)
        && !row.player_id
        && Boolean(row.player_name);
    })
    .forEach((row) => {
      const innings = inningsById.get(row.innings_id);
      const match = innings ? matchById.get(innings.match_id) : null;

      missingPlayerLinks.push({
        matchId: innings?.match_id ?? "",
        matchCode: match?.match_code ?? null,
        matchDate: match?.match_date ?? null,
        opponentName: getOpponentName(match?.team_a ?? null, match?.team_b ?? null, currentTeamName),
        playerName: row.player_name ?? "Unknown Player",
        source: "Bowling",
        detail: "Moonwalkers bowling row is missing player_id."
      });
    });

  const missingPlayerLinksDeduped = dedupeValidationIssueItems(missingPlayerLinks)
    .sort((left, right) => {
      if (left.matchDate && right.matchDate && left.matchDate !== right.matchDate) {
        return right.matchDate.localeCompare(left.matchDate);
      }

      return left.playerName.localeCompare(right.playerName);
    });

  const duplicateNameMap = new Map<
    string,
    { displayName: string; teams: Set<string>; appearances: Set<string> }
  >();

  matchPlayers.forEach((row) => {
    const normalizedName = cleanName(row.player_name);

    if (!normalizedName) {
      return;
    }

    const existing = duplicateNameMap.get(normalizedName) ?? {
      displayName: row.player_name,
      teams: new Set<string>(),
      appearances: new Set<string>()
    };

    if (row.team_name) {
      existing.teams.add(row.team_name);
    }

    existing.appearances.add(`${row.match_id}|${normalizeTeamName(row.team_name)}|${normalizedName}`);
    duplicateNameMap.set(normalizedName, existing);
  });

  const duplicateNameRisks = Array.from(duplicateNameMap.entries())
    .filter(([, entry]) =>
      Array.from(entry.teams).some((teamName) => isCurrentTeamContext(teamName))
      && entry.teams.size > 1
    )
    .map(([normalizedName, entry]) => ({
      normalizedName,
      displayName: entry.displayName,
      teams: Array.from(entry.teams).sort(),
      appearances: entry.appearances.size,
      note: `Name appears for Moonwalkers and ${entry.teams.size - 1} other team context(s).`
    }))
    .sort((left, right) => right.appearances - left.appearances);

  const guestIds = new Set(
    players
      .filter((player) => player.is_guest === true)
      .map((player) => player.id)
  );

  const guestCandidateMap = new Map<
    string,
    { playerName: string; matchIds: Set<string>; battingMatches: Set<string>; bowlingMatches: Set<string> }
  >();

  currentTeamMatchPlayers.forEach((row) => {
    if (!row.player_id || !guestIds.has(row.player_id)) {
      return;
    }

    const existing = guestCandidateMap.get(row.player_id) ?? {
      playerName: row.player_name,
      matchIds: new Set<string>(),
      battingMatches: new Set<string>(),
      bowlingMatches: new Set<string>()
    };

    existing.matchIds.add(row.match_id);

    if (row.did_bat) {
      existing.battingMatches.add(row.match_id);
    }

    if (row.did_bowl) {
      existing.bowlingMatches.add(row.match_id);
    }

    guestCandidateMap.set(row.player_id, existing);
  });

  const guestPromotionCandidates = Array.from(guestCandidateMap.entries())
    .map(([playerId, entry]) => ({
      playerId,
      playerName: entry.playerName,
      matchCount: entry.matchIds.size,
      battingMatches: entry.battingMatches.size,
      bowlingMatches: entry.bowlingMatches.size
    }))
    .filter((candidate) =>
      candidate.matchCount >= 2
      || candidate.battingMatches >= 2
      || candidate.bowlingMatches >= 2
    )
    .sort((left, right) => {
      if (right.matchCount !== left.matchCount) {
        return right.matchCount - left.matchCount;
      }

      return left.playerName.localeCompare(right.playerName);
    });

  const rulebookFindings: RulebookIssueItem[] = matches.flatMap((match) => {
    if (!match.parsed_payload) {
      return [];
    }

    const evaluation = evaluateParsedMatchAgainstCricketRulebook(match.parsed_payload);

    return evaluation.findings
      .filter((finding) => finding.severity !== "info")
      .map((finding) => ({
        matchId: match.id,
        matchCode: match.match_code,
        matchDate: match.match_date,
        opponentName: getOpponentName(match.team_a, match.team_b, currentTeamName),
        rulebookName: evaluation.rulebook.name,
        severity: finding.severity,
        title: finding.title,
        detail: finding.summary,
        recommendation: finding.recommendation
      }));
  });

  const battingActivityByMatch = new Map<string, Set<string>>();
  const bowlingActivityByMatch = new Map<string, Set<string>>();

  battingStats.forEach((row) => {
    const innings = inningsById.get(row.innings_id);

    if (!innings || !isCurrentTeamContext(innings.team_name) || !row.player_name) {
      return;
    }

    const existing = battingActivityByMatch.get(innings.match_id) ?? new Set<string>();
    existing.add(cleanName(row.player_name));
    battingActivityByMatch.set(innings.match_id, existing);
  });

  bowlingStats.forEach((row) => {
    const innings = inningsById.get(row.innings_id);

    if (!innings || !innings.team_name || isCurrentTeamContext(innings.team_name) || !row.player_name) {
      return;
    }

    const existing = bowlingActivityByMatch.get(innings.match_id) ?? new Set<string>();
    existing.add(cleanName(row.player_name));
    bowlingActivityByMatch.set(innings.match_id, existing);
  });

  const xiWarnings = matches
    .map((match) => {
      const xiRows = currentTeamMatchPlayers.filter((row) => row.match_id === match.id);
      const xiCount = xiRows.length;
      const activeCount = xiRows.filter((row) => row.did_bat || row.did_bowl).length;
      const activityUnion = new Set<string>([
        ...(battingActivityByMatch.get(match.id) ?? new Set<string>()),
        ...(bowlingActivityByMatch.get(match.id) ?? new Set<string>())
      ]);

      if (xiCount === 11 && activityUnion.size <= xiCount) {
        return null;
      }

      let note = "";

      if (xiCount < 11) {
        note = `Only ${xiCount} XI players were reconstructed; expected 11.`;
      } else if (xiCount > 11) {
        note = `${xiCount} XI players were reconstructed; expected 11.`;
      } else if (activityUnion.size > xiCount) {
        note = `${activityUnion.size} unique activity names were detected but only ${xiCount} XI players exist.`;
      } else if (activeCount === 0) {
        note = "No batting or bowling activity was linked for the reconstructed XI.";
      }

      return {
        matchId: match.id,
        matchCode: match.match_code,
        matchDate: match.match_date,
        opponentName: getOpponentName(match.team_a, match.team_b, currentTeamName),
        xiCount,
        activeCount,
        note
      };
    })
    .filter((item): item is XiWarningItem => Boolean(item));

  const totalIssues =
    missingPlayerLinksDeduped.length
    + duplicateNameRisks.length
    + guestPromotionCandidates.length
    + rulebookFindings.length;

  return {
    seasons,
    metrics: {
      totalIssues,
      missingPlayerLinks: missingPlayerLinksDeduped.length,
      duplicateNameRisks: duplicateNameRisks.length,
      guestPromotionCandidates: guestPromotionCandidates.length,
      rulebookFindings: rulebookFindings.length,
      xiWarnings: xiWarnings.length
    },
    missingPlayerLinks: missingPlayerLinksDeduped,
    duplicateNameRisks,
    guestPromotionCandidates,
    rulebookFindings,
    xiWarnings
  };
}
