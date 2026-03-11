import { ParsedMatch, SquadPlayer, TeamSquad } from "../types/match.types";

function cleanPlayerName(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parsePlayerList(listText: string) {
  return Array.from(
    new Set(
      listText
        .split(/\s*,\s*/)
        .map((name) => cleanPlayerName(name))
        .filter(Boolean)
    )
  );
}

type BattingStat = NonNullable<ParsedMatch["innings"][number]["battingStats"]>[number];
type BowlingStat = NonNullable<ParsedMatch["innings"][number]["bowlingStats"]>[number];
type FallOfWicket = NonNullable<ParsedMatch["innings"][number]["fallOfWickets"]>[number];

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
      name: cleanPlayerName(match[2]),
      role: normalizeWhitespace(match[3])
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
  const startAfterHeader = normalizeWhitespace(
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
    name: cleanPlayerName(rawName),
    playerOrder,
    isCaptain: /\(\s*c\s*\)/i.test(rawName),
    isWicketKeeper: /\(\s*wk\s*\)/i.test(rawName),
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

export async function parseMatchFromBase64(
  base64Data: string,
  currentTeamName: string
): Promise<ParsedMatch> {
  // @ts-expect-error pdfjs-dist build entry does not expose stable types here.
  const pdfjsLib = await import("pdfjs-dist/build/pdf");

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const binary = atob(base64Data);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: unknown }) => ("str" in item ? String(item.str) : ""))
      .join(" ");

    pageTexts.push(normalizeWhitespace(pageText));
  }

  const fullText = normalizeWhitespace(pageTexts.join(" "));
  const firstPageText = pageTexts[0] ?? "";
  const squadPageText = pageTexts.find((pageText) => pageText.includes("Playing Squad")) ?? "";

  const titleMatch = firstPageText.match(/^(.+?)\s+\d{1,2}\/\d{1,2}\/\d{2},/);
  const matchTitle = titleMatch ? normalizeWhitespace(titleMatch[1]) : null;
  const competitionName = extractCompetitionName(matchTitle);

  const dateMatch = fullText.match(/Date\s+(\d{4}-\d{2}-\d{2})/);
  const matchDate = dateMatch ? dateMatch[1] : null;

  const headerMatch = fullText.match(
    /Match\s+(?!Details)(.+?)\s+vs\s+(.+?)\s+Ground/i
  );

  let teamA: string | null = null;
  let teamB: string | null = null;

  if (headerMatch) {
    teamA = normalizeWhitespace(headerMatch[1]);
    teamB = normalizeWhitespace(headerMatch[2]);
  }

  const groundMatch = fullText.match(/Ground\s+(.+?)\s+Date/i);
  const ground = groundMatch ? normalizeWhitespace(groundMatch[1]) : null;

  const tossMatch = fullText.match(/Toss\s+(.+?)\s+opt to\s+(bat|bowl)/i);
  const tossWinner = tossMatch ? normalizeWhitespace(tossMatch[1]) : null;
  const tossDecision = tossMatch ? tossMatch[2].toLowerCase() : null;

  const resultMatch = fullText.match(/Result\s+([A-Za-z\s().&]+?)\s+won by/i);
  const resultSummaryMatch = firstPageText.match(/Result\s+(.+?)\s+Best Performances/i);

  let winner: string | null = null;
  if (resultMatch) {
    winner = normalizeWhitespace(resultMatch[1]);
  }

  const resultSummary = resultSummaryMatch
    ? normalizeWhitespace(resultSummaryMatch[1])
    : null;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z\s]/g, "")
      .trim()
      .replace(/\s+/g, " ");

  let matchResult: "Won" | "Lost" | "Unknown" = "Unknown";
  if (winner) {
    matchResult = normalize(winner) === normalize(currentTeamName) ? "Won" : "Lost";
  }

  const officials = parseMatchOfficials(firstPageText);
  const squads = parsePlayingSquads(squadPageText, teamA, teamB);

  const inningsSummaries: ParsedMatch["innings"] = parseInningsBlocks(fullText).map((block, index) => {
    const teamMatch = block.match(
      /^([A-Za-z\s().&]+?)\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)/i
    );
    const teamName = teamMatch ? normalizeWhitespace(teamMatch[1]) : null;

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

    const battingStats: BattingStat[] = [];
    const battingSectionMatch = block.match(/No\s+Batsman\s+Status[\s\S]+?Extras:/i);

    if (battingSectionMatch) {
      const battingSection = battingSectionMatch[0];
      const rows = battingSection.match(/\d+\s+[A-Za-z].+?\d+\.\d+/g) ?? [];

      rows.forEach((row) => {
        const tokens = row.trim().split(/\s+/);

        const battingPosition = parseInt(tokens.shift() ?? "0", 10);
        const strikeRate = parseFloat(tokens.pop() ?? "0");
        const sixes = parseInt(tokens.pop() ?? "0", 10);
        const fours = parseInt(tokens.pop() ?? "0", 10);
        const minutes = parseInt(tokens.pop() ?? "0", 10);
        const balls = parseInt(tokens.pop() ?? "0", 10);
        const runsValue = parseInt(tokens.pop() ?? "0", 10);

        const dismissalTokens: string[] = [];
        while (tokens.length > 0 && !tokens[tokens.length - 1].includes("(")) {
          dismissalTokens.unshift(tokens.pop() ?? "");
        }

        const dismissal = normalizeWhitespace(dismissalTokens.join(" "));
        const battingStyleToken = tokens.pop() ?? "";
        const rawName = normalizeWhitespace(tokens.join(" "));

        battingStats.push({
          player_name: cleanPlayerName(rawName),
          batting_position: Number.isNaN(battingPosition) ? undefined : battingPosition,
          batting_style: battingStyleToken ? battingStyleToken.replace(/[()]/g, "") : null,
          isCaptain: /\(\s*c(?:apt)?(?:ain)?(?:\s*&\s*wk)?\s*\)/i.test(rawName) || /\(\s*c\s*&/i.test(rawName),
          isWicketKeeper: /\(\s*wk\s*\)/i.test(rawName) || /\(\s*c\s*&\s*wk\s*\)/i.test(rawName),
          dismissal: dismissal || "not out",
          runs: Number.isNaN(runsValue) ? 0 : runsValue,
          balls: Number.isNaN(balls) ? 0 : balls,
          minutes: Number.isNaN(minutes) ? null : minutes,
          fours: Number.isNaN(fours) ? 0 : fours,
          sixes: Number.isNaN(sixes) ? 0 : sixes,
          strike_rate: Number.isNaN(strikeRate) ? 0 : strikeRate
        });
      });
    }

    const bowlingStats: BowlingStat[] = [];
    const bowlingSectionMatch = block.match(/No\s+Bowler\s+O\s+M\s+R\s+W[\s\S]+$/i);

    if (bowlingSectionMatch) {
      const bowlingSection = bowlingSectionMatch[0];
      const rowRegex =
        /\d+\s+([A-Za-z\s().&]+?)\s+(\d+(\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(\.\d+)?)/g;

      let match;
      while ((match = rowRegex.exec(bowlingSection)) !== null) {
        bowlingStats.push({
          player_name: cleanPlayerName(match[1]),
          overs: parseFloat(match[2]),
          maidens: parseInt(match[4], 10),
          runs: parseInt(match[5], 10),
          wickets: parseInt(match[6], 10),
          dot_balls: parseInt(match[7], 10),
          fours_conceded: parseInt(match[8], 10),
          sixes_conceded: parseInt(match[9], 10),
          wides: parseInt(match[10], 10),
          no_balls: parseInt(match[11], 10),
          economy: parseFloat(match[12])
        });
      }
    }

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
          batsman: cleanPlayerName(match[3]),
          over: parseFloat(match[4])
        });
      }
    }

    const pendingBatters = parsePlayerList(
      block.match(/Yet\s+To\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
        ?? block.match(/To\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
        ?? block.match(/Did\s+Not\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
        ?? ""
    );

      const squadForTeam = squads.find((squad: TeamSquad) => squad.teamName === teamName);
      const squadNames = squadForTeam?.players.map((player: SquadPlayer) => cleanPlayerName(player.name)) ?? [];
    const playing11 = Array.from(
      new Set([
        ...squadNames,
        ...battingStats.map((player) => cleanPlayerName(player.player_name)),
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
