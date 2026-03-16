import { ParsedMatch, SquadPlayer, TeamSquad } from "../types/match.types";
import {
  hasCaptainMarker,
  hasWicketKeeperMarker,
  normalizeLooseTextKey,
  normalizeMatchWhitespace,
  parseDelimitedPlayerList,
  stripNameAnnotations
} from "./matchTextNormalization";

type BattingStat = NonNullable<ParsedMatch["innings"][number]["battingStats"]>[number];
type BowlingStat = NonNullable<ParsedMatch["innings"][number]["bowlingStats"]>[number];
type FallOfWicket = NonNullable<ParsedMatch["innings"][number]["fallOfWickets"]>[number];

function parseBattingStats(block: string): BattingStat[] {
  const battingSectionMatch = block.match(/No\s+Batsman\s+Status\s+R\s+B\s+M\s+4s\s+6s\s+SR\s+([\s\S]+?)\s+Extras:/i);

  if (!battingSectionMatch) {
    return [];
  }

  const battingSection = battingSectionMatch[1];
  const rowRegex = /(\d+)\s+(.+?)(?=\s+\d+\s+[A-Za-z]|\s*$)/g;
  const battingStats: BattingStat[] = [];

  let rowMatch;
  while ((rowMatch = rowRegex.exec(battingSection)) !== null) {
    const row = `${rowMatch[1]} ${rowMatch[2]}`.trim();
    const tokens = row.split(/\s+/);

    const battingPosition = parseInt(tokens.shift() ?? "", 10);
    const strikeRate = parseFloat(tokens.pop() ?? "");
    const sixes = parseInt(tokens.pop() ?? "", 10);
    const fours = parseInt(tokens.pop() ?? "", 10);
    const minutes = parseInt(tokens.pop() ?? "", 10);
    const balls = parseInt(tokens.pop() ?? "", 10);
    const runsValue = parseInt(tokens.pop() ?? "", 10);

    if (
      Number.isNaN(battingPosition)
      || Number.isNaN(strikeRate)
      || Number.isNaN(sixes)
      || Number.isNaN(fours)
      || Number.isNaN(minutes)
      || Number.isNaN(balls)
      || Number.isNaN(runsValue)
      || tokens.length === 0
    ) {
      continue;
    }

    const dismissalTokens: string[] = [];
    while (tokens.length > 0 && !tokens[tokens.length - 1].includes("(")) {
      dismissalTokens.unshift(tokens.pop() ?? "");
    }

    const dismissal = normalizeMatchWhitespace(dismissalTokens.join(" "));
    const battingStyleToken = tokens.pop() ?? "";
    const rawName = normalizeMatchWhitespace(tokens.join(" "));

    if (!rawName) {
      continue;
    }

    battingStats.push({
      player_name: stripNameAnnotations(rawName),
      batting_position: battingPosition,
      batting_style: battingStyleToken ? battingStyleToken.replace(/[()]/g, "") : null,
      isCaptain: hasCaptainMarker(rawName),
      isWicketKeeper: hasWicketKeeperMarker(rawName),
      dismissal: dismissal || "not out",
      runs: runsValue,
      balls,
      minutes,
      fours,
      sixes,
      strike_rate: strikeRate
    });
  }

  return battingStats;
}

function parseBowlingStats(block: string): BowlingStat[] {
  const bowlingSectionMatch = block.match(
    /No\s+Bowler\s+O\s+M\s+R\s+W\s+0s\s+4s\s+6s\s+WD\s+NB\s+ECO\s+([\s\S]+?)(?=Fall of Wickets|Yet To Bat|To Bat|Did Not Bat|$)/i
  );

  if (!bowlingSectionMatch) {
    return [];
  }

  const bowlingSection = bowlingSectionMatch[1];
  const rowRegex =
    /(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)/g;
  const bowlingStats: BowlingStat[] = [];

  let rowMatch;
  while ((rowMatch = rowRegex.exec(bowlingSection)) !== null) {
    bowlingStats.push({
      player_name: stripNameAnnotations(rowMatch[2]),
      overs: parseFloat(rowMatch[3]),
      maidens: parseInt(rowMatch[4], 10),
      runs: parseInt(rowMatch[5], 10),
      wickets: parseInt(rowMatch[6], 10),
      dot_balls: parseInt(rowMatch[7], 10),
      fours_conceded: parseInt(rowMatch[8], 10),
      sixes_conceded: parseInt(rowMatch[9], 10),
      wides: parseInt(rowMatch[10], 10),
      no_balls: parseInt(rowMatch[11], 10),
      economy: parseFloat(rowMatch[12])
    });
  }

  return bowlingStats;
}

