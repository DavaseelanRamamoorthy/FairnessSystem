import * as XLSX from "xlsx";

import { PlayerSummary } from "@/app/services/playerProfileService";
import { cleanName } from "@/app/services/cleanName";
import { CricketRulebook, inferCricketRulebook } from "@/app/services/cricketRulebook";

export type PlannerWeekendOption = {
  id: string;
  label: string;
  sourceColumn: string;
  availableNames: string[];
};

export type PlannerWorkbook = {
  sheetName: string;
  weekends: PlannerWeekendOption[];
};

export type PlannerPlayer = PlayerSummary & {
  normalizedName: string;
  normalizedTokens: string[];
  normalizedInitial: string | null;
  plannerRole: "batter" | "bowler" | "all-rounder";
  plannerScore: number;
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

function excelSerialToIsoDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);

  if (!parsed) {
    return null;
  }

  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${month}-${day}`;
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

function tokenizePlannerName(name: string) {
  return cleanName(name)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
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

function findPlannerPlayerMatch(players: PlannerPlayer[], attendanceName: string) {
  const normalizedAttendanceName = cleanName(attendanceName);
  const attendanceTokens = tokenizePlannerName(attendanceName);
  const attendanceFirstToken = attendanceTokens[0] ?? "";
  const attendanceInitial = getPlannerInitial(attendanceTokens);

  const exactMatch = players.find((player) => player.normalizedName === normalizedAttendanceName);
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
    const initialMatch = sameFirstTokenPlayers.find((player) => player.normalizedInitial === attendanceInitial);
    if (initialMatch) {
      return initialMatch;
    }
  }

  const prefixMatch = sameFirstTokenPlayers.find((player) =>
    normalizedAttendanceName.startsWith(player.normalizedName)
    || player.normalizedName.startsWith(normalizedAttendanceName)
  );

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
    const prefixedInitialMatch = firstTokenPrefixCandidates.find((player) => {
      return player.normalizedInitial === attendanceInitial || player.normalizedInitial === null;
    });

    if (prefixedInitialMatch) {
      return prefixedInitialMatch;
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

export function buildPlannerSuggestion(
  players: PlayerSummary[],
  availableNames: string[],
  maxMatches: number,
  manualAvailabilityOverrides?: Record<string, boolean>,
  preferredWicketKeeperId?: string
): PlannerSuggestion {
  const rulebook = inferCricketRulebook("T10", "T10");
  const enhancedPlayers: PlannerPlayer[] = players
    .map((player) => ({
      ...player,
      normalizedName: cleanName(player.name),
      normalizedTokens: tokenizePlannerName(player.name),
      normalizedInitial: getPlannerInitial(tokenizePlannerName(player.name)),
      plannerRole: getPlannerRole(player),
      plannerScore: getPlannerScore(player)
    }))
    .sort((left, right) => {
      if (right.plannerScore !== left.plannerScore) {
        return right.plannerScore - left.plannerScore;
      }

      return left.name.localeCompare(right.name);
    });

  const matchedPlayerIds = new Set<string>();
  const unmatchedAvailabilityNames: string[] = [];
  const uniqueAvailableNames = dedupeAvailabilityNames(availableNames);

  uniqueAvailableNames.forEach((attendanceName) => {
    const matchedPlayer = findPlannerPlayerMatch(enhancedPlayers, attendanceName);

    if (matchedPlayer) {
      matchedPlayerIds.add(matchedPlayer.id);
    } else {
      unmatchedAvailabilityNames.push(attendanceName);
    }
  });

  if (manualAvailabilityOverrides) {
    Object.entries(manualAvailabilityOverrides).forEach(([playerId, isAvailable]) => {
      if (isAvailable) {
        matchedPlayerIds.add(playerId);
      } else {
        matchedPlayerIds.delete(playerId);
      }
    });
  }

  const availablePlayers = enhancedPlayers.filter((player) => matchedPlayerIds.has(player.id));
  const unavailablePlayers = enhancedPlayers.filter((player) => !matchedPlayerIds.has(player.id));
  const matchCount = Math.max(1, Math.min(3, maxMatches));
  const matchPlans = Array.from({ length: matchCount }, (_, index) =>
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
    notes.push(`${availablePlayers.length} available squad players were matched. The planner reshuffled XI and 12th-man suggestions across up to ${matchCount} matches.`);
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
