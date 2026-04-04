import * as XLSX from "xlsx";

import { PlannerPlayerSummary, PlayerSummary } from "@/app/services/playerProfileService";
import { cleanName } from "@/app/services/cleanName";
import { CricketRulebook, inferCricketRulebook } from "@/app/services/cricketRulebook";
import {
  PlannerActualParticipation,
  getPlannerActualMatchLinkMap,
  getPlannerActualParticipationByMatch
} from "@/app/services/plannerActualService";
import { getActiveTeamContext } from "@/app/services/teamContextService";
import { supabase } from "@/app/services/supabaseClient";

export type PlannerWeekendOption = {
  id: string;
  label: string;
  isoDate: string | null;
  sourceColumn: string;
  availableNames: string[];
};

export type PlannerWorkbook = {
  sheetName: string;
  weekends: PlannerWeekendOption[];
};

export type PlannerPlayer = PlayerSummary & {
  memberId: string;
  playerId: string | null;
  identityMatchKeys: string[];
  normalizedName: string;
  normalizedMatchKeys: string[];
  normalizedTokens: string[];
  normalizedInitial: string | null;
  plannerRole: "batter" | "bowler" | "all-rounder";
  plannerScore: number;
  previousOpportunityStatus: PlannerOpportunityStatus;
  previousOpportunityBoost: number;
};

export type MatchPlan = {
  matchNumber: number;
  playingXi: PlannerPlayer[];
  twelfthMan: PlannerPlayer | null;
  benchPlayers: PlannerPlayer[];
  hasCaptain: boolean;
  hasWicketKeeper: boolean;
  bowlingOptions: number;
  xiShortfall: number;
};

export type BenchAssignment = {
  player: PlannerPlayer;
  benchMatches: number;
  matchNumbers: number[];
};

export type PlannerSuggestion = {
  rulebook: CricketRulebook;
  availablePlayers: PlannerPlayer[];
  unavailablePlayers: PlannerPlayer[];
  unmatchedAvailabilityNames: string[];
  matchPlans: MatchPlan[];
  benchAssignments: BenchAssignment[];
  reserves: PlannerPlayer[];
  notes: string[];
};

export type PlannerGenerationMode = "friendly" | "tournament";
export type FriendlyMatchAvailabilityOverrides = Record<string, number[]>;
export type PlannerOpportunityStatus =
  | "fully_utilized"
  | "unused_in_xi"
  | "bench_or_12th"
  | "not_selected"
  | "unavailable"
  | "unknown";

type PlannerBatchLookupRow = {
  id?: unknown;
  weekend_date?: unknown;
  weekend_label?: unknown;
  created_at?: unknown;
};

type PlannerAssignmentLookupRow = {
  batch_id?: unknown;
  match_number?: unknown;
  player_id?: unknown;
  member_id?: unknown;
  player_name?: unknown;
  assignment?: unknown;
  is_available?: unknown;
};

type FriendlyOpportunityCorrectionContext = {
  source: "actual" | "planned";
  statusesByPlayerId: Map<string, PlannerOpportunityStatus>;
  boostedPlayers: string[];
  reprioritizedPlayers: string[];
};

function excelSerialToIsoDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);

  if (!parsed) {
    return null;
  }

  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${month}-${day}`;
}

function getWeekendIsoDate(value: unknown) {
  if (typeof value === "number") {
    return excelSerialToIsoDate(value);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return null;
}

function formatWeekendLabel(value: unknown) {
  if (typeof value === "number") {
    const isoDate = excelSerialToIsoDate(value);

    if (isoDate) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(`${isoDate}T00:00:00`));
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(value);
  }

  const normalized = String(value ?? "").trim();
  return normalized || "Unknown Weekend";
}

function isAvailableValue(value: unknown) {
  if (typeof value === "number") {
    return value > 0;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  return ["yes", "y", "available", "1", "true"].includes(normalized);
}

function getColumnLetter(index: number) {
  let current = index + 1;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

export async function parseAttendanceWorkbook(file: File): Promise<PlannerWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null
  });

  const headerRow = rows[0] ?? [];
  const weekends: PlannerWeekendOption[] = [];

  for (let columnIndex = 6; columnIndex < headerRow.length; columnIndex += 1) {
    const headerValue = headerRow[columnIndex];

    if (headerValue === null || headerValue === "") {
      continue;
    }

    const availableNames = rows
      .slice(2)
      .filter((row) => isAvailableValue(row[columnIndex]))
      .map((row) => String(row[0] ?? "").trim())
      .filter(Boolean);

    weekends.push({
      id: `${sheetName}-${columnIndex}`,
      label: formatWeekendLabel(headerValue),
      isoDate: getWeekendIsoDate(headerValue),
      sourceColumn: getColumnLetter(columnIndex),
      availableNames: dedupeAvailabilityNames(availableNames)
    });
  }

  if (weekends.length === 0) {
    throw new Error("No weekend availability columns were found in the uploaded workbook.");
  }

  return {
    sheetName,
    weekends
  };
}

function getPlannerRole(player: PlayerSummary): PlannerPlayer["plannerRole"] {
  const normalizedTags = player.roleTags.map((tag) => tag.trim().toLowerCase());
  const hasAllRounderTag = normalizedTags.includes("all-rounder") || normalizedTags.includes("all rounder");
  const hasBatterTag = normalizedTags.includes("batter");
  const hasBowlerTag = normalizedTags.includes("bowler");

  if (hasAllRounderTag || (hasBatterTag && hasBowlerTag)) {
    return "all-rounder";
  }

  if (hasBowlerTag || player.role === "Bowler") {
    return "bowler";
  }

  return "batter";
}

function getTournamentPlannerRole(player: PlayerSummary): PlannerPlayer["plannerRole"] {
  const hasBattingPerformance = player.totalRuns > 0 || (player.battingMatches > 0 && player.strikeRate !== null);
  const hasBowlingPerformance = player.totalWickets > 0 || (player.bowlingMatches > 0 && player.economy !== null);

  if (hasBattingPerformance && hasBowlingPerformance) {
    return "all-rounder";
  }

  if (
    hasBowlingPerformance
    && (!hasBattingPerformance || player.bowlingMatches > player.battingMatches)
  ) {
    return "bowler";
  }

  if (hasBattingPerformance) {
    return "batter";
  }

  // Fall back only when the player has no usable performance history yet.
  return getPlannerRole(player);
}

function getPlannerScore(player: PlayerSummary) {
  let score = player.matchesPlayed * 3;

  if (player.isCaptain) {
    score += 40;
  }

  if (player.isWicketKeeper) {
    score += 24;
  }

  const plannerRole = getPlannerRole(player);
  if (plannerRole === "all-rounder") {
    score += 18;
  } else if (plannerRole === "bowler") {
    score += 12;
  } else {
    score += 10;
  }

  if (player.battingStyle) {
    score += 2;
  }

  return score;
}

function parsePerformanceMetric(label: string, prefix: "Strike Rate" | "Economy") {
  const pattern = new RegExp(`^${prefix}\\s+([0-9]+(?:\\.[0-9]+)?)$`, "i");
  const match = label.trim().match(pattern);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[1]);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getTournamentPlannerScore(player: PlayerSummary) {
  const plannerRole = getTournamentPlannerRole(player);
  const strikeRate = player.strikeRate ?? parsePerformanceMetric(player.performanceLabel, "Strike Rate");
  const economy = player.economy ?? parsePerformanceMetric(player.performanceLabel, "Economy");
  let score = player.matchesPlayed;

  if (player.isCaptain) {
    score += 8;
  }

  if (player.isWicketKeeper) {
    score += 6;
  }

  if (plannerRole === "all-rounder") {
    score += 8;
  } else if (plannerRole === "bowler") {
    score += 5;
  } else {
    score += 4;
  }

  if (player.totalRuns > 0) {
    score += player.totalRuns * 0.45;
  }

  if (player.totalWickets > 0) {
    score += player.totalWickets * 18;
  }

  if (player.battingMatches > 0) {
    score += player.battingMatches * 1.25;
  }

  if (player.bowlingMatches > 0) {
    score += player.bowlingMatches * 1.5;
  }

  if (strikeRate !== null) {
    score += Math.max(0, strikeRate - 90) * (plannerRole === "all-rounder" ? 0.22 : 0.32);
  }

  if (economy !== null) {
    score += Math.max(0, 8.5 - economy) * (plannerRole === "all-rounder" ? 8 : 11);
  }

  return score;
}

function isPlannerPersistenceMissingError(error: { code?: string | null } | null) {
  return error?.code === "42P01" || error?.code === "42703";
}

function getOpportunityBoost(status: PlannerOpportunityStatus) {
  switch (status) {
    case "unused_in_xi":
      return 20;
    case "bench_or_12th":
      return 10;
    case "not_selected":
      return 5;
    default:
      return 0;
  }
}

function getOpportunityPriority(status: PlannerOpportunityStatus) {
  switch (status) {
    case "unused_in_xi":
      return 0;
    case "bench_or_12th":
      return 1;
    case "not_selected":
      return 2;
    case "fully_utilized":
      return 3;
    case "unknown":
      return 4;
    case "unavailable":
      return 5;
    default:
      return 6;
  }
}

function compareOpportunityForSelection(left: PlannerPlayer, right: PlannerPlayer) {
  const priorityDelta =
    getOpportunityPriority(left.previousOpportunityStatus)
    - getOpportunityPriority(right.previousOpportunityStatus);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (right.previousOpportunityBoost !== left.previousOpportunityBoost) {
    return right.previousOpportunityBoost - left.previousOpportunityBoost;
  }

  if (right.plannerScore !== left.plannerScore) {
    return right.plannerScore - left.plannerScore;
  }

  return left.name.localeCompare(right.name);
}

function compareOpportunityForBenching(left: PlannerPlayer, right: PlannerPlayer) {
  const priorityDelta =
    getOpportunityPriority(right.previousOpportunityStatus)
    - getOpportunityPriority(left.previousOpportunityStatus);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (left.previousOpportunityBoost !== right.previousOpportunityBoost) {
    return left.previousOpportunityBoost - right.previousOpportunityBoost;
  }

  return 0;
}

function normalizePlannerToken(token: string) {
  return token.replace(/[^A-Z0-9]/g, "").trim();
}

function buildPlannerTokenVariants(name: string) {
  const cleanedName = cleanName(name);
  const tokenVariants = new Map<string, string[]>();
  const defaultTokens = cleanedName
    .split(/[\s,]+/)
    .map((token) => normalizePlannerToken(token))
    .filter(Boolean);

  if (defaultTokens.length > 0) {
    tokenVariants.set(defaultTokens.join(" "), defaultTokens);
  }

  if (cleanedName.includes(",")) {
    const commaParts = cleanedName
      .split(",")
      .map((part) =>
        part
          .split(/\s+/)
          .map((token) => normalizePlannerToken(token))
          .filter(Boolean)
      )
      .filter((tokens) => tokens.length > 0);

    if (commaParts.length > 1) {
      const reorderedTokens = [...commaParts.slice(1).flat(), ...commaParts[0]];

      if (reorderedTokens.length > 0) {
        tokenVariants.set(reorderedTokens.join(" "), reorderedTokens);
      }
    }
  }

  return Array.from(tokenVariants.values());
}

function tokenizePlannerName(name: string) {
  return buildPlannerTokenVariants(name)[0] ?? [];
}

function getNormalizedPlannerName(name: string) {
  return tokenizePlannerName(name).join(" ");
}

function getPlannerInitial(tokens: string[]) {
  if (tokens.length < 2) {
    return null;
  }

  const lastToken = tokens[tokens.length - 1];
  return lastToken.length === 1 ? lastToken : null;
}

function arePlannerTokensCompatible(attendanceToken: string, playerToken: string) {
  if (!attendanceToken || !playerToken) {
    return false;
  }

  if (attendanceToken === playerToken) {
    return true;
  }

  if (attendanceToken.length === 1 || playerToken.length === 1) {
    return attendanceToken.startsWith(playerToken) || playerToken.startsWith(attendanceToken);
  }

  return (
    (attendanceToken.length >= 3 && playerToken.startsWith(attendanceToken))
    || (playerToken.length >= 3 && attendanceToken.startsWith(playerToken))
  );
}

function dedupeAvailabilityNames(names: string[]) {
  const seenNames = new Set<string>();
  const dedupedNames: string[] = [];

  names.forEach((name) => {
    const normalizedName = cleanName(name);

    if (!normalizedName || seenNames.has(normalizedName)) {
      return;
    }

    seenNames.add(normalizedName);
    dedupedNames.push(name.trim());
  });

  return dedupedNames;
}

function getPlannerIdentityMatchKeys(player: PlayerSummary & { identityNames?: string[] }) {
  const seenKeys = new Set<string>();
  const sourceNames = [player.name, ...(player.identityNames ?? [])];
  const matchKeys: string[] = [];

  sourceNames.forEach((name) => {
    buildPlannerTokenVariants(name).forEach((tokens) => {
      const key = tokens.join(" ");

      if (!key || seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      matchKeys.push(key);
    });
  });

  return matchKeys;
}

function findPlannerIdentityMatch(
  players: PlannerPlayer[],
  attendanceName: string
) {
  const attendanceKeys = buildPlannerTokenVariants(attendanceName)
    .map((tokens) => tokens.join(" "))
    .filter(Boolean);

  if (attendanceKeys.length === 0) {
    return null;
  }

  const matchedPlayers = players.filter((player) =>
    attendanceKeys.some((key) => player.identityMatchKeys.includes(key))
  );

  return getUniquePlannerPlayer(
    matchedPlayers.filter(
      (player, index, currentPlayers) => currentPlayers.findIndex((item) => item.id === player.id) === index
    )
  );
}

function getUniquePlannerPlayer(candidates: PlannerPlayer[]) {
  return candidates.length === 1 ? candidates[0] : null;
}

function didPlayerActuallyAppearInXi(
  row: PlannerAssignmentLookupRow,
  actualParticipation: PlannerActualParticipation | null
) {
  if (!actualParticipation) {
    return false;
  }

  const normalizedPlayerName = typeof row.player_name === "string"
    ? cleanName(row.player_name)
    : "";
  const playerId = typeof row.player_id === "string" ? row.player_id : null;

  return Boolean(
    (playerId && actualParticipation.listedPlayerIds.has(playerId))
    || (normalizedPlayerName && actualParticipation.listedNameKeys.has(normalizedPlayerName))
  );
}

function didPlayerActuallyUtilizeOpportunity(
  row: PlannerAssignmentLookupRow,
  actualParticipation: PlannerActualParticipation | null
) {
  if (!actualParticipation) {
    return false;
  }

  const normalizedPlayerName = typeof row.player_name === "string"
    ? cleanName(row.player_name)
    : "";
  const playerId = typeof row.player_id === "string" ? row.player_id : null;

  return Boolean(
    (playerId && (
      actualParticipation.battedPlayerIds.has(playerId)
      || actualParticipation.bowledPlayerIds.has(playerId)
    ))
    || (normalizedPlayerName && (
      actualParticipation.battedNameKeys.has(normalizedPlayerName)
      || actualParticipation.bowledNameKeys.has(normalizedPlayerName)
    ))
  );
}

function classifyFriendlyPlannedOpportunity(
  rows: PlannerAssignmentLookupRow[]
): PlannerOpportunityStatus {
  if (rows.length === 0) {
    return "unknown";
  }

  const hasAvailableAssignment = rows.some(
    (row) => row.is_available !== false && row.assignment !== "unavailable"
  );

  if (!hasAvailableAssignment) {
    return "unavailable";
  }

  if (rows.some((row) => row.assignment === "xi")) {
    return "fully_utilized";
  }

  if (rows.some((row) => row.assignment === "twelfth" || row.assignment === "bench")) {
    return "bench_or_12th";
  }

  if (hasAvailableAssignment) {
    return "not_selected";
  }

  return "unknown";
}

function classifyFriendlyActualOpportunity(
  rows: PlannerAssignmentLookupRow[],
  actualLinkMap: Map<string, { matchId: string }>,
  actualParticipationByMatchId: Map<string, PlannerActualParticipation>
): PlannerOpportunityStatus {
  if (rows.length === 0) {
    return "unknown";
  }

  const availableRows = rows.filter((row) => row.is_available !== false && row.assignment !== "unavailable");

  if (availableRows.length === 0) {
    return "unavailable";
  }

  const utilizedActualRows = availableRows.filter((row) => {
    const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
    const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
    const actualLink = batchId && matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
    const actualParticipation = actualLink
      ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
      : null;

    return didPlayerActuallyUtilizeOpportunity(row, actualParticipation);
  });

  if (utilizedActualRows.length > 0) {
    return "fully_utilized";
  }

  const listedActualRows = availableRows.filter((row) => {
    const batchId = typeof row.batch_id === "string" ? row.batch_id : null;
    const matchNumber = typeof row.match_number === "number" ? row.match_number : null;
    const actualLink = batchId && matchNumber ? actualLinkMap.get(`${batchId}:${matchNumber}`) ?? null : null;
    const actualParticipation = actualLink
      ? (actualParticipationByMatchId.get(actualLink.matchId) ?? null)
      : null;

    return didPlayerActuallyAppearInXi(row, actualParticipation);
  });

  if (listedActualRows.length > 0) {
    return "unused_in_xi";
  }

  if (availableRows.some((row) => row.assignment === "twelfth" || row.assignment === "bench")) {
    return "bench_or_12th";
  }

  if (availableRows.length > 0) {
    return "not_selected";
  }

  return "unknown";
}

async function getFriendlyOpportunityCorrectionContext(
  players: PlannerPlayerSummary[],
  season?: string
): Promise<FriendlyOpportunityCorrectionContext | null> {
  if (players.length === 0) {
    return null;
  }

  const { teamId } = await getActiveTeamContext();
  let batchesQuery = supabase
    .from("planner_matchday_batches")
    .select("id, weekend_date, weekend_label, created_at")
    .eq("team_id", teamId)
    .eq("planner_mode", "friendly")
    .order("weekend_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (season) {
    batchesQuery = batchesQuery.eq("season", season);
  }

  const { data: batchData, error: batchError } = await batchesQuery;

  if (batchError) {
    if (isPlannerPersistenceMissingError(batchError)) {
      return null;
    }

    throw new Error("Could not load the previous planner matchday for fairness correction.");
  }

  const batchRows = (batchData ?? []) as PlannerBatchLookupRow[];
  const orderedBatchIds = batchRows
    .flatMap((row) => (typeof row.id === "string" ? [row.id] : []));

  if (orderedBatchIds.length === 0) {
    return null;
  }

  const actualLinkMap = await getPlannerActualMatchLinkMap(teamId, orderedBatchIds);
  const firstBatchWithActual = orderedBatchIds.find((batchId) =>
    Array.from(actualLinkMap.keys()).some((key) => key.startsWith(`${batchId}:`))
  ) ?? null;
  const targetBatchId = firstBatchWithActual ?? orderedBatchIds[0];
  const source = firstBatchWithActual ? "actual" as const : "planned" as const;

  const { data: assignmentData, error: assignmentError } = await supabase
    .from("planner_matchday_assignments")
    .select("batch_id, match_number, player_id, member_id, player_name, assignment, is_available")
    .eq("team_id", teamId)
    .eq("batch_id", targetBatchId);

  if (assignmentError) {
    if (isPlannerPersistenceMissingError(assignmentError)) {
      return null;
    }

    throw new Error("Could not load the previous planner assignments for fairness correction.");
  }

  const assignmentRows = (assignmentData ?? []) as PlannerAssignmentLookupRow[];

  if (assignmentRows.length === 0) {
    return null;
  }

  const targetLinkMap = new Map(
    Array.from(actualLinkMap.entries()).filter(([key]) => key.startsWith(`${targetBatchId}:`))
  );
  const targetMatchIds = Array.from(new Set(Array.from(targetLinkMap.values()).map((row) => row.matchId)));
  const actualParticipationByMatchId = source === "actual"
    ? await getPlannerActualParticipationByMatch(teamId, targetMatchIds)
    : new Map<string, PlannerActualParticipation>();
  const assignmentsByIdentityId = new Map<string, PlannerAssignmentLookupRow[]>();

  assignmentRows.forEach((row) => {
    const identityId = typeof row.member_id === "string"
      ? row.member_id
      : typeof row.player_id === "string"
        ? row.player_id
        : null;

    if (!identityId) {
      return;
    }

    const currentRows = assignmentsByIdentityId.get(identityId) ?? [];
    currentRows.push(row);
    assignmentsByIdentityId.set(identityId, currentRows);
  });

  const statusesByPlayerId = new Map<string, PlannerOpportunityStatus>();
  const boostedPlayers: string[] = [];
  const reprioritizedPlayers: string[] = [];

  players.forEach((player) => {
    const rows = [
      ...(assignmentsByIdentityId.get(player.memberId) ?? []),
      ...(player.playerId ? (assignmentsByIdentityId.get(player.playerId) ?? []) : [])
    ].filter((row, index, currentRows) =>
      currentRows.findIndex((candidate) =>
        candidate.batch_id === row.batch_id
        && candidate.match_number === row.match_number
        && candidate.assignment === row.assignment
        && candidate.member_id === row.member_id
        && candidate.player_id === row.player_id
      ) === index
    );

    const status = source === "actual"
      ? classifyFriendlyActualOpportunity(rows, targetLinkMap, actualParticipationByMatchId)
      : classifyFriendlyPlannedOpportunity(rows);

    statusesByPlayerId.set(player.id, status);

    if (getOpportunityBoost(status) > 0) {
      boostedPlayers.push(player.name);
    }

    if (status === "unused_in_xi") {
      reprioritizedPlayers.push(player.name);
    }
  });

  return {
    source,
    statusesByPlayerId,
    boostedPlayers,
    reprioritizedPlayers
  };
}

function findPlannerPlayerMatchForTokens(players: PlannerPlayer[], attendanceTokens: string[]) {
  if (attendanceTokens.length === 0) {
    return null;
  }

  const normalizedAttendanceName = attendanceTokens.join(" ");
  const attendanceFirstToken = attendanceTokens[0] ?? "";
  const attendanceInitial = getPlannerInitial(attendanceTokens);
  const exactMatches = players.filter((player) => player.normalizedMatchKeys.includes(normalizedAttendanceName));
  const exactMatch = getUniquePlannerPlayer(exactMatches);

  if (exactMatch) {
    return exactMatch;
  }

  const sameFirstTokenPlayers = players.filter((player) => player.normalizedTokens[0] === attendanceFirstToken);
  const singleSameFirstTokenPlayer = sameFirstTokenPlayers[0] ?? null;

  if (
    sameFirstTokenPlayers.length === 1
    && singleSameFirstTokenPlayer
    && (attendanceTokens.length === 1 || singleSameFirstTokenPlayer.normalizedTokens.length === 1)
  ) {
    return singleSameFirstTokenPlayer;
  }

  if (attendanceInitial) {
    const initialMatches = sameFirstTokenPlayers.filter((player) => player.normalizedInitial === attendanceInitial);
    const initialMatch = getUniquePlannerPlayer(initialMatches);

    if (initialMatch) {
      return initialMatch;
    }
  }

  const prefixMatches = sameFirstTokenPlayers.filter((player) =>
    normalizedAttendanceName.startsWith(player.normalizedName)
    || player.normalizedName.startsWith(normalizedAttendanceName)
  );
  const prefixMatch = getUniquePlannerPlayer(prefixMatches);

  if (prefixMatch) {
    return prefixMatch;
  }

  const tokenSetMatchCandidates = players.filter((player) => {
    if (attendanceTokens.length === 0 || attendanceTokens.length > player.normalizedTokens.length) {
      return false;
    }

    if (!arePlannerTokensCompatible(attendanceFirstToken, player.normalizedTokens[0] ?? "")) {
      return false;
    }

    return attendanceTokens.slice(1).every((attendanceToken) =>
      player.normalizedTokens.slice(1).some((playerToken) => arePlannerTokensCompatible(attendanceToken, playerToken))
    );
  });

  if (tokenSetMatchCandidates.length === 1) {
    return tokenSetMatchCandidates[0];
  }

  const firstTokenPrefixCandidates = players.filter((player) => {
    const playerFirstToken = player.normalizedTokens[0] ?? "";

    if (!attendanceFirstToken || !playerFirstToken) {
      return false;
    }

    return attendanceFirstToken !== playerFirstToken
      && (
        attendanceFirstToken.startsWith(playerFirstToken)
        || playerFirstToken.startsWith(attendanceFirstToken)
      );
  });

  if (firstTokenPrefixCandidates.length === 1) {
    return firstTokenPrefixCandidates[0];
  }

  if (attendanceInitial) {
    const prefixedInitialMatches = firstTokenPrefixCandidates.filter((player) => {
      return player.normalizedInitial === attendanceInitial || player.normalizedInitial === null;
    });
    const prefixedInitialMatch = getUniquePlannerPlayer(prefixedInitialMatches);

    if (prefixedInitialMatch) {
      return prefixedInitialMatch;
    }
  }

  return null;
}

function findPlannerPlayerMatch(players: PlannerPlayer[], attendanceName: string) {
  const attendanceTokenVariants = buildPlannerTokenVariants(attendanceName);

  for (const attendanceTokens of attendanceTokenVariants) {
    const matchedPlayer = findPlannerPlayerMatchForTokens(players, attendanceTokens);

    if (matchedPlayer) {
      return matchedPlayer;
    }
  }

  return null;
}

function rotateArray<T>(items: T[], offset: number) {
  if (items.length === 0) {
    return items;
  }

  const normalizedOffset = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function buildSingleMatchPlan(
  players: PlannerPlayer[],
  matchNumber: number,
  preferredWicketKeeperId?: string
) {
  const captain = players.find((player) => player.isCaptain) ?? null;
  const wicketKeeper = players.find((player) => player.id === preferredWicketKeeperId)
    ?? players.find((player) => player.isWicketKeeper)
    ?? null;
  const lockedIds = new Set<string>(
    [captain?.id, wicketKeeper?.id].filter((value): value is string => Boolean(value))
  );
  const rotatedPool = rotateArray(
    players.filter((player) => !lockedIds.has(player.id)),
    (matchNumber - 1) * 3
  );
  const selected = new Map<string, PlannerPlayer>();

  const addPlayer = (player: PlannerPlayer | null | undefined) => {
    if (!player || selected.has(player.id) || selected.size >= 11) {
      return;
    }

    selected.set(player.id, player);
  };

  addPlayer(captain);
  addPlayer(wicketKeeper);

  rotatedPool.filter((player) => player.plannerRole === "all-rounder").forEach((player) => {
    if (Array.from(selected.values()).filter((item) => item.plannerRole === "all-rounder").length < 2) {
      addPlayer(player);
    }
  });

  rotatedPool.filter((player) => player.plannerRole === "bowler").forEach((player) => {
    if (Array.from(selected.values()).filter((item) => item.plannerRole === "bowler").length < 3) {
      addPlayer(player);
    }
  });

  rotatedPool.filter((player) => player.plannerRole === "batter").forEach((player) => {
    if (Array.from(selected.values()).filter((item) => item.plannerRole === "batter").length < 4) {
      addPlayer(player);
    }
  });

  rotatedPool.forEach((player) => addPlayer(player));

  const playingXi = Array.from(selected.values()).slice(0, 11);
  const selectedIds = new Set(playingXi.map((player) => player.id));
  const twelfthMan = players.find((player) => !selectedIds.has(player.id)) ?? null;
  const benchPlayers = players.filter((player) => !selectedIds.has(player.id));
  const hasCaptain = playingXi.some((player) => player.isCaptain);
  const hasWicketKeeper = playingXi.some((player) => player.isWicketKeeper);
  const bowlingOptions = playingXi.filter((player) =>
    player.plannerRole === "bowler" || player.plannerRole === "all-rounder"
  ).length;
  const xiShortfall = Math.max(0, 11 - playingXi.length);

  return {
    matchNumber,
    playingXi,
    twelfthMan,
    benchPlayers,
    hasCaptain,
    hasWicketKeeper,
    bowlingOptions,
    xiShortfall
  };
}

type FriendlyRotationStats = {
  xiCount: number;
  benchCount: number;
  twelfthCount: number;
  lastAppearanceMatch: number | null;
};

function createFriendlyRotationStats(players: PlannerPlayer[]) {
  return new Map<string, FriendlyRotationStats>(
    players.map((player) => [
      player.id,
      {
        xiCount: 0,
        benchCount: 0,
        twelfthCount: 0,
        lastAppearanceMatch: null
      } satisfies FriendlyRotationStats
    ] as const)
  );
}

function sortFriendlyBenchCandidates(
  candidates: PlannerPlayer[],
  statsByPlayerId: Map<string, FriendlyRotationStats>
) {
  return [...candidates].sort((left, right) => {
    const opportunityDelta = compareOpportunityForBenching(left, right);

    if (opportunityDelta !== 0) {
      return opportunityDelta;
    }

    const leftStats = statsByPlayerId.get(left.id);
    const rightStats = statsByPlayerId.get(right.id);
    const leftBenchCount = leftStats?.benchCount ?? 0;
    const rightBenchCount = rightStats?.benchCount ?? 0;

    if (leftBenchCount !== rightBenchCount) {
      return leftBenchCount - rightBenchCount;
    }

    const leftXiCount = leftStats?.xiCount ?? 0;
    const rightXiCount = rightStats?.xiCount ?? 0;

    if (leftXiCount !== rightXiCount) {
      return rightXiCount - leftXiCount;
    }

    const leftTwelfthCount = leftStats?.twelfthCount ?? 0;
    const rightTwelfthCount = rightStats?.twelfthCount ?? 0;

    if (leftTwelfthCount !== rightTwelfthCount) {
      return leftTwelfthCount - rightTwelfthCount;
    }

    const leftLastAppearance = leftStats?.lastAppearanceMatch ?? -1;
    const rightLastAppearance = rightStats?.lastAppearanceMatch ?? -1;

    if (leftLastAppearance !== rightLastAppearance) {
      return leftLastAppearance - rightLastAppearance;
    }

    return compareOpportunityForSelection(left, right);
  });
}

function sortFriendlyTwelfthCandidates(
  candidates: PlannerPlayer[],
  statsByPlayerId: Map<string, FriendlyRotationStats>
) {
  return [...candidates].sort((left, right) => {
    const opportunityDelta = compareOpportunityForSelection(left, right);

    if (opportunityDelta !== 0) {
      return opportunityDelta;
    }

    const leftStats = statsByPlayerId.get(left.id);
    const rightStats = statsByPlayerId.get(right.id);
    const leftTwelfthCount = leftStats?.twelfthCount ?? 0;
    const rightTwelfthCount = rightStats?.twelfthCount ?? 0;

    if (leftTwelfthCount !== rightTwelfthCount) {
      return leftTwelfthCount - rightTwelfthCount;
    }

    const leftBenchCount = leftStats?.benchCount ?? 0;
    const rightBenchCount = rightStats?.benchCount ?? 0;

    if (leftBenchCount !== rightBenchCount) {
      return leftBenchCount - rightBenchCount;
    }

    const leftXiCount = leftStats?.xiCount ?? 0;
    const rightXiCount = rightStats?.xiCount ?? 0;

    if (leftXiCount !== rightXiCount) {
      return rightXiCount - leftXiCount;
    }

    return compareOpportunityForSelection(left, right);
  });
}

function canBenchFriendlyPlayer(
  candidate: PlannerPlayer,
  benchIds: Set<string>,
  allPlayers: PlannerPlayer[],
  preferredWicketKeeperId?: string
) {
  const prospectiveBenchIds = new Set(benchIds);
  prospectiveBenchIds.add(candidate.id);
  const remainingPlayers = allPlayers.filter((player) => !prospectiveBenchIds.has(player.id));

  if (remainingPlayers.length < Math.min(11, allPlayers.length)) {
    return false;
  }

  const hasCaptain = remainingPlayers.some((player) => player.isCaptain);

  if (!hasCaptain) {
    return false;
  }

  const hasWicketKeeper = remainingPlayers.some((player) =>
    player.id === preferredWicketKeeperId || player.isWicketKeeper
  );

  if (!hasWicketKeeper) {
    return false;
  }

  const bowlingOptions = remainingPlayers.filter((player) =>
    player.plannerRole === "bowler" || player.plannerRole === "all-rounder"
  ).length;

  return bowlingOptions >= 3 || remainingPlayers.length < 11;
}

function buildFriendlyMatchPlans(
  players: PlannerPlayer[],
  matchCount: number,
  preferredWicketKeeperId?: string,
  matchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides
) {
  const statsByPlayerId = createFriendlyRotationStats(players);
  const matchPlans: MatchPlan[] = [];

  const updateAppearance = (player: PlannerPlayer, assignment: "xi" | "bench" | "twelfth", matchNumber: number) => {
    const currentStats = statsByPlayerId.get(player.id);

    if (!currentStats) {
      return;
    }

    if (assignment === "xi") {
      currentStats.xiCount += 1;
    } else if (assignment === "bench") {
      currentStats.benchCount += 1;
    } else {
      currentStats.benchCount += 1;
      currentStats.twelfthCount += 1;
    }

    currentStats.lastAppearanceMatch = matchNumber;
  };

  for (let matchNumber = 1; matchNumber <= matchCount; matchNumber += 1) {
    const eligiblePlayers = players
      .filter((player) => {
        const eligibleMatches = matchAvailabilityOverrides?.[player.id];

        if (!eligibleMatches) {
          return true;
        }

        if (eligibleMatches.length === 0) {
          return false;
        }

        return eligibleMatches.includes(matchNumber);
      })
      .sort(compareOpportunityForSelection);
    const captain = eligiblePlayers.find((player) => player.isCaptain) ?? null;
    const wicketKeeper = eligiblePlayers.find((player) => player.id === preferredWicketKeeperId)
      ?? eligiblePlayers.find((player) => player.isWicketKeeper)
      ?? null;
    const lockedIds = new Set<string>(
      [captain?.id, wicketKeeper?.id].filter((value): value is string => Boolean(value))
    );
    const benchSlots = Math.max(0, eligiblePlayers.length - 11);
    const benchIds = new Set<string>();
    const benchCandidates = sortFriendlyBenchCandidates(
      eligiblePlayers.filter((player) => !lockedIds.has(player.id)),
      statsByPlayerId
    );

    benchCandidates.forEach((player) => {
      if (benchIds.size >= benchSlots || benchIds.has(player.id)) {
        return;
      }

      if (canBenchFriendlyPlayer(player, benchIds, eligiblePlayers, preferredWicketKeeperId)) {
        benchIds.add(player.id);
      }
    });

    if (benchIds.size < benchSlots) {
      benchCandidates.forEach((player) => {
        if (benchIds.size >= benchSlots || benchIds.has(player.id)) {
          return;
        }

        benchIds.add(player.id);
      });
    }

    const lockedPlayingXi = [
      captain,
      wicketKeeper
    ].filter((player, index, currentPlayers): player is PlannerPlayer => {
      if (!player) {
        return false;
      }

      return (
        !benchIds.has(player.id)
        && currentPlayers.findIndex((candidate) => candidate?.id === player.id) === index
      );
    });
    const nonLockedPlayingXi = eligiblePlayers
      .filter((player) => !benchIds.has(player.id) && !lockedIds.has(player.id))
      .sort(compareOpportunityForSelection);
    const playingXi = [...lockedPlayingXi, ...nonLockedPlayingXi].slice(0, 11);
    const benchPlayers = eligiblePlayers.filter((player) => benchIds.has(player.id));
    const twelfthCandidates = sortFriendlyTwelfthCandidates(benchPlayers, statsByPlayerId);
    const twelfthMan = twelfthCandidates[0] ?? null;
    const hasCaptain = playingXi.some((player) => player.isCaptain);
    const hasWicketKeeper = playingXi.some((player) => player.id === preferredWicketKeeperId || player.isWicketKeeper);
    const bowlingOptions = playingXi.filter((player) =>
      player.plannerRole === "bowler" || player.plannerRole === "all-rounder"
    ).length;
    const xiShortfall = Math.max(0, 11 - playingXi.length);

    playingXi.forEach((player) => updateAppearance(player, "xi", matchNumber));

    benchPlayers.forEach((player) => {
      updateAppearance(player, player.id === twelfthMan?.id ? "twelfth" : "bench", matchNumber);
    });

    matchPlans.push({
      matchNumber,
      playingXi,
      twelfthMan,
      benchPlayers,
      hasCaptain,
      hasWicketKeeper,
      bowlingOptions,
      xiShortfall
    });
  }

  return matchPlans;
}

function buildPlannerSuggestionInternal(
  players: PlannerPlayerSummary[],
  availableNames: string[],
  maxMatches: number,
  manualAvailabilityOverrides?: Record<string, boolean>,
  preferredWicketKeeperId?: string,
  plannerMode: PlannerGenerationMode = "friendly",
  friendlyMatchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides,
  opportunityContext?: FriendlyOpportunityCorrectionContext | null,
  availableMemberIds?: string[]
): PlannerSuggestion {
  const rulebook = inferCricketRulebook("T10", "T10");
  const enhancedPlayers: PlannerPlayer[] = players
    .map((player) => ({
      ...player,
      identityMatchKeys: getPlannerIdentityMatchKeys(player),
      normalizedName: getNormalizedPlannerName(player.name),
      normalizedMatchKeys: buildPlannerTokenVariants(player.name).map((tokens) => tokens.join(" ")),
      normalizedTokens: tokenizePlannerName(player.name),
      normalizedInitial: getPlannerInitial(tokenizePlannerName(player.name)),
      plannerRole: plannerMode === "friendly"
        ? getPlannerRole(player)
        : getTournamentPlannerRole(player),
      previousOpportunityStatus: plannerMode === "friendly"
        ? (opportunityContext?.statusesByPlayerId.get(player.id) ?? "unknown")
        : "unknown",
      previousOpportunityBoost: plannerMode === "friendly"
        ? getOpportunityBoost(opportunityContext?.statusesByPlayerId.get(player.id) ?? "unknown")
        : 0,
      plannerScore: (
        plannerMode === "friendly"
          ? getPlannerScore(player)
          : getTournamentPlannerScore(player)
      ) + (
        plannerMode === "friendly"
          ? getOpportunityBoost(opportunityContext?.statusesByPlayerId.get(player.id) ?? "unknown")
          : 0
      )
    }))
    .sort((left, right) => {
      if (plannerMode === "friendly") {
        return compareOpportunityForSelection(left, right);
      }

      if (right.plannerScore !== left.plannerScore) {
        return right.plannerScore - left.plannerScore;
      }

      return left.name.localeCompare(right.name);
    });

  const matchedPlayerIds = new Set<string>();
  const unmatchedAvailabilityNames: string[] = [];
  const uniqueAvailableNames = dedupeAvailabilityNames(availableNames);

  if (availableMemberIds && availableMemberIds.length > 0) {
    const availableMemberIdSet = new Set(availableMemberIds);

    enhancedPlayers.forEach((player) => {
      if (
        availableMemberIdSet.has(player.memberId)
        || (player.playerId && availableMemberIdSet.has(player.playerId))
        || availableMemberIdSet.has(player.id)
      ) {
        matchedPlayerIds.add(player.id);
      }
    });
  } else {
    uniqueAvailableNames.forEach((attendanceName) => {
      const matchedPlayer =
        findPlannerIdentityMatch(enhancedPlayers, attendanceName)
        ?? findPlannerPlayerMatch(enhancedPlayers, attendanceName);

      if (matchedPlayer) {
        matchedPlayerIds.add(matchedPlayer.id);
      } else {
        unmatchedAvailabilityNames.push(attendanceName);
      }
    });
  }

  if (manualAvailabilityOverrides) {
    Object.entries(manualAvailabilityOverrides).forEach(([playerId, isAvailable]) => {
      if (isAvailable) {
        matchedPlayerIds.add(playerId);
      } else {
        matchedPlayerIds.delete(playerId);
      }
    });
  }

  const baseAvailablePlayers = enhancedPlayers.filter((player) => matchedPlayerIds.has(player.id));
  const baseUnavailablePlayers = enhancedPlayers.filter((player) => !matchedPlayerIds.has(player.id));
  const fullDayUnavailablePlayerIds = plannerMode === "friendly"
    ? new Set(
      Object.entries(friendlyMatchAvailabilityOverrides ?? {})
        .filter(([, eligibleMatches]) => eligibleMatches.length === 0)
        .map(([playerId]) => playerId)
    )
    : new Set<string>();
  const availablePlayers = baseAvailablePlayers.filter((player) => !fullDayUnavailablePlayerIds.has(player.id));
  const unavailablePlayers = [
    ...baseUnavailablePlayers,
    ...baseAvailablePlayers.filter((player) => fullDayUnavailablePlayerIds.has(player.id))
  ];
  const matchCount = Math.max(1, Math.min(3, maxMatches));
  const matchPlans = plannerMode === "friendly"
    ? buildFriendlyMatchPlans(
      availablePlayers,
      matchCount,
      preferredWicketKeeperId,
      friendlyMatchAvailabilityOverrides
    )
    : Array.from({ length: matchCount }, (_, index) =>
      buildSingleMatchPlan(availablePlayers, index + 1, preferredWicketKeeperId)
    );
  const benchAssignmentMap = new Map<string, BenchAssignment>();

  matchPlans.forEach((plan) => {
    if (!plan.twelfthMan) {
      return;
    }

    const existing = benchAssignmentMap.get(plan.twelfthMan.id) ?? {
      player: plan.twelfthMan,
      benchMatches: 0,
      matchNumbers: []
    };

    existing.benchMatches += 1;
    existing.matchNumbers.push(plan.matchNumber);
    benchAssignmentMap.set(plan.twelfthMan.id, existing);
  });

  const benchAssignments = Array.from(benchAssignmentMap.values()).sort((left, right) => {
    if (right.benchMatches !== left.benchMatches) {
      return right.benchMatches - left.benchMatches;
    }

    return left.player.name.localeCompare(right.player.name);
  });
  const usedPlayerIds = new Set(
    matchPlans.flatMap((plan) => [
      ...plan.playingXi.map((player) => player.id),
      ...(plan.twelfthMan ? [plan.twelfthMan.id] : [])
    ])
  );
  const reserves = availablePlayers.filter((player) => !usedPlayerIds.has(player.id));
  const notes: string[] = [];

  if (availablePlayers.length < 11) {
    notes.push(`Only ${availablePlayers.length} available squad players were matched. You need at least 11 to field a full XI.`);
  } else if (availablePlayers.length === 11) {
    notes.push("Exactly 11 available squad players were matched. No 12th man is currently available.");
  } else if (availablePlayers.length === 12) {
    notes.push("Exactly 12 available squad players were matched. The planner can propose one XI and one 12th man.");
  } else {
    notes.push(
      plannerMode === "friendly"
        ? `${availablePlayers.length} available squad players were matched. Friendly plans now rotate XI and 12th-man opportunities more fairly across the day.`
        : `${availablePlayers.length} available squad players were matched. The planner reshuffled XI and 12th-man suggestions across up to ${matchCount} matches.`
    );
  }

  if (unmatchedAvailabilityNames.length > 0) {
    notes.push(`${unmatchedAvailabilityNames.length} attendance names did not match the current squad automatically and should be reviewed.`);
  }

  if (!availablePlayers.some((player) => player.isCaptain)) {
    notes.push("No captain was matched in the available squad. Review leadership coverage before using the generated plan.");
  }

  if (!availablePlayers.some((player) => player.isWicketKeeper)) {
    notes.push("No wicket keeper was matched in the available squad. Review the attendance list or assign one manually before the matchday.");
  }

  const bowlingCoverage = availablePlayers.filter((player) =>
    player.plannerRole === "bowler" || player.plannerRole === "all-rounder"
  ).length;

  if (availablePlayers.length >= 11 && bowlingCoverage < 3) {
    notes.push(`Only ${bowlingCoverage} bowling option${bowlingCoverage === 1 ? "" : "s"} were matched. The generated XI may be light on bowling coverage.`);
  }

  if (plannerMode === "friendly" && opportunityContext) {
    if (opportunityContext.source === "actual") {
      notes.push(
        "Previous actual-result correction applied for available unused_in_xi players."
      );
    } else {
      notes.push(
        "No linked actual result exists for the previous friendly matchday. The planner fell back to the saved fairness history ordering."
      );
    }
  }

  return {
    rulebook,
    availablePlayers,
    unavailablePlayers,
    unmatchedAvailabilityNames,
    matchPlans,
    benchAssignments,
    reserves,
    notes
  };
}

export function buildPlannerSuggestion(
  players: PlannerPlayerSummary[],
  availableNames: string[],
  maxMatches: number,
  manualAvailabilityOverrides?: Record<string, boolean>,
  preferredWicketKeeperId?: string,
  plannerMode: PlannerGenerationMode = "friendly",
  friendlyMatchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides
): PlannerSuggestion {
  return buildPlannerSuggestionInternal(
    players,
    availableNames,
    maxMatches,
    manualAvailabilityOverrides,
    preferredWicketKeeperId,
    plannerMode,
    friendlyMatchAvailabilityOverrides,
    null,
    undefined
  );
}

export function buildPlannerSuggestionFromMembers(
  players: PlannerPlayerSummary[],
  availableMemberIds: string[],
  maxMatches: number,
  manualAvailabilityOverrides?: Record<string, boolean>,
  preferredWicketKeeperId?: string,
  plannerMode: PlannerGenerationMode = "friendly",
  friendlyMatchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides
): PlannerSuggestion {
  return buildPlannerSuggestionInternal(
    players,
    [],
    maxMatches,
    manualAvailabilityOverrides,
    preferredWicketKeeperId,
    plannerMode,
    friendlyMatchAvailabilityOverrides,
    null,
    availableMemberIds
  );
}

export async function buildPlannerSuggestionForRelease(
  players: PlannerPlayerSummary[],
  availableNames: string[],
  maxMatches: number,
  manualAvailabilityOverrides?: Record<string, boolean>,
  preferredWicketKeeperId?: string,
  plannerMode: PlannerGenerationMode = "friendly",
  friendlyMatchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides,
  season?: string
): Promise<PlannerSuggestion> {
  const opportunityContext = plannerMode === "friendly"
    ? await getFriendlyOpportunityCorrectionContext(players, season)
    : null;

  return buildPlannerSuggestionInternal(
    players,
    availableNames,
    maxMatches,
    manualAvailabilityOverrides,
    preferredWicketKeeperId,
    plannerMode,
    friendlyMatchAvailabilityOverrides,
    opportunityContext,
    undefined
  );
}

export async function buildPlannerSuggestionForReleaseFromMembers(
  players: PlannerPlayerSummary[],
  availableMemberIds: string[],
  maxMatches: number,
  manualAvailabilityOverrides?: Record<string, boolean>,
  preferredWicketKeeperId?: string,
  plannerMode: PlannerGenerationMode = "friendly",
  friendlyMatchAvailabilityOverrides?: FriendlyMatchAvailabilityOverrides,
  season?: string
): Promise<PlannerSuggestion> {
  const opportunityContext = plannerMode === "friendly"
    ? await getFriendlyOpportunityCorrectionContext(players, season)
    : null;

  return buildPlannerSuggestionInternal(
    players,
    [],
    maxMatches,
    manualAvailabilityOverrides,
    preferredWicketKeeperId,
    plannerMode,
    friendlyMatchAvailabilityOverrides,
    opportunityContext,
    availableMemberIds
  );
}