function extractCompetitionName(matchTitle: string | null) {
  if (!matchTitle) {
    return null;
  }

  const competitionMatch = matchTitle.match(/\(([^)]+)\)\s*$/);
  return competitionMatch ? competitionMatch[1].trim() : null;
}

function parseMatchOfficials(pageText: string) {
  const officialsSectionMatch = pageText.match(/Match Officials\s+No\s+Name\s+Role\s+Signature\s+([\s\S]+)$/i);

  if (!officialsSectionMatch) {
    return [];
  }

  const officialsSection = officialsSectionMatch[1];
  const officials: ParsedMatch["officials"] = [];
  const officialRegex = /(\d+)\s+(.+?)\s+(Scorer|Captain|Umpire|Organizer|Commentator)(?=\s+\d+\s+|$)/gi;

  let match;
  while ((match = officialRegex.exec(officialsSection)) !== null) {
    officials.push({
      name: stripNameAnnotations(match[2]),
      role: normalizeMatchWhitespace(match[3])
    });
  }

  return officials;
}

function parsePlayingSquads(pageText: string, teamA: string | null, teamB: string | null) {
  if (!teamA || !teamB || !pageText.includes("Playing Squad")) {
    return [];
  }

  const sectionStart = pageText.indexOf("Playing Squad");
  const section = pageText.slice(sectionStart);
  const startAfterHeader = normalizeMatchWhitespace(
    section.replace(/^Playing Squad\s+/i, "")
  );

  if (!startAfterHeader.startsWith(teamA) && !startAfterHeader.startsWith(teamB)) {
    return [];
  }

  const firstTeamName = startAfterHeader.startsWith(teamA) ? teamA : teamB;
  const secondTeamName = firstTeamName === teamA ? teamB : teamA;
  const afterTeamHeaders = startAfterHeader
    .replace(firstTeamName, "")
    .replace(secondTeamName, "")
    .trim();

  const rowRegex = /(\d{1,2})\s+(.+?)\s{2,}(.+?)(?=\s+\d{1,2}\s+|$)/g;
  const firstTeamPlayers: SquadPlayer[] = [];
  const secondTeamPlayers: SquadPlayer[] = [];

  const parseSquadPlayer = (rawName: string, playerOrder: number) => ({
    name: stripNameAnnotations(rawName),
    playerOrder,
    isCaptain: hasCaptainMarker(rawName),
    isWicketKeeper: hasWicketKeeperMarker(rawName),
    battingStyle: null
  });

  let rowMatch;
  while ((rowMatch = rowRegex.exec(afterTeamHeaders)) !== null) {
    const playerOrder = parseInt(rowMatch[1], 10);
    firstTeamPlayers.push(parseSquadPlayer(rowMatch[2], playerOrder));
    secondTeamPlayers.push(parseSquadPlayer(rowMatch[3], playerOrder));
  }

  if (firstTeamPlayers.length === 0 || secondTeamPlayers.length === 0) {
    return [];
  }

  return [
    {
      teamName: firstTeamName,
      players: firstTeamPlayers
    },
    {
      teamName: secondTeamName,
      players: secondTeamPlayers
    }
  ];
}

function parseExtrasBreakdown(block: string) {
  const extrasSectionMatch = block.match(/Extras:\s*\(([^)]*)\)\s*(\d+)/i);

  if (!extrasSectionMatch) {
    return {
      extras: 0,
      extrasBreakdown: {}
    };
  }

  const extrasText = extrasSectionMatch[1];
  const totalExtras = parseInt(extrasSectionMatch[2], 10);

  const extract = (label: RegExp) => {
    const match = extrasText.match(label);
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    extras: totalExtras,
    extrasBreakdown: {
      byes: extract(/\bb\s*(\d+)/i),
      legByes: extract(/\blb\s*(\d+)/i),
      wides: extract(/\bwd\s*(\d+)/i),
      noBalls: extract(/\bnb\s*(\d+)/i)
    }
  };
}

