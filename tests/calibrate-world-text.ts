/**
 * Calibration for SAME_TEXT_SIMILARITY in frame-handoff.ts.
 *
 * The threshold decides when two 'worldText' values are the same sign worded
 * twice. Too low and unrelated signs get collapsed onto each other, which would
 * put the wrong words on screen; too high and a paraphrase survives and the
 * video model renders two different banners.
 *
 * Offline. Run: npx tsx tests/calibrate-world-text.ts
 */
import { textSimilarity } from "../src/server/story/scene-distinctiveness.js";
import { numbersConflict } from "../src/server/story/frame-handoff.js";

/** The same sign, reworded the way separate batches reword it. */
const SAME: Array<[string, string]> = [
  [
    "Jo Karele ko harayega use 5 lakh rupay inaam diya jayega",
    "Jo Karele ko harayega, usay paanch lakh rupay inaam milega",
  ],
  ["5,00,000 paanch lakh", "5,00,000 — paanch lakh rupay"],
  ["Sabzi Mandi — subah 6 baje", "Sabzi Mandi, subah chhe baje"],
  ["Gaon ka Dangal 2026", "Gaon Ka Dangal, 2026"],
  ["Taaza Sabziyan — Roz Subah", "Taaza sabziyan roz subah"],
  ["BEEJ BHANDAR", "Beej Bhandar"],
  ["Inaam: 5 lakh rupay", "Inaam 5 lakh rupaye"],
  ["Nursery band hai", "Nursery band hai."],
];

/** Genuinely different signs that must never be merged. */
const DIFFERENT: Array<[string, string]> = [
  ["Jo Karele ko harayega use 5 lakh rupay inaam diya jayega", "Sabzi Mandi — subah 6 baje"],
  ["5,00,000 paanch lakh", "Nursery band hai"],
  ["Gaon ka Dangal 2026", "Taaza Sabziyan — Roz Subah"],
  ["BEEJ BHANDAR", "Inaam: 5 lakh rupay"],
  ["Sabzi Mandi — subah 6 baje", "Gaon ka Dangal 2026"],
  ["Nursery band hai", "Taaza Sabziyan — Roz Subah"],
  // Same domain, different meaning - the hard case.
  ["Inaam: 5 lakh rupay", "Inaam: 10 lakh rupay"],
  ["Dukan khuli hai", "Dukan band hai"],
];

const score = (pairs: Array<[string, string]>) =>
  pairs.map(([a, b]) => ({ a, b, d: textSimilarity(a, b), blocked: numbersConflict(a, b) }));

const same = score(SAME).sort((x, y) => x.d - y.d);
const diff = score(DIFFERENT).sort((x, y) => y.d - x.d);

// The number guard runs first, so pairs it rejects never reach the threshold.
console.log("NUMBER GUARD");
for (const s of [...same, ...diff]) {
  if (s.blocked) console.log(`  blocked (${s.d.toFixed(3)}): ${s.a.slice(0, 34)} :: ${s.b.slice(0, 34)}`);
}
const sameBlocked = same.filter((s) => s.blocked);
console.log(`  same-sign pairs wrongly blocked: ${sameBlocked.length}`);
sameBlocked.forEach((s) => console.log(`    ${s.a.slice(0, 50)}`));
console.log();

console.log("SAME SIGN, REWORDED (must merge — need similarity ABOVE the threshold)");
for (const s of same) console.log(`  ${s.d.toFixed(3)}  ${s.a.slice(0, 44)}`);

console.log("\nDIFFERENT SIGNS (must not merge — need similarity BELOW the threshold)");
for (const s of diff) console.log(`  ${s.d.toFixed(3)}  ${s.a.slice(0, 30)} :: ${s.b.slice(0, 30)}`);

// Only pairs that survive the number guard are the threshold's job.
const lowestSame = Math.min(...same.filter((s) => !s.blocked).map((s) => s.d));
const highestDiff = Math.max(...diff.filter((s) => !s.blocked).map((s) => s.d));

console.log(`\nlowest  SAME      : ${lowestSame.toFixed(3)}`);
console.log(`highest DIFFERENT : ${highestDiff.toFixed(3)}`);

if (lowestSame > highestDiff) {
  const mid = (lowestSame + highestDiff) / 2;
  console.log(`\nSEPARABLE. Usable range ${highestDiff.toFixed(3)} .. ${lowestSame.toFixed(3)}`);
  console.log(`RECOMMENDED SAME_TEXT_SIMILARITY = ${mid.toFixed(2)}`);
} else {
  console.log(`\nNOT SEPARABLE by this measure — the populations overlap.`);
  console.log(`Pairs that would be misclassified at any single threshold:`);
  for (const s of same) if (s.d <= highestDiff) console.log(`  SAME  scored ${s.d.toFixed(3)}: ${s.a.slice(0, 50)}`);
  for (const s of diff) if (s.d >= lowestSame) console.log(`  DIFF  scored ${s.d.toFixed(3)}: ${s.a.slice(0, 30)} :: ${s.b.slice(0, 30)}`);
}
