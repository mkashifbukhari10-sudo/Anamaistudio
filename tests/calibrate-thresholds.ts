import fs from "fs";
import path from "path";
import { ALL_FIXTURES, BAD_FIXTURES, NEGATIVE_FIXTURES } from "./fixtures/story-fixtures.js";
import { parseReport } from "./parse-report.js";
import {
  buildSignature,
  scorePair,
  buildDistinctivenessReport,
  NEAR_WINDOW,
} from "../src/server/story/scene-distinctiveness.js";

/**
 * Threshold calibration harness.
 *
 * The committed NEAR/FAR thresholds must come from evidence, not from taste.
 * This sweeps candidate values across three populations and prints the
 * separation between them:
 *
 *   1. BAD fixtures      - stretched films that must be caught
 *   2. NEGATIVE fixtures - legitimate craft that must not be
 *   3. REAL stories      - whatever is in test-output/, so the numbers are
 *                          anchored to actual generator output rather than to
 *                          my idea of what output looks like
 *
 * Offline. No API calls. Run with: npx tsx tests/calibrate-thresholds.ts
 */

function consecutiveScores(scenes: any[], characters: any[] = []): number[] {
  const sigs = scenes.map((s) => buildSignature(s, characters));
  const out: number[] = [];
  for (let i = 1; i < sigs.length; i++) out.push(scorePair(sigs[i - 1], sigs[i]).score);
  return out;
}

function windowScores(scenes: any[], characters: any[] = []): number[] {
  const sigs = scenes.map((s) => buildSignature(s, characters));
  const out: number[] = [];
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      if (sigs[j].sceneNumber - sigs[i].sceneNumber <= NEAR_WINDOW) {
        out.push(scorePair(sigs[i], sigs[j]).score);
      }
    }
  }
  return out;
}

function stats(values: number[]) {
  if (values.length === 0) return { n: 0, min: 0, max: 0, mean: 0, p90: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 1000) / 1000,
    p90: sorted[Math.floor(sorted.length * 0.9)],
  };
}

function bar(value: number, width = 40): string {
  return "#".repeat(Math.round(value * width)).padEnd(width, ".");
}

console.log("\n" + "=".repeat(86));
console.log("SCENE DISTINCTIVENESS — THRESHOLD CALIBRATION");
console.log("=".repeat(86));

// --- Per-fixture consecutive-pair profile -------------------------------
console.log("\nPER-FIXTURE CONSECUTIVE-PAIR SIMILARITY");
console.log("-".repeat(86));
console.log("fixture                       expect   min    mean   max    profile");

const badConsecutive: number[] = [];
const negConsecutive: number[] = [];
const badWindow: number[] = [];
const negWindow: number[] = [];

for (const fixture of ALL_FIXTURES) {
  const scores = consecutiveScores(fixture.scenes, fixture.characters ?? []);
  const win = windowScores(fixture.scenes, fixture.characters ?? []);
  const s = stats(scores);

  if (fixture.expectation === "flag") {
    badConsecutive.push(...scores);
    badWindow.push(...win);
  } else {
    negConsecutive.push(...scores);
    negWindow.push(...win);
  }

  console.log(
    `${fixture.name.padEnd(28)}  ${fixture.expectation.padEnd(6)}  ` +
      `${s.min.toFixed(3)}  ${s.mean.toFixed(3)}  ${s.max.toFixed(3)}  ${bar(s.mean)}`
  );
}

// --- Real generated stories ---------------------------------------------
console.log("\nREAL GENERATED STORIES (test-output/)");
console.log("-".repeat(86));

const outDir = path.resolve(process.cwd(), "test-output");
const realScores: Array<{ title: string; scores: number[]; window: number[] }> = [];

if (fs.existsSync(outDir)) {
  for (const file of fs.readdirSync(outDir).filter((f) => f.endsWith(".md"))) {
    try {
      const report = parseReport(path.join(outDir, file));
      if (report.scenes.length < 2) continue;
      const scores = consecutiveScores(report.scenes, report.characters);
      const win = windowScores(report.scenes, report.characters);
      realScores.push({ title: report.title, scores, window: win });
      const s = stats(scores);
      console.log(
        `${report.title.slice(0, 42).padEnd(44)} ${String(report.scenes.length).padStart(3)} scenes  ` +
          `min ${s.min.toFixed(3)}  mean ${s.mean.toFixed(3)}  max ${s.max.toFixed(3)}  p90 ${s.p90.toFixed(3)}`
      );
    } catch (err: any) {
      console.log(`  (could not parse ${file}: ${err?.message})`);
    }
  }
} else {
  console.log("  (no test-output directory)");
}

// --- Population separation ----------------------------------------------
const badC = stats(badConsecutive);
const negC = stats(negConsecutive);
const badW = stats(badWindow);
const negW = stats(negWindow);

console.log("\nPOPULATION SEPARATION");
console.log("-".repeat(86));
console.log(`  BAD  consecutive : n=${badC.n}  min=${badC.min.toFixed(3)}  mean=${badC.mean.toFixed(3)}  max=${badC.max.toFixed(3)}`);
console.log(`  NEG  consecutive : n=${negC.n}  min=${negC.min.toFixed(3)}  mean=${negC.mean.toFixed(3)}  max=${negC.max.toFixed(3)}`);
console.log(`  BAD  in-window   : n=${badW.n}  min=${badW.min.toFixed(3)}  mean=${badW.mean.toFixed(3)}  max=${badW.max.toFixed(3)}`);
console.log(`  NEG  in-window   : n=${negW.n}  min=${negW.min.toFixed(3)}  mean=${negW.mean.toFixed(3)}  max=${negW.max.toFixed(3)}`);

