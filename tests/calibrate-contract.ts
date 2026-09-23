import {
  ALL_CONTRACT_FIXTURES,
  BAD_CONTRACT_FIXTURES,
  LEGITIMATE_CONTRACT_FIXTURES,
} from "./fixtures/contract-fixtures.js";
import { buildSceneContractReport, BEFORE_AFTER_THRESHOLD, ACTIVITY_THRESHOLD } from "../src/server/story/scene-contract.js";
import { textSimilarity } from "../src/server/story/scene-distinctiveness.js";

/**
 * Scene-contract threshold calibration.
 *
 * Two thresholds, both sweeping against the same two populations:
 *
 *   BEFORE_AFTER_THRESHOLD - above it, `before` and `after` are one state
 *                            reworded rather than two states.
 *   ACTIVITY_THRESHOLD     - above it, the claimed value change is really the
 *                            scene's own action line restated.
 *
 * These are much shorter phrases than scene signatures (P0) or beat
 * descriptions (P1), so the distribution is different again and neither
 * earlier number is inherited.
 *
 * Offline. Run with: npx tsx tests/calibrate-contract.ts
 */

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

function bar(v: number, width = 30): string {
  return "#".repeat(Math.round(v * width)).padEnd(width, ".");
}

console.log("\n" + "=".repeat(94));
console.log("SCENE CONTRACT — THRESHOLD CALIBRATION");
console.log("=".repeat(94));

// --- before/after similarity ---------------------------------------------
console.log("\nBEFORE -> AFTER SIMILARITY (per scene)");
console.log("-".repeat(94));
console.log("fixture                                       expect   scene   score   profile");

const badBA: number[] = [];
const legitBA: number[] = [];

for (const f of ALL_CONTRACT_FIXTURES) {
  for (const s of f.scenes) {
    const p = s.contract?.progression;
    if (!p) continue;
    const score = textSimilarity(String(p.before ?? ""), String(p.after ?? ""));
    // Only the fixtures aimed at before/after feed that population; the others
    // would pollute it with unrelated failure modes.
    const targetsBA =
      f.name === "identical-before-after" || f.name === "paraphrased-before-after";
    if (f.expectation === "flag" && targetsBA) badBA.push(score);
    if (f.expectation === "clean") legitBA.push(score);

    console.log(
      `${f.name.padEnd(45)} ${f.expectation.padEnd(6)}  S${String(s.sceneNumber).padStart(2)}    ` +
        `${score.toFixed(3)}  ${bar(score)}`
    );
  }
}

const bBA = stats(badBA);
const lBA = stats(legitBA);
console.log("\n  BAD  (before~after fixtures) : n=" + bBA.n + `  min=${bBA.min.toFixed(3)}  max=${bBA.max.toFixed(3)}`);
console.log("  LEGIT (all clean fixtures)   : n=" + lBA.n + `  min=${lBA.min.toFixed(3)}  max=${lBA.max.toFixed(3)}  mean=${lBA.mean.toFixed(3)}`);
console.log(
  `  Separation band              : legit max ${lBA.max.toFixed(3)} -> bad min ${bBA.min.toFixed(3)}  ` +
    (bBA.min > lBA.max ? `(CLEAN GAP ${(bBA.min - lBA.max).toFixed(3)})` : `(OVERLAP ${(lBA.max - bBA.min).toFixed(3)})`)
);

// --- activity similarity --------------------------------------------------
console.log("\nPROGRESSION vs SCENE ACTION SIMILARITY");
console.log("-".repeat(94));

const badAct: number[] = [];
const legitAct: number[] = [];

for (const f of ALL_CONTRACT_FIXTURES) {
  for (const s of f.scenes) {
    const p = s.contract?.progression;
    const action = String(s.characterActions ?? "");
    if (!p || !action) continue;
    const score = Math.max(
      textSimilarity(String(p.before ?? ""), action),
      textSimilarity(String(p.after ?? ""), action)
    );
    const targetsActivity = f.name === "progression-mirrors-action";
    if (f.expectation === "flag" && targetsActivity) badAct.push(score);
    if (f.expectation === "clean") legitAct.push(score);
  }
}

const bA = stats(badAct);
const lA = stats(legitAct);
console.log(`  BAD  (mirrors-action fixture) : n=${bA.n}  min=${bA.min.toFixed(3)}  max=${bA.max.toFixed(3)}`);
console.log(`  LEGIT (all clean fixtures)    : n=${lA.n}  min=${lA.min.toFixed(3)}  max=${lA.max.toFixed(3)}  mean=${lA.mean.toFixed(3)}`);
console.log(
  `  Separation band               : legit max ${lA.max.toFixed(3)} -> bad min ${bA.min.toFixed(3)}  ` +
    (bA.min > lA.max ? `(CLEAN GAP ${(bA.min - lA.max).toFixed(3)})` : `(OVERLAP ${(lA.max - bA.min).toFixed(3)})`)
);

// --- fixture-level sweep --------------------------------------------------
console.log("\nFIXTURE-LEVEL SWEEP  (does the report raise a warning for this fixture?)");
console.log("-".repeat(94));
console.log("BA     ACT    bad caught   legit false-positives   detail");

const baCandidates: number[] = [];
for (let t = 0.4; t <= 0.9; t += 0.04) baCandidates.push(Math.round(t * 100) / 100);
const actCandidates: number[] = [];
for (let t = 0.3; t <= 0.8; t += 0.05) actCandidates.push(Math.round(t * 100) / 100);

