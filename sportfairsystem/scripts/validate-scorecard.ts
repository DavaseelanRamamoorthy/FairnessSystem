// Usage: npm run validate:scorecard -- imports/2027-05-02-rivals.json
// Checks a scorecard JSON (written by Claude from CricHeroes, or by hand)
// before it is uploaded in the app. Exit code 1 means fix the file first.
import { readFileSync } from "node:fs";
import { checkScorecard, scorecardSchema } from "../src/import/scorecardSchema";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run validate:scorecard -- <file.json>");
  process.exit(2);
}

const parsed = scorecardSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error("The file does not match the scorecard format:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const problems = checkScorecard(parsed.data);
const card = parsed.data;
console.log(`${card.match_date}  ${card.our_team} vs ${card.opponent}  (${card.result ?? "result not set"})`);
for (const inn of card.innings) {
  console.log(
    `  Innings ${inn.innings_no}: ${inn.team_name} ${inn.runs}/${inn.wickets} in ${Math.floor(inn.overs / 6)}.${inn.overs % 6}` +
      ` — ${inn.batting.length} batters, ${inn.bowling.length} bowlers${inn.ours ? "  [ours]" : ""}`
  );
}
if (problems.length > 0) {
  console.error("\nProblems:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log("\nOK — ready to upload.");
