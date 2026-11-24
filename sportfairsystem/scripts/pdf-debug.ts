// Usage: npx tsx scripts/pdf-debug.ts <file.pdf> [regex]
// Prints the text the PDF reader sees, or only the lines around a pattern.
import { readFileSync } from "node:fs";
import { scorecardFromPdf } from "../src/import/pdfAdapter";

async function main() {
  const file = process.argv[2];
  const pattern = process.argv[3] ? new RegExp(process.argv[3], "i") : null;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)) }).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as { str: string }[]).map((it) => it.str).join(" ").replace(/\s+/g, " ");
    if (!pattern) console.log(`--- page ${i}\n${text}`);
    else {
      let m: RegExpExecArray | null;
      const re = new RegExp(pattern.source, "gi");
      while ((m = re.exec(text))) console.log(`p${i}: …${text.slice(Math.max(0, m.index - 120), m.index + 160)}…`);
    }
  }
  try {
    await scorecardFromPdf(readFileSync(file).toString("base64"), "Moonwalkers");
    console.log("parse OK");
  } catch (error) {
    console.log("parse error:", String((error as Error).message).slice(0, 1500));
  }
}
void main();
