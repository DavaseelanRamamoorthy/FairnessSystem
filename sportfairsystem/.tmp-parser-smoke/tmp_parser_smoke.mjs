import { readFileSync } from "node:fs";
import { parseMatchFromBase64 } from "./app/services/pdfParser.js";
const pdfPath = String.raw `e:\Moonwalkers\Sorecard\SC1.pdf`;
const base64 = readFileSync(pdfPath).toString("base64");
const parsed = await parseMatchFromBase64(base64, "Moonwalkers");
console.log(JSON.stringify({
    matchTitle: parsed.matchTitle,
    competitionName: parsed.competitionName,
    matchDate: parsed.matchDate,
    teamA: parsed.teamA,
    teamB: parsed.teamB,
    winner: parsed.winner,
    matchResult: parsed.matchResult,
    officials: parsed.officials,
    squads: parsed.squads,
    innings: parsed.innings
}, null, 2));
