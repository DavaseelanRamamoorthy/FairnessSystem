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

  const binary = atob(base64Data);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

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
  str
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove (wk), (c)
    .replace(/[^a-z\s]/g, "") // remove symbols like *
    .trim()
    .replace(/\s+/g, " ");

  let matchResult: "Won" | "Lost" | "Unknown" = "Unknown";

  if (winner) {
    const normWinner = normalize(winner);
    const normCurrent = normalize(currentTeamName);
    matchResult = normWinner === normCurrent ? "Won" : "Lost";
  }

  // ============================
  // INNINGS BLOCK
  // ============================

  const inningsBlocks = fullText.match(
    /([A-Za-z\s().&]+?\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)\s+\(1st Innings\)[^]+?)(?=[A-Za-z\s().&]+?\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)\s+\(1st Innings\)|Match Officials|$)/g
  );

  let inningsSummaries: ParsedMatch["innings"] = [];

  if (inningsBlocks && inningsBlocks.length > 0) {

    inningsSummaries = inningsBlocks.map((block) => {

      const teamMatch = block.match(
        /^([A-Za-z\s().&]+?)\s+\d+\/\d+\s+\(\d+(\.\d+)?\s+Ov\)/i
      );

      const teamName = teamMatch ? teamMatch[1].trim() : null;

      const totalMatch = block.match(
        /Total:\s*Overs\s*(\d+(\.\d+)?)\s*,?\s*Wickets\s*(\d+)\s+(\d+)/i
      );

      let runs = null;
      let wickets = null;
      let overs = null;

      if (totalMatch) {
        overs = parseFloat(totalMatch[1]);
        wickets = parseInt(totalMatch[3]);
        runs = parseInt(totalMatch[4]);
      }

      // ============================
      // EXTRAS
      // ============================

      const extrasMatch = block.match(/Extras:\s*\([^)]*\)\s*(\d+)/i);

      let extras = 0;

      if (extrasMatch) {
        extras = parseInt(extrasMatch[1]);
      }

      // ============================
      // BATTING EXTRACTION (STABLE)
      // ============================

      const battingSectionMatch = block.match(
        /No\s+Batsman\s+Status[\s\S]+?Extras:/i
      );

      let battingStats: any[] = [];

      if (battingSectionMatch) {

        const battingSection = battingSectionMatch[0];

        const rows = battingSection.match(/\d+\s+[A-Za-z].+?\d+\.\d+/g);

        if (rows) {

          rows.forEach((row) => {

            let tokens = row.trim().split(/\s+/);

            // remove row number
            if (!isNaN(Number(tokens[0]))) {
              tokens.shift();
            }

            const sr = parseFloat(tokens.pop()!);
            const sixes = parseInt(tokens.pop()!);
            const fours = parseInt(tokens.pop()!);
            const minutes = tokens.pop();
            const balls = parseInt(tokens.pop()!);
            const runs = parseInt(tokens.pop()!);

            const dismissalTokens: string[] = [];

            while (
              tokens.length &&
              !tokens[tokens.length - 1].includes("(")
            ) {
              dismissalTokens.unshift(tokens.pop()!);
            }

            const dismissal = dismissalTokens.join(" ");

            const rawName = tokens.join(" ");

            const cleanedName = rawName
              .replace(/\(.*?\)/g, "")
              .replace(/\s+/g, " ")
              .trim();

            battingStats.push({
              player_name: cleanedName,
              dismissal: dismissal || "not out",
              runs,
              balls,
              fours,
              sixes,
              strike_rate: sr
            });

          });

        }
      }

      // ============================
      // BOWLING EXTRACTION
      // ============================

      let bowlingStats: any[] = [];

      const bowlingSectionMatch = block.match(/No\s+Bowler([\s\S]+)/i);

      if (bowlingSectionMatch) {

        const bowlingSection = bowlingSectionMatch[1];

        const rowRegex =
          /\d+\s+([A-Za-z\s().&]+?)\s+(\d+(\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+[\d\s]+\s+(\d+\.\d+)/g;

        let match;

        while ((match = rowRegex.exec(bowlingSection)) !== null) {

          bowlingStats.push({
            player_name: match[1].trim(),
            overs: parseFloat(match[2]),
            maidens: parseInt(match[4]),
            runs: parseInt(match[5]),
            wickets: parseInt(match[6]),
            economy: parseFloat(match[7])
          });

        }
      }

      // ============================
      // FALL OF WICKETS
      // ============================

      let fallOfWickets: any[] = [];

      const fowSectionMatch = block.match(
        /Fall of Wickets\s+([\s\S]+?)(?=No Bowler|$)/i
      );

      if (fowSectionMatch) {

        const fowText = fowSectionMatch[1];

        const fowRegex =
          /(\d+)-(\d+)\s*\(([^,]+),\s*(\d+(\.\d+)?)\s*ov\)/g;

        let match;

        while ((match = fowRegex.exec(fowText)) !== null) {

          fallOfWickets.push({
            score: parseInt(match[1]),
            wicket_number: parseInt(match[2]),
            batsman: match[3].trim(),
            over: parseFloat(match[4])
          });

        }
      }

      return {
        teamName,
        runs,
        wickets,
        overs,
        extras,
        battingStats,
        bowlingStats,
        fallOfWickets
      };

    });

  }

  return {
    matchDate,
    teamA,
    teamB,
    winner,
    matchResult,
    innings: inningsSummaries
  };
}