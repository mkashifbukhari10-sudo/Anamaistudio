import {
  ALL_BEAT_FIXTURES,
  BAD_BEAT_FIXTURES,
  NEGATIVE_BEAT_FIXTURES,
} from "./fixtures/beat-fixtures.js";
import { buildBeatDensityReport, clusterMoves, MOVE_SIMILARITY_THRESHOLD } from "../src/server/story/beat-density.js";
import { textSimilarity } from "../src/server/story/scene-distinctiveness.js";

/**
 * Beat-density threshold calibration.
 *
 * MOVE_SIMILARITY_THRESHOLD decides when two scene descriptions are the same
 * dramatic move worded differently. It is deliberately NOT inherited from the
 * P0 scene threshold: that number was calibrated on multi-dimension scene
 * signatures, these are single short strings, and the distributions differ.
 *
 * The hard case is not "do these sentences share words" — an escalation
 * sequence repeats its verb by definition — it is "does each one describe a
 * different CHANGE". If no threshold separates the two populations, the
 * comparison is wrong, not the number.
 *
 * Offline. Run with: npx tsx tests/calibrate-beat-density.ts
 */

function withinBeatScores(beats: any[]): number[] {
  const out: number[] = [];
  for (const b of beats) {
    const moves: string[] = Array.isArray(b?.whatEachSceneDoes) ? b.whatEachSceneDoes : [];
    for (let i = 0; i < moves.length; i++) {
      for (let j = i + 1; j < moves.length; j++) out.push(textSimilarity(moves[i], moves[j]));
    }
  }
  return out;
}

function stats(values: number[]) {
  if (values.length === 0) return { n: 0, min: 0, max: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 1000) / 1000,
  };
}

function bar(v: number, width = 34): string {
  return "#".repeat(Math.round(v * width)).padEnd(width, ".");
}

console.log("\n" + "=".repeat(92));
console.log("BEAT DENSITY — THRESHOLD CALIBRATION");
console.log("=".repeat(92));

console.log("\nWITHIN-BEAT DESCRIPTION SIMILARITY");
console.log("-".repeat(92));
console.log("fixture                                  expect   min    mean   max    profile");

const badScores: number[] = [];
const negScores: number[] = [];

for (const f of ALL_BEAT_FIXTURES) {
  const scores = withinBeatScores(f.beats);
  const s = stats(scores);
  if (f.expectation === "flag") badScores.push(...scores);
  else negScores.push(...scores);

  console.log(
    `${f.name.padEnd(40)} ${f.expectation.padEnd(6)}  ` +
      `${s.min.toFixed(3)}  ${s.mean.toFixed(3)}  ${s.max.toFixed(3)}  ${bar(s.mean)}`
  );
}

const bad = stats(badScores);
const neg = stats(negScores);

console.log("\nPOPULATION SEPARATION");
console.log("-".repeat(92));
console.log(`  BAD  pairs : n=${bad.n}  min=${bad.min.toFixed(3)}  mean=${bad.mean.toFixed(3)}  max=${bad.max.toFixed(3)}`);
console.log(`  NEG  pairs : n=${neg.n}  min=${neg.min.toFixed(3)}  mean=${neg.mean.toFixed(3)}  max=${neg.max.toFixed(3)}`);
console.log(
  `\n  Note: individual-pair populations OVERLAP by design — a well-paced beat sheet\n` +
    `  still contains scenes that share vocabulary. What must separate is the\n` +
    `  FIXTURE-LEVEL verdict below, which is what the report actually emits.`
);

console.log("\nTHRESHOLD SWEEP  (fixture-level: is the beat sheet reported as stretched?)");
console.log("-".repeat(92));
console.log("thresh   bad caught   neg false-positives   detail");

const candidates: number[] = [];
for (let t = 0.2; t <= 0.7; t += 0.02) candidates.push(Math.round(t * 100) / 100);

const perfect: number[] = [];

for (const threshold of candidates) {
  const missed: string[] = [];
  const falsePositives: string[] = [];
  let caught = 0;

  for (const f of ALL_BEAT_FIXTURES) {
    const report = buildBeatDensityReport({
      beats: f.beats,
      targetSceneCount: f.targetSceneCount,
      threshold,
    });
    const flagged = report.findings.some(
      (x) =>
        x.severity === "warning" &&
        (x.code === "beat-stretched" ||
          x.code === "resolution-stretched" ||
          x.code === "declared-distinctness-unsupported" ||
          x.code === "premise-too-small")
    );

    if (f.expectation === "flag") {
      if (flagged) caught++;
      else missed.push(f.name);
    } else if (flagged) falsePositives.push(f.name);
  }

  const isPerfect = missed.length === 0 && falsePositives.length === 0;
  if (isPerfect) perfect.push(threshold);

  console.log(
    `${threshold.toFixed(2)}     ${String(caught).padStart(2)}/${BAD_BEAT_FIXTURES.length}` +
      `          ${String(falsePositives.length).padStart(2)}/${NEGATIVE_BEAT_FIXTURES.length}` +
      `                  ${isPerfect ? "PERFECT" : `${missed.length ? "miss:" + missed.join(",") : ""}${falsePositives.length ? " FP:" + falsePositives.join(",") : ""}`}`
  );
}

console.log("\nRECOMMENDATION");
console.log("-".repeat(92));
if (perfect.length > 0) {
  const lo = perfect[0];
  const hi = perfect[perfect.length - 1];
  const mid = Math.round(((lo + hi) / 2) * 100) / 100;
  console.log(`  Perfect-separation range : ${lo.toFixed(2)} .. ${hi.toFixed(2)}  (${perfect.length} values)`);
  console.log(`  Midpoint (recommended)   : ${mid.toFixed(2)}`);
  console.log(`  Currently committed      : ${MOVE_SIMILARITY_THRESHOLD.toFixed(2)}`);
  const inRange = MOVE_SIMILARITY_THRESHOLD >= lo && MOVE_SIMILARITY_THRESHOLD <= hi;
  console.log(
    `  ${inRange ? "OK — committed value is inside the perfect range." : "MISMATCH — move the committed value into the range."}`
  );
} else {
  console.log("  NO threshold separates the populations. The comparison is wrong, not the number.");
}

console.log("\nPER-FIXTURE REPORT AT THE COMMITTED THRESHOLD");
console.log("-".repeat(92));
for (const f of ALL_BEAT_FIXTURES) {
  const r = buildBeatDensityReport({ beats: f.beats, targetSceneCount: f.targetSceneCount });
  const flagged = r.findings.some((x) => x.severity === "warning");
  const ok = f.expectation === "flag" ? flagged : !flagged;
  console.log(
    `  ${ok ? "OK  " : "FAIL"}  ${f.name.padEnd(40)} ` +
      `moves=${String(r.totalVerifiedDistinctMoves).padStart(2)}/${String(r.totalScenes).padStart(2)} ` +
      `stretch=${String(r.totalStretchScenes).padStart(2)} warn=${r.warnings} ` +
      `codes=[${[...new Set(r.findings.map((x) => x.code))].join(",")}]`
  );
}

console.log("\nCLUSTERING SANITY");
console.log("-".repeat(92));
{
  const stretched = BAD_BEAT_FIXTURES.find((f) => f.name === "stretched-celebration")!;
  const clusters = clusterMoves(stretched.beats[0].whatEachSceneDoes);
  console.log(`  stretched-celebration : 8 descriptions -> ${clusters.length} distinct move(s)`);
}
{
  const escalating = NEGATIVE_BEAT_FIXTURES.find((f) => f.name === "escalating-attempts")!;
  const clusters = clusterMoves(escalating.beats[0].whatEachSceneDoes);
  console.log(`  escalating-attempts   : 4 descriptions -> ${clusters.length} distinct move(s)`);
}
{
  const clues = NEGATIVE_BEAT_FIXTURES.find((f) => f.name === "mystery-clues")!;
  const clusters = clusterMoves(clues.beats[0].whatEachSceneDoes);
  console.log(`  mystery-clues         : 5 descriptions -> ${clusters.length} distinct move(s)`);
}

console.log("");