function parseInningsBlocks(fullText: string) {
  return fullText.match(
    /([A-Za-z\s().&]+?\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)\s+\(1st Innings\)[\s\S]+?)(?=[A-Za-z\s().&]+?\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)\s+\(1st Innings\)|Match Officials|$)/g
  ) ?? [];
}

function buildFallbackSquads(innings: ParsedMatch["innings"]): TeamSquad[] {
  return innings
    .filter((inningsSummary): inningsSummary is ParsedMatch["innings"][number] & { teamName: string } => {
      return Boolean(inningsSummary.teamName && inningsSummary.playing11?.length);
    })
    .map((inningsSummary) => {
      const battingByName = new Map(
        (inningsSummary.battingStats ?? []).map((player) => [
          normalizeLooseTextKey(player.player_name),
          player
        ])
      );

      return {
        teamName: inningsSummary.teamName,
        players: (inningsSummary.playing11 ?? []).map((playerName, index) => {
          const battingPlayer = battingByName.get(normalizeLooseTextKey(playerName));

          return {
            name: playerName,
            playerOrder: index + 1,
            isCaptain: battingPlayer?.isCaptain ?? false,
            isWicketKeeper: battingPlayer?.isWicketKeeper ?? false,
            battingStyle: battingPlayer?.batting_style ?? null
          };
        })
      };
    });
}

