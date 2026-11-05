// Usage: npm run validate:spond -- imports/spond-2027-05-02.json
import { readFileSync } from "node:fs";
import { spondSnapshotSchema } from "../src/import/spondSchema";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run validate:spond -- <file.json>");
  process.exit(2);
}

const parsed = spondSnapshotSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  console.error("The file does not match the Spond snapshot format:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const counts = { yes: 0, no: 0, maybe: 0, unanswered: 0 };
for (const r of parsed.data.responses) counts[r.answer] += 1;
const names = parsed.data.responses.map((r) => r.name.trim().toLowerCase());
const duplicates = names.filter((n, i) => names.indexOf(n) !== i);

console.log(`${parsed.data.event_date}  ${parsed.data.event_title}  captured ${parsed.data.captured_at}`);
console.log(`  yes ${counts.yes} · no ${counts.no} · maybe ${counts.maybe} · unanswered ${counts.unanswered}`);
if (duplicates.length > 0) {
  console.error(`  Duplicate names: ${[...new Set(duplicates)].join(", ")}`);
  process.exit(1);
}
console.log("OK — ready to upload.");