interface Combo {
  ba: number;
  act: number;
}
const perfect: Combo[] = [];

for (const ba of baCandidates) {
  for (const act of actCandidates) {
    const missed: string[] = [];
    const fp: string[] = [];
    let caught = 0;

    for (const f of ALL_CONTRACT_FIXTURES) {
      // The module's thresholds are compile-time constants, so the sweep
      // re-implements only the two comparisons it is varying and leaves every
      // other rule to the real validator.
      const report = buildSceneContractReport({ scenes: f.scenes, characters: f.characters });
      let flagged = report.warnings > 0;

      // Re-evaluate the two swept comparisons at the candidate values.
      if (!flagged) {
        for (const s of f.scenes) {
          const p = s.contract?.progression;
          if (!p) continue;
          const baScore = textSimilarity(String(p.before ?? ""), String(p.after ?? ""));
          const action = String(s.characterActions ?? "");
          const actScore = action
            ? Math.max(textSimilarity(String(p.before ?? ""), action), textSimilarity(String(p.after ?? ""), action))
            : 0;
          if (baScore >= ba || actScore >= act) flagged = true;
        }
      } else {
        // Already flagged by a rule that is not being swept - but if the ONLY
        // reason was a swept comparison, re-check at the candidate value.
        const onlySwept = report.issues
          .filter((i) => i.severity === "warning")
          .every((i) => i.code === "near-identical-before-after" || i.code === "progression-restates-action");
        if (onlySwept) {
          flagged = false;
          for (const s of f.scenes) {
            const p = s.contract?.progression;
            if (!p) continue;
            const baScore = textSimilarity(String(p.before ?? ""), String(p.after ?? ""));
            const action = String(s.characterActions ?? "");
            const actScore = action
              ? Math.max(textSimilarity(String(p.before ?? ""), action), textSimilarity(String(p.after ?? ""), action))
              : 0;
            if (baScore >= ba || actScore >= act) flagged = true;
          }
        }
      }

      if (f.expectation === "flag") {
        if (flagged) caught++;
        else missed.push(f.name);
      } else if (flagged) fp.push(f.name);
    }

    const isPerfect = missed.length === 0 && fp.length === 0;
    if (isPerfect) perfect.push({ ba, act });
  }
}

// Print a readable slice rather than the full 13x11 grid.
for (const ba of baCandidates) {
  const acts = perfect.filter((p) => p.ba === ba).map((p) => p.act);
  if (acts.length > 0) {
    console.log(`${ba.toFixed(2)}   ${acts[0].toFixed(2)}-${acts[acts.length - 1].toFixed(2)}   ${BAD_CONTRACT_FIXTURES.length}/${BAD_CONTRACT_FIXTURES.length}          0/${LEGITIMATE_CONTRACT_FIXTURES.length}                     PERFECT`);
  }
}

console.log("\nRECOMMENDATION");
console.log("-".repeat(94));
if (perfect.length > 0) {
  const bas = [...new Set(perfect.map((p) => p.ba))].sort((a, b) => a - b);
  const acts = [...new Set(perfect.map((p) => p.act))].sort((a, b) => a - b);
  const baMid = Math.round(((bas[0] + bas[bas.length - 1]) / 2) * 100) / 100;
  const actMid = Math.round(((acts[0] + acts[acts.length - 1]) / 2) * 100) / 100;

  console.log(`  BEFORE_AFTER perfect range : ${bas[0].toFixed(2)} .. ${bas[bas.length - 1].toFixed(2)}   midpoint ${baMid.toFixed(2)}   committed ${BEFORE_AFTER_THRESHOLD.toFixed(2)}`);
  console.log(`  ACTIVITY     perfect range : ${acts[0].toFixed(2)} .. ${acts[acts.length - 1].toFixed(2)}   midpoint ${actMid.toFixed(2)}   committed ${ACTIVITY_THRESHOLD.toFixed(2)}`);
  const baOk = BEFORE_AFTER_THRESHOLD >= bas[0] && BEFORE_AFTER_THRESHOLD <= bas[bas.length - 1];
  const actOk = ACTIVITY_THRESHOLD >= acts[0] && ACTIVITY_THRESHOLD <= acts[acts.length - 1];
  console.log(`  ${baOk ? "OK" : "MISMATCH"} — BEFORE_AFTER_THRESHOLD`);
  console.log(`  ${actOk ? "OK" : "MISMATCH"} — ACTIVITY_THRESHOLD`);
} else {
  console.log("  NO combination separates the populations. The comparison is wrong, not the numbers.");
}

// --- per-fixture at committed values --------------------------------------
console.log("\nPER-FIXTURE REPORT AT COMMITTED THRESHOLDS");
console.log("-".repeat(94));
for (const f of ALL_CONTRACT_FIXTURES) {
  const r = buildSceneContractReport({ scenes: f.scenes, characters: f.characters });
  const flagged = r.warnings > 0;
  const ok = f.expectation === "flag" ? flagged : !flagged;
  const codes = [...new Set(r.issues.filter((i) => i.severity === "warning").map((i) => i.code))];
  const expectedHit =
    !f.expectCodes || f.expectCodes.every((c) => codes.includes(c as any));
  console.log(
    `  ${ok ? "OK  " : "FAIL"}  ${f.name.padEnd(45)} warn=${String(r.warnings).padStart(2)} ` +
      `${expectedHit ? "" : "[EXPECTED CODES MISSING] "}codes=[${codes.join(",")}]`
  );
}

console.log("");
