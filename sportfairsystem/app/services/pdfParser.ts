// app/services/pdfParser.ts
import { ParsedMatch } from "../types/match.types";
export async function parseMatchFromBase64(
  base64Data: string,
  currentTeamName: string
): Promise<ParsedMatch> {

  // LOAD PDF
  // @ts-ignore
  const pdfjsLib = await import("pdfjs-dist/build/pdf");

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  // Convert base64 → bytes
  const binary = atob(base64Data);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  // BUILD TEXT
  let rawText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");

    rawText += pageText + " ";
  }

  const fullText = rawText.replace(/\s+/g, " ").trim();

  // ============================
  // MATCH DATE
  // ============================

  const dateMatch = fullText.match(/Date\s+(\d{4}-\d{2}-\d{2})/);
  const matchDate = dateMatch ? dateMatch[1] : null;

  // ============================
  // TEAM EXTRACTION
  // ============================

  const headerMatch = fullText.match(
    /Match\s+(?!Details)(.+?)\s+vs\s+(.+?)\s+Ground/i
  );

  let teamA: string | null = null;
  let teamB: string | null = null;

  if (headerMatch) {
    teamA = headerMatch[1].trim();
    teamB = headerMatch[2].trim();
  }

  // ============================
  // WINNER EXTRACTION
  // ============================

  const resultMatch = fullText.match(
    /Result\s+([A-Za-z\s().&]+?)\s+won by/i
  );

  let winner: string | null = null;

  if (resultMatch) {
    winner = resultMatch[1].replace(/\s+/g, " ").trim();
  }

  // ============================
  // MATCH RESULT LOGIC
  // ============================

  const normalize = (str: string) =>
    str.toLowerCase().replace(/\s+/g, "").trim();

  let matchResult: "Won" | "Lost" | "Unknown" = "Unknown";

  if (winner) {
    const normWinner = normalize(winner);
    const normCurrent = normalize(currentTeamName);
    matchResult = normWinner === normCurrent ? "Won" : "Lost";
  }

  // ============================
  // INNINGS BLOCK ISOLATION
  // ============================

  const inningsBlocks = fullText.match(
    /([A-Za-z\s().&]+?\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)\s+\(1st Innings\)[^]+?)(?=[A-Za-z\s().&]+?\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)\s+\(1st Innings\)|Match Officials|$)/g
  );

  let inningsSummaries: ParsedMatch["innings"] = [];    

  if (inningsBlocks && inningsBlocks.length > 0) {

    inningsSummaries = inningsBlocks.map((block) => {

      // console.log("=================================");
      // console.log("INNINGS BLOCK RAW:");
      // console.log(block);
      // console.log("=================================");

      const teamMatch = block.match(
        /^([A-Za-z\s().&]+?)\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)/i
      );

      const teamName = teamMatch ? teamMatch[1].trim() : null;

      const totalMatch = block.match(
        /Total:\s*Overs\s*(\d+(\.\d+)?)\s*,?\s*Wickets\s*(\d+)\s+(\d+)/i
      );

      // console.log("Toatal Match Raw:", totalMatch);

      let runs = null;
      let wickets = null;
      let overs = null;

      if (totalMatch) {
        overs = parseFloat(totalMatch[1]);
        wickets = parseInt(totalMatch[3]);
        runs = parseInt(totalMatch[4]);
      }

      // ============================
      // EXTRAS EXTRACTION
      // ============================

      const extrasMatch = block.match(/Extras:\s*\([^)]*\)\s*(\d+)/i);

      let extras = 0;

      if (extrasMatch) {
        extras = parseInt(extrasMatch[1]);
      }

      // ============================
      // BATTING EXTRACTION
      // ============================

      // Get batting section before "Extras:"
      const battingSectionMatch = block.match(
        /No\s+Batsman\s+Status[\s\S]+?Extras:/i
      );

      let battingStats: any[] = [];

      if (battingSectionMatch) {
        const battingSection = battingSectionMatch[0];

        // Match each batting row
        const rowRegex =
          /\d+\s+([A-Za-z\s().&]+?)\s+(?:c|b|not out|run out|lbw|st)[^0-9]*\s+(\d+)\s+(\d+)\s+\d+\s+(\d+)\s+(\d+)\s+(\d+(\.\d+)?)/g;

        let match;

        while ((match = rowRegex.exec(battingSection)) !== null) {
          battingStats.push({
            player_name: match[1].trim(),
            runs: parseInt(match[2]),
            balls: parseInt(match[3]),
            fours: parseInt(match[4]),
            sixes: parseInt(match[5]),
            strike_rate: parseFloat(match[6])
          });
        }
      }

      return {
        teamName,
        runs,
        wickets,
        overs,
        extras,
        battingStats
      };
    });
  }

  // ============================
  // FINAL RETURN
  // ============================

  return {
    matchDate,
    teamA,
    teamB,
    winner,
    matchResult,
    innings: inningsSummaries
  };
}