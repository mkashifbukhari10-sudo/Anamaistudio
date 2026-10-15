/**
 * Offline validation of Phase A (Seam Identity) against real generated stories.
 *
 * Re-renders every stored scene's Flow prompt through the new pipeline and
 * measures the exit criteria the audit set. Reads only from disk - no API calls.
 *
 * The frames are located by asserting the rendered prompt actually opens and
 * closes with the exact text the seam builder produced, rather than by parsing
 * labels back out of the prose. Parsing them back was the first attempt and it
 * measured the entire prompt body as the "opening frame", because the opening
 * section has no terminator of its own.
 *
 * Run: npx tsx tests/validate-seam.ts
 */
import { readdirSync } from "node:fs";
import { parseReport } from "../helpers/parse-report.js";
import { makeSelfContained, ensureDialogueInPrompt } from "../../src/server/story/prompt-continuity.js";
import {
  applyFrameBookends,
  buildSceneFrames,
  OPENING_LEAD,
  CLOSING_LEAD,
} from "../../src/server/story/seam.js";

const DIR = "test-output";
const reports = readdirSync(DIR).filter((f) => f.endsWith(".md"));

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

let gOpen = 0, gClose = 0, gN = 0;
let gScenes = 0, gStamp = 0, gLabels = 0;
let gPairs = 0, gIdentical = 0;
let gPlacedOpen = 0, gPlacedClose = 0;

for (const file of reports) {
  let scenes: any[];
  try {
    scenes = parseReport(`${DIR}/${file}`).scenes as any[];
  } catch {
    continue;
  }
  if (!scenes?.length) continue;

  const rendered: string[] = [];
  const frames: Array<{ opening: string; closing: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prev = i > 0 ? scenes[i - 1] : null;
    const f = buildSceneFrames(scene, prev);
    let p = makeSelfContained(scene.finalVideoPrompt || "");
    p = ensureDialogueInPrompt(p, scene.dialogueTurns, "Roman Urdu");
    p = applyFrameBookends(p, f);
    rendered.push(p);
    frames.push(f);
  }

  let open = 0, close = 0, n = 0, stamp = 0, labels = 0;
  let placedOpen = 0, placedClose = 0;

  for (let i = 0; i < rendered.length; i++) {
    const p = rendered[i];
    const f = frames[i];

    // The assembler must have put the exact seam text at each end. The opening
    // is `includes`, not `startsWith`, because the prompt now leads with the
    // single-shot declaration - added after a generation came back as a
    // four-panel comic page.
    if (f.opening && p.includes(`${OPENING_LEAD}${f.opening}.`)) placedOpen++;
    if (f.closing && p.endsWith(`${CLOSING_LEAD}${f.closing}.`)) placedClose++;

    if (f.opening && f.closing) { open += words(f.opening); close += words(f.closing); n++; }

    if (new RegExp(`${OPENING_LEAD}\\s*At\\s+[\\d.]+\\s*s`, "i").test(p)) stamp++;

    // Exactly two frame labels expected: the two the assembler added.
    const marks = (p.match(/(?:Opening|First|Closing|Final|Last)\s+frame\s*[,:]/gi) || []).length;
    if (marks > 2) labels++;
  }

  // Seam identity, read back off the rendered strings.
  let pairs = 0, identical = 0;
  for (let i = 0; i < rendered.length - 1; i++) {
    const c = frames[i].closing;
    const o = frames[i + 1].opening;
    if (!c || !o) continue;
    pairs++;
    if (c === o && rendered[i].endsWith(`${CLOSING_LEAD}${c}.`) && rendered[i + 1].includes(`${OPENING_LEAD}${o}.`)) {
      identical++;
    }
  }

  const ratio = n ? (open / n) / (close / n) : 0;
  console.log(`\n${file.slice(0, 66)}`);
  console.log(`  scenes ${scenes.length} | opening ${n ? (open / n).toFixed(0) : "-"}w  closing ${n ? (close / n).toFixed(0) : "-"}w  ratio ${ratio.toFixed(2)}`);
  console.log(`  frames correctly placed: opening ${placedOpen}/${scenes.length}  closing ${placedClose}/${scenes.length}`);
  console.log(`  prompts opening "At Ns": ${stamp} | leftover frame labels in body: ${labels}`);
  console.log(`  seam identity: ${identical}/${pairs} joins share one identical frame text`);

  gOpen += open; gClose += close; gN += n;
  gScenes += scenes.length; gStamp += stamp; gLabels += labels;
  gPairs += pairs; gIdentical += identical;
  gPlacedOpen += placedOpen; gPlacedClose += placedClose;
}

const ratio = (gOpen / gN) / (gClose / gN);
console.log(`\n${"=".repeat(64)}`);
console.log(`TOTAL  scenes ${gScenes}  across ${reports.length} stories`);
console.log(`  mean opening frame : ${(gOpen / gN).toFixed(1)} words`);
console.log(`  mean closing frame : ${(gClose / gN).toFixed(1)} words`);
console.log(`  asymmetry ratio    : ${ratio.toFixed(2)}        (was 6.10, target <= 1.30)`);
console.log(`  frames placed      : open ${gPlacedOpen}/${gScenes}  close ${gPlacedClose}/${gScenes}`);
console.log(`  prompts opening "At Ns": ${gStamp}/${gScenes}   (was 24/36, target 0)`);
console.log(`  leftover frame labels in body: ${gLabels}/${gScenes}   (target 0)`);
console.log(`  SEAM IDENTITY      : ${gIdentical}/${gPairs} joins   (target: all)`);

const pass =
  ratio <= 1.3 &&
  gStamp === 0 &&
  gLabels === 0 &&
  gPairs > 0 &&
  gIdentical === gPairs &&
  gPlacedClose === gScenes;

console.log(`\n${pass ? "PASS" : "FAIL"} - Phase A exit criteria`);
process.exit(pass ? 0 : 1);
