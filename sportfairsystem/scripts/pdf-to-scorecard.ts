// Usage: npx tsx scripts/pdf-to-scorecard.ts <folder-or-pdf> [out-folder]
// Reads CricHeroes "Download Scorecard" PDFs (Scorecard_<matchId>.pdf), turns
// each into the app's scorecard JSON and reports any total that doesn't add up.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { scorecardFromPdf } from "../src/import/pdfAdapter";
import { checkScorecard } from "../src/import/scorecardSchema";

const input = process.argv[2];
const outDir = process.argv[3] ?? "imports/scorecards";
if (!input) {
  console.error("Usage: npx tsx scripts/pdf-to-scorecard.ts <folder-or-pdf> [out-folder]");
  process.exit(2);
}
const files = statSync(input).isDirectory()
  ? readdirSync(input).filter((f) => f.toLowerCase().endsWith(".pdf")).map((f) => join(input, f))
  : [input];
mkdirSync(outDir, { recursive: true });

async function main() {
let ok = 0;
let warned = 0;
let failed = 0;
for (const file of files.sort()) {
  const ref = basename(file).match(/(\d{6,})/)?.[1];
  try {
    const card = await scorecardFromPdf(readFileSync(file).toString("base64"), "Moonwalkers");
    const withRef = { ...card, source: "cricheroes" as const, cricheroes_match_ref: ref ?? card.cricheroes_match_ref };
    const problems = checkScorecard(withRef);
    // Store overs back as "O.B" text so the JSON reads like the scorecard.
    const text = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;
    const json = {
      ...withRef,
      innings: withRef.innings.map((inn) => ({
        ...inn,
        overs: text(inn.overs),
        bowling: inn.bowling.map((b) => ({ ...b, overs: text(b.overs) }))
      }))
    };
    writeFileSync(join(outDir, `${card.match_date}-${ref ?? basename(file, ".pdf")}.json`), JSON.stringify(json, null, 1));
    const totals = card.innings.map((i) => `${i.team_name} ${i.runs}/${i.wickets}`).join(" v ");
    if (problems.length) {
      warned++;
      console.log(`WARN ${ref} ${card.match_date} ${totals}\n     ${problems.join("\n     ")}`);
    } else {
      ok++;
      console.log(`OK   ${ref} ${card.match_date} ${totals} (${card.result ?? "?"})`);
    }
  } catch (error) {
    failed++;
    console.log(`FAIL ${ref ?? file}: ${(error as Error).message.split("\n")[0]}`);
  }
}
console.log(`\n${ok} ok, ${warned} with warnings, ${failed} failed`);
}

void main();