const gapLow = negW.max;
const gapHigh = badW.min;
console.log(
  `\n  Separation band  : negative max ${gapLow.toFixed(3)}  ->  bad min ${gapHigh.toFixed(3)}  ` +
    (gapHigh > gapLow ? `(CLEAN GAP of ${(gapHigh - gapLow).toFixed(3)})` : `(OVERLAP of ${(gapLow - gapHigh).toFixed(3)})`)
);

// --- Threshold sweep -----------------------------------------------------
console.log("\nTHRESHOLD SWEEP  (fixture-level: does the engine flag the story at all?)");
console.log("-".repeat(86));
console.log("thresh   bad caught        neg false-positives   verdict");

const candidates: number[] = [];
for (let t = 0.3; t <= 0.85; t += 0.05) candidates.push(Math.round(t * 100) / 100);

let recommended: number | null = null;

for (const threshold of candidates) {
  const caught: string[] = [];
  const missed: string[] = [];
  const falsePositives: string[] = [];

  for (const fixture of ALL_FIXTURES) {
    const sigs = fixture.scenes.map((s) => buildSignature(s, fixture.characters ?? []));
    let hit = false;
    for (let i = 0; i < sigs.length && !hit; i++) {
      for (let j = i + 1; j < sigs.length && !hit; j++) {
        if (sigs[j].sceneNumber - sigs[i].sceneNumber > NEAR_WINDOW) continue;
        if (scorePair(sigs[i], sigs[j]).score >= threshold) hit = true;
      }
    }
    if (fixture.expectation === "flag") (hit ? caught : missed).push(fixture.name);
    else if (hit) falsePositives.push(fixture.name);
  }

  const perfect = missed.length === 0 && falsePositives.length === 0;
  if (perfect && recommended === null) recommended = threshold;

  console.log(
    `${threshold.toFixed(2)}     ${String(caught.length).padStart(2)}/${BAD_FIXTURES.length}` +
      `              ${String(falsePositives.length).padStart(2)}/${NEGATIVE_FIXTURES.length}` +
      `                  ${perfect ? "PERFECT" : `${missed.length ? "miss:" + missed.join(",") : ""} ${falsePositives.length ? "FP:" + falsePositives.join(",") : ""}`}`
  );
}

console.log("\nRECOMMENDATION");
console.log("-".repeat(86));
if (recommended !== null) {
  const perfectRange = candidates.filter((t) => {
    let missed = 0;
    let fp = 0;
    for (const fixture of ALL_FIXTURES) {
      const sigs = fixture.scenes.map((s) => buildSignature(s, fixture.characters ?? []));
      let hit = false;
      for (let i = 0; i < sigs.length && !hit; i++) {
        for (let j = i + 1; j < sigs.length && !hit; j++) {
          if (sigs[j].sceneNumber - sigs[i].sceneNumber > NEAR_WINDOW) continue;
          if (scorePair(sigs[i], sigs[j]).score >= t) hit = true;
        }
      }
      if (fixture.expectation === "flag" && !hit) missed++;
      if (fixture.expectation === "clean" && hit) fp++;
    }
    return missed === 0 && fp === 0;
  });

  const lo = perfectRange[0];
  const hi = perfectRange[perfectRange.length - 1];
  const mid = Math.round(((lo + hi) / 2) * 100) / 100;
  console.log(`  Perfect-separation range : ${lo.toFixed(2)} .. ${hi.toFixed(2)}`);
  console.log(`  Midpoint (recommended)   : ${mid.toFixed(2)}`);
  console.log(`  Committed NEAR_THRESHOLD should sit at the midpoint for maximum margin.`);
} else {
  console.log("  NO threshold separates the populations cleanly. Dimension weights need work.");
}

// --- Real-story check at the recommended threshold ----------------------
if (realScores.length > 0) {
  console.log("\nREAL STORIES AT CANDIDATE THRESHOLDS");
  console.log("-".repeat(86));
  for (const { title, window } of realScores) {
    const line = candidates
      .filter((t) => [0.45, 0.5, 0.55, 0.6, 0.65].includes(t))
      .map((t) => `${t.toFixed(2)}:${window.filter((s) => s >= t).length}`)
      .join("  ");
    console.log(`  ${title.slice(0, 44).padEnd(46)} flagged pairs -> ${line}`);
  }
}

// --- Full-report smoke ----------------------------------------------------
console.log("\nFULL REPORT ON EACH FIXTURE (committed thresholds)");
console.log("-".repeat(86));
for (const fixture of ALL_FIXTURES) {
  const report = buildDistinctivenessReport({
    scenes: fixture.scenes,
    characters: fixture.characters ?? [],
    lifeJourney: fixture.lifeJourney ?? null,
    setups: fixture.setups ?? [],
  });
  const flagged = report.pairs.filter((p) => !p.exempt).length;
  const ok = fixture.expectation === "flag" ? flagged > 0 : flagged === 0;
  console.log(
    `  ${ok ? "OK  " : "FAIL"}  ${fixture.name.padEnd(28)} ` +
      `flagged=${String(flagged).padStart(2)} runs=${report.runs.length} ` +
      `exempt=${report.pairs.filter((p) => p.exempt).length} avgConsec=${report.averageConsecutiveSimilarity}`
  );
}

console.log("");
