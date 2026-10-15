import { buildSceneCraftRules } from "../../src/server/story/story-craft.js";
import {
  buildStoryIntelligenceDirectives,
  buildBlueprintPromptBlock,
  sliceBlueprintForRange,
  buildStoryMemory,
} from "../../src/server/story/blueprint.js";

/**
 * P3 prompt-size measurement.
 *
 * Evidence only. No optimisation, no batch-size change. ~4 chars per token.
 */
const CHARS_PER_TOKEN = 4;
const est = (c: number) => Math.round(c / CHARS_PER_TOKEN);

const beats = Array.from({ length: 4 }, (_, b) => ({
  beatNumber: b + 1, name: `Beat ${b + 1}`, chapterNumber: b + 1,
  sceneStart: b * 6 + 1, sceneEnd: b * 6 + 6,
  purpose: "p", causeFromPrevious: "c", consequence: "q", escalation: "e",
  emotionalTemperature: "t", charactersInFocus: ["Karela"],
  distinctScenesNeeded: 6,
  whatEachSceneDoes: Array.from({ length: 6 }, (_, i) => `Scene ${b * 6 + i + 1} does a specific and distinct dramatic thing here`),
}));

const blueprint = {
  logline: "l", theme: "t", centralQuestion: "q", castPlan: [], relationships: [],
  setups: [], chapters: [], beats,
};

const scenes = Array.from({ length: 12 }, (_, i) => ({
  sceneNumber: i + 1,
  storyFunction: "did something",
  dialogueTurns: [{ speaker: "Karela", line: "Aaj nahi ho payega bhai" }, { speaker: "Bhindi", line: "Kal bhi yehi kaha tha" }],
  contract: {
    goal: "Karela wants to close before the rain starts",
    obstacle: "Bhindi is still counting",
    outcome: "partial",
    performanceType: "dialogue-scene",
    progression: { kind: "relationship", value: "patience between them", before: "thin", after: "thinner" },
  },
}));

const craft = { storyMode: "Heartwarming", duration: "4 minutes", language: "Roman Urdu", targetSceneCount: 24 };

const rules = buildSceneCraftRules(craft);
const slice = sliceBlueprintForRange(blueprint, 13, 24);
const memory = buildStoryMemory(scenes, blueprint);
const directives = buildStoryIntelligenceDirectives({ startScene: 13, endScene: 24, totalScenes: 24, language: "Roman Urdu", slice });
const block = buildBlueprintPromptBlock(slice, memory);

// P3-attributable sections, measured by locating their headings.
const sectionSize = (text: string, start: string, end?: string) => {
  const s = text.indexOf(start);
  if (s < 0) return 0;
  const e = end ? text.indexOf(end, s) : -1;
  return (e < 0 ? text.length : e) - s;
};

const rail = sectionSize(directives, "SCENE PROGRESSION RAIL", "BEAT DISCIPLINE:");
const perfType = sectionSize(rules, "PERFORMANCE TYPE - WHAT KIND", "PERFORMANCE CHOREOGRAPHY");
const choreo = sectionSize(rules, "PERFORMANCE CHOREOGRAPHY", "   - DIALOGUE REGISTER");
const speak = sectionSize(rules, "WHAT ACTUALLY FITS IN", "   - Talking scenes SHOULD");
const moves = sectionSize(block, "PLANNED MOVE FOR EACH SCENE", "NARRATIVE BLUEPRINT FOR THIS RANGE");
const seam = sectionSize(block, "DRAMATIC JOBS ALREADY DONE", "PROPS IN PLAY");

console.log("\n" + "=".repeat(74));
console.log("P3 PROMPT-SIZE MEASUREMENT  (12-scene batch, 24-scene film)");
console.log("=".repeat(74));
console.log("\nPER-BATCH ADDITIONS");
console.log("-".repeat(74));
const rows: Array<[string, number]> = [
  ["Progression rail", rail],
  ["Performance-type guidance", perfType],
  ["Choreography", choreo],
  ["Speakability envelope", speak],
  ["Planned moves (12 scenes)", moves],
  ["Seam + progression memory", seam],
];
let total = 0;
for (const [label, chars] of rows) {
  total += chars;
  console.log(`  ${label.padEnd(30)} ${String(chars).padStart(6)} chars  (~${String(est(chars)).padStart(5)} tokens)`);
}
console.log(`  ${"TOTAL".padEnd(30)} ${String(total).padStart(6)} chars  (~${String(est(total)).padStart(5)} tokens)`);

console.log("\nOFFSET: planned moves are no longer duplicated inside the serialised beats");
const dupBytes = beats.slice(2).reduce((s, b) => s + JSON.stringify(b.whatEachSceneDoes).length + JSON.stringify(b.distinctScenesNeeded).length, 0);
console.log(`  removed from beat JSON          ${String(dupBytes).padStart(6)} chars  (~${est(dupBytes)} tokens)`);
console.log(`  NET                             ${String(total - dupBytes).padStart(6)} chars  (~${est(total - dupBytes)} tokens)`);

console.log("\nAGAINST MEASURED REAL USAGE");
console.log("-".repeat(74));
console.log("  Reference: 36-scene Mystery run, ~25,000 prompt tokens per call.");
console.log(`  P3 prompt delta: +${(((total - dupBytes) / CHARS_PER_TOKEN / 25000) * 100).toFixed(1)}%`);
console.log("  Completion is unaffected: P3 adds guidance, not new output fields.");
console.log("");
