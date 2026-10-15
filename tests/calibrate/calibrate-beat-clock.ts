/**
 * Beat clock calibration — what the allocator actually produces on real stories.
 *
 * Offline. Reads generated reports from test-output/ and prints the clock for
 * every scene shape that matters, plus the prompt cost of carrying one.
 *
 * Run: npx tsx tests/calibrate-beat-clock.ts
 */
import { readdirSync } from "node:fs";
import { parseReport } from "../helpers/parse-report.js";
import { buildBeatClock, renderBeatClock } from "../../src/server/story/beat-clock.js";
import { measureScene } from "../../src/server/story/performance-budget.js";

const DIR = "test-output";
const LANG = "Roman Urdu";

let total = 0, withClock = 0, overflows = 0, silentClocks = 0, speechRows = 0, actionRows = 0;
let costChars = 0, promptChars = 0;
const speechFractions: number[] = [];
const overflowScenes: string[] = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".md"))) {
  let scenes: any[];
  try { scenes = parseReport(`${DIR}/${file}`).scenes as any[]; } catch { continue; }

  for (const scene of scenes) {
    total++;
    const clock = buildBeatClock(scene, LANG);
    const text = renderBeatClock(clock);
    if (text) withClock++;
    if (clock.overflows) { overflows++; overflowScenes.push(`${file.slice(0, 26)} S${scene.sceneNumber}`); }

    const hasSpeech = clock.rows.some((r) => r.kind === "speech");
    if (!hasSpeech && clock.rows.length > 0) silentClocks++;
    speechRows += clock.rows.filter((r) => r.kind === "speech").length;
    actionRows += clock.rows.filter((r) => r.kind === "action").length;

    costChars += text.length;
    promptChars += String(scene.finalVideoPrompt || "").length;
    speechFractions.push(clock.speechSeconds / clock.secondsPerScene);
  }
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sorted = [...speechFractions].sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.floor(sorted.length * p)] ?? 0;

console.log(`scenes                      : ${total}`);
console.log(`scenes receiving a clock    : ${withClock} (${Math.round(100 * withClock / total)}%)`);
console.log(`clocks with no speech rows  : ${silentClocks}   (silent scenes stay silent)`);
console.log(`clocks that overflow        : ${overflows}`);
overflowScenes.slice(0, 8).forEach((s) => console.log(`    ${s}`));
console.log(`\nrows: ${actionRows} action, ${speechRows} speech  (mean ${((actionRows + speechRows) / total).toFixed(1)} rows/scene)`);
console.log(`\nspeech share of the shot: mean ${mean(speechFractions).toFixed(2)}  p10 ${pct(0.1).toFixed(2)}  p50 ${pct(0.5).toFixed(2)}  p90 ${pct(0.9).toFixed(2)}  max ${sorted[sorted.length - 1]?.toFixed(2)}`);
console.log(`\nprompt cost: +${Math.round(costChars / total)} chars/scene on a mean prompt of ${Math.round(promptChars / total)} chars (+${Math.round(100 * costChars / promptChars)}%)`);

// Show one clock of each shape.
const file = readdirSync(DIR).filter((f) => f.endsWith(".md")).find((f) => f.includes("chhota-beej"))!;
const scenes = parseReport(`${DIR}/${file}`).scenes as any[];

function show(label: string, scene: any) {
  if (!scene) return;
  const m = measureScene(scene, LANG);
  console.log(`\n${"=".repeat(68)}\n${label} — S${scene.sceneNumber}  (${m.turns} turns, ${m.words} words, verdict ${m.verdict})`);
  console.log(renderBeatClock(buildBeatClock(scene, LANG)));
}

show("CONVERSATION", scenes.find((s) => new Set(s.dialogueTurns.map((t: any) => t.speaker)).size >= 2));
show("ONE-LINE SCENE", scenes.find((s) => s.dialogueTurns.length === 1));
show("SILENT", scenes.find((s) => s.dialogueTurns.length === 0));
