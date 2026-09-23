import {
  ALL_ACTION_FIXTURES,
  OVERLOADED_FIXTURES,
  RENDERABLE_FIXTURES,
  ALL_ROMAN_URDU_FIXTURES,
  ROMAN_URDU_OVERLOADED,
  ROMAN_URDU_RENDERABLE,
  UNREADABLE_ACTIONS,
} from "./fixtures/action-fixtures.js";
import { measureActionDensity, BEAT_LIMITS, DEFAULT_BEAT_LIMIT, RELOCATION_LIMIT } from "../src/server/story/action-density.js";
import { parseReport } from "./parse-report.js";
import fs from "fs";
import path from "path";

/**
 * Action-density calibration.
 *
 * Sweeps the per-type beat limits and the relocation limit against two fixture
 * populations, and plots real generated stories against them.
 *
 * The measure is precision-first by design: a false "your scene is broken"
 * costs more than a missed one, because it is how a check gets switched off.
 *
 * Offline. Run with: npx tsx tests/calibrate-action-density.ts
 */

console.log("\n" + "=".repeat(92));
console.log("ACTION DENSITY — CALIBRATION");
console.log("=".repeat(92));

console.log("\nPER-FIXTURE MEASUREMENT (committed limits)");
console.log("-".repeat(92));
console.log("fixture                        expect       type              beats  reloc  simul  limit  verdict");

let fp = 0, fn = 0;
for (const f of ALL_ACTION_FIXTURES) {
  const m = measureActionDensity(f.scene);
  const verdict = !m.confident ? "unclassified" : m.overloaded ? "OVERLOADED" : "renderable";
  const correct = f.expectation === "overloaded" ? m.overloaded : !m.overloaded;
  if (!correct && f.expectation === "renderable") fp++;
  if (!correct && f.expectation === "overloaded") fn++;
  console.log(
    `${correct ? "OK  " : "FAIL"} ${f.name.padEnd(28)} ${f.expectation.padEnd(12)} ${(m.performanceType ?? "-").padEnd(17)} ` +
      `${String(m.sequentialBeats).padStart(5)}  ${String(m.relocations).padStart(5)}  ${String(m.simultaneousStrands).padStart(5)}  ${String(m.limit).padStart(5)}  ${verdict}`
  );
}

console.log(`\n  false positives (renderable flagged): ${fp}/${RENDERABLE_FIXTURES.length}`);
console.log(`  false negatives (overloaded missed) : ${fn}/${OVERLOADED_FIXTURES.length}`);

console.log("\nROMAN URDU FIXTURES");
console.log("-".repeat(92));
console.log("fixture                        expect       type              beats  reloc  simul  limit  verdict");

let rfp = 0;
let rfn = 0;
let runclass = 0;

for (const f of ALL_ROMAN_URDU_FIXTURES) {
  const m = measureActionDensity(f.scene);
  const verdict = !m.confident ? "unclassified" : m.overloaded ? "OVERLOADED" : "renderable";
  const correct = f.expectation === "overloaded" ? m.overloaded : !m.overloaded;
  if (!correct && f.expectation === "renderable") rfp++;
  if (!correct && f.expectation === "overloaded") rfn++;
  if (!m.confident) runclass++;
  console.log(
    `${correct ? "OK  " : "FAIL"} ${f.name.padEnd(28)} ${f.expectation.padEnd(12)} ${(m.performanceType ?? "-").padEnd(17)} ` +
      `${String(m.sequentialBeats).padStart(5)}  ${String(m.relocations).padStart(5)}  ${String(m.simultaneousStrands).padStart(5)}  ${String(m.limit).padStart(5)}  ${verdict}`
  );
}

console.log(`\n  Roman Urdu false positives: ${rfp}/${ROMAN_URDU_RENDERABLE.length}`);
console.log(`  Roman Urdu false negatives: ${rfn}/${ROMAN_URDU_OVERLOADED.length}`);
console.log(`  Roman Urdu unclassified   : ${runclass}/${ALL_ROMAN_URDU_FIXTURES.length}`);