export async function parseMatchFromBase64(
  base64Data: string,
  currentTeamName: string
): Promise<ParsedMatch> {
  const pdfjsModule = await import("pdfjs-dist/build/pdf.js");
  const pdfjsLib = (pdfjsModule.default ?? pdfjsModule) as typeof pdfjsModule;
  const workerOptions = "GlobalWorkerOptions" in pdfjsLib
    ? pdfjsLib.GlobalWorkerOptions
    : null;

  if (typeof window !== "undefined" && workerOptions && typeof workerOptions === "object") {
    workerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const binary = atob(base64Data);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({
    data: bytes,
    disableWorker: typeof window === "undefined"
  }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: unknown }) => ("str" in item ? String(item.str) : ""))
      .join(" ");

    pageTexts.push(normalizeMatchWhitespace(pageText));
  }

  const fullText = normalizeMatchWhitespace(pageTexts.join(" "));
  const firstPageText = pageTexts[0] ?? "";
  const squadPageText = pageTexts.find((pageText) => pageText.includes("Playing Squad")) ?? "";

  const titleMatch = firstPageText.match(/^(.+?)\s+\d{1,2}\/\d{1,2}\/\d{2},/);
  const matchTitle = titleMatch ? normalizeMatchWhitespace(titleMatch[1]) : null;
  const competitionName = extractCompetitionName(matchTitle);

  const dateMatch = fullText.match(/Date\s+(\d{4}-\d{2}-\d{2})/);
  const matchDate = dateMatch ? dateMatch[1] : null;

  const headerMatch = fullText.match(
    /Match\s+(?!Details)(.+?)\s+vs\s+(.+?)\s+Ground/i
  );

  let teamA: string | null = null;
  let teamB: string | null = null;

  if (headerMatch) {
    teamA = normalizeMatchWhitespace(headerMatch[1]);
    teamB = normalizeMatchWhitespace(headerMatch[2]);
  }

  const groundMatch = fullText.match(/Ground\s+(.+?)\s+Date/i);
  const ground = groundMatch ? normalizeMatchWhitespace(groundMatch[1]) : null;

  const tossMatch = fullText.match(/Toss\s+(.+?)\s+opt to\s+(bat|bowl)/i);
  const tossWinner = tossMatch ? normalizeMatchWhitespace(tossMatch[1]) : null;
  const tossDecision = tossMatch ? tossMatch[2].toLowerCase() : null;

  const resultMatch = fullText.match(/Result\s+([A-Za-z\s().&]+?)\s+won by/i);
  const resultSummaryMatch = firstPageText.match(/Result\s+(.+?)\s+Best Performances/i);

  let winner: string | null = null;
  if (resultMatch) {
    winner = normalizeMatchWhitespace(resultMatch[1]);
  }

  const resultSummary = resultSummaryMatch
    ? normalizeMatchWhitespace(resultSummaryMatch[1])
    : null;

  let matchResult: "Won" | "Lost" | "Unknown" = "Unknown";
  if (winner) {
    matchResult = normalizeLooseTextKey(winner) === normalizeLooseTextKey(currentTeamName) ? "Won" : "Lost";
  }

  const officials = parseMatchOfficials(firstPageText);
  const parsedSquads = parsePlayingSquads(squadPageText, teamA, teamB);

  const inningsSummaries: ParsedMatch["innings"] = parseInningsBlocks(fullText).map((block, index) => {
    const teamMatch = block.match(
      /^([A-Za-z\s().&]+?)\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)/i
    );
    const teamName = teamMatch ? normalizeMatchWhitespace(teamMatch[1]) : null;

    const totalMatch = block.match(
      /Total:\s*Overs\s*(\d+(\.\d+)?)\s*,?\s*Wickets\s*(\d+)\s+(\d+)\s+\(CRR:\s*(\d+(\.\d+)?)\)/i
    );

    const fallbackTotalMatch = block.match(
      /Total:\s*Overs\s*(\d+(\.\d+)?)\s*,?\s*Wickets\s*(\d+)\s+(\d+)/i
    );

    const overs = totalMatch ? parseFloat(totalMatch[1]) : fallbackTotalMatch ? parseFloat(fallbackTotalMatch[1]) : null;
    const wickets = totalMatch ? parseInt(totalMatch[3], 10) : fallbackTotalMatch ? parseInt(fallbackTotalMatch[3], 10) : null;
    const runs = totalMatch ? parseInt(totalMatch[4], 10) : fallbackTotalMatch ? parseInt(fallbackTotalMatch[4], 10) : null;
    const crr = totalMatch ? parseFloat(totalMatch[5]) : null;

    const { extras, extrasBreakdown } = parseExtrasBreakdown(block);

    const battingStats = parseBattingStats(block);
    const bowlingStats = parseBowlingStats(block);

    const fallOfWickets: FallOfWicket[] = [];
    const fowSectionMatch = block.match(
      /Fall of Wickets\s+([\s\S]+?)(?=No\s+Bowler|$)/i
    );

    if (fowSectionMatch) {
      const fowRegex = /(\d+)-(\d+)\s*\(([^,]+),\s*(\d+(\.\d+)?)\s*ov\)/g;
      let match;
      while ((match = fowRegex.exec(fowSectionMatch[1])) !== null) {
        fallOfWickets.push({
          score: parseInt(match[1], 10),
          wicket_number: parseInt(match[2], 10),
          batsman: stripNameAnnotations(match[3]),
          over: parseFloat(match[4])
        });
      }
    }

    const pendingBatters = parseDelimitedPlayerList(
      block.match(/Yet\s+To\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
        ?? block.match(/To\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
        ?? block.match(/Did\s+Not\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
        ?? ""
    );

    const squadForTeam = parsedSquads.find((squad: TeamSquad) => squad.teamName === teamName);
    const squadNames = squadForTeam?.players.map((player: SquadPlayer) => stripNameAnnotations(player.name)) ?? [];
    const playing11 = Array.from(
      new Set([
        ...squadNames,
        ...battingStats.map((player) => stripNameAnnotations(player.player_name)),
        ...pendingBatters
      ])
    );

    return {
      innings_number: index + 1,
      teamName,
      runs,
      wickets,
      overs,
      extras,
      crr,
      extrasBreakdown,
      battingStats,
      bowlingStats,
      fallOfWickets,
      playing11
    };
  });

  const squads = parsedSquads.length > 0 ? parsedSquads : buildFallbackSquads(inningsSummaries);

  return {
    matchTitle,
    competitionName,
    ground,
    matchDate,
    teamA,
    teamB,
    tossWinner,
    tossDecision,
    winner,
    matchResult,
    resultSummary,
    officials,
    squads,
    rawText: fullText,
    innings: inningsSummaries
  };
}
