import { readFileSync } from "node:fs";
import { parseMatchFromBase64 } from "./app/services/pdfParser.js";

const pdfPaths = [
  String.raw`e:\Moonwalkers\Sorecard\SC7.pdf`,
  String.raw`e:\Moonwalkers\Sorecard\SC8.pdf`,
  String.raw`e:\Moonwalkers\Sorecard\SC9.pdf`
];

for (const pdfPath of pdfPaths) {
  const base64 = readFileSync(pdfPath).toString("base64");
  const parsed = await parseMatchFromBase64(base64, "Moonwalkers");

  console.log(JSON.stringify({
    pdfPath,
    matchTitle: parsed.matchTitle,
    competitionName: parsed.competitionName,
    matchDate: parsed.matchDate,
    teamA: parsed.teamA,
    teamB: parsed.teamB,
    winner: parsed.winner,
    matchResult: parsed.matchResult,
    resultSummary: parsed.resultSummary,
    officials: parsed.officials,
    squads: parsed.squads?.map((squad) => ({
      teamName: squad.teamName,
      count: squad.players.length,
      sample: squad.players.slice(0, 4)
    })),
    innings: parsed.innings?.map((innings) => ({
      inningsNumber: innings.innings_number,
      teamName: innings.teamName,
      total: `${innings.runs}/${innings.wickets}`,
      overs: innings.overs,
      extras: innings.extras,
      battingCount: innings.battingStats?.length ?? 0,
      bowlingCount: innings.bowlingStats?.length ?? 0,
      playing11Count: innings.playing11?.length ?? 0,
      fowCount: innings.fallOfWickets?.length ?? 0
    }))
  }, null, 2));
}