console.log("\nUNREADABLE LANGUAGES (must stay unclassified)");
console.log("-".repeat(92));
for (const [i, text] of UNREADABLE_ACTIONS.entries()) {
  const m = measureActionDensity({ sceneNumber: i + 1, characterActions: text, contract: { performanceType: "action" } });
  console.log(`  ${m.confident ? "FAIL" : "OK  "} sample ${i + 1}: confident=${m.confident} overloaded=${m.overloaded}`);
}

console.log("\nPOPULATION SEPARATION (sequential beats)");
console.log("-".repeat(92));
const ov = OVERLOADED_FIXTURES.map(f => measureActionDensity(f.scene));
const rn = RENDERABLE_FIXTURES.map(f => measureActionDensity(f.scene)).filter(m => m.confident);
const stats = (xs: number[]) => xs.length ? `min ${Math.min(...xs)} mean ${(xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(2)} max ${Math.max(...xs)}` : "n/a";
console.log(`  OVERLOADED beats : ${stats(ov.map(m=>m.sequentialBeats))}`);
console.log(`  RENDERABLE beats : ${stats(rn.map(m=>m.sequentialBeats))}`);
console.log(`  OVERLOADED reloc : ${stats(ov.map(m=>m.relocations))}`);
console.log(`  RENDERABLE reloc : ${stats(rn.map(m=>m.relocations))}`);

console.log("\nBEAT-LIMIT SWEEP (uniform limit applied to every type, relocation rule held)");
console.log("-".repeat(92));
console.log("limit   overloaded caught   renderable false-positives");
for (let limit = 2; limit <= 6; limit++) {
  let caught = 0, falsePos = 0;
  for (const f of ALL_ACTION_FIXTURES) {
    const m = measureActionDensity(f.scene);
    if (!m.confident) continue;
    const flagged = (m.sequentialBeats > limit && m.relocations >= 1) || m.relocations > RELOCATION_LIMIT;
    if (f.expectation === "overloaded" && flagged) caught++;
    if (f.expectation === "renderable" && flagged) falsePos++;
  }
  console.log(`${String(limit).padStart(5)}   ${String(caught).padStart(17)}/${OVERLOADED_FIXTURES.length}   ${String(falsePos).padStart(24)}/${RENDERABLE_FIXTURES.length}`);
}

console.log("\nCOMMITTED PER-TYPE LIMITS");
console.log("-".repeat(92));
Object.entries(BEAT_LIMITS).forEach(([t, l]) => console.log(`  ${t.padEnd(18)} ${l}`));
console.log(`  ${"(unclassified)".padEnd(18)} ${DEFAULT_BEAT_LIMIT}`);
console.log(`  relocation limit   ${RELOCATION_LIMIT}`);

console.log("\nREAL GENERATED STORIES");
console.log("-".repeat(92));
const dir = path.resolve(process.cwd(), "test-output");
if (fs.existsSync(dir)) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".md"))) {
    try {
      const r = parseReport(path.join(dir, file));
      if (r.scenes.length === 0) continue;
      const measured = r.scenes.map(measureActionDensity);
      const conf = measured.filter(m => m.confident);
      const over = measured.filter(m => m.overloaded);
      console.log(
        `  ${r.title.slice(0, 40).padEnd(42)} ${String(r.scenes.length).padStart(3)} scenes  ` +
          `mean beats ${(conf.reduce((s,m)=>s+m.sequentialBeats,0)/(conf.length||1)).toFixed(2)}  ` +
          `max ${conf.reduce((m,x)=>Math.max(m,x.sequentialBeats),0)}  ` +
          `overloaded ${over.length}  unclassified ${measured.length-conf.length}`
      );
      if (over.length > 0) {
        over.slice(0, 5).forEach(m =>
          console.log(`      S${m.sceneNumber}: ${m.sequentialBeats} beats / ${m.relocations} reloc — ${m.beatTexts.slice(0,3).join(" | ").slice(0,110)}`)
        );
      }
    } catch (e: any) {
      console.log(`  (could not parse ${file}: ${e?.message})`);
    }
  }
}
console.log("");
