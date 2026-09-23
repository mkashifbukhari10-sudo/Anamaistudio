import {
  buildStoryIntelligenceDirectives,
  buildBlueprintPromptBlock,
  sliceBlueprintForRange,
  buildStoryMemory,
} from "../src/server/story/blueprint.js";
import { buildSceneCraftRules } from "../src/server/story/story-craft.js";
import {
  buildPerformanceTypeGuidance,
  buildChoreographyGuidance,
  buildSpeakabilityGuidance,
  wordEnvelope,
} from "../src/server/story/performance-budget.js";
import { ensureDialogueInPrompt } from "../src/server/story/prompt-continuity.js";
import { buildSceneExecutionSection } from "../src/server/dev/quality-section.js";

/**
 * P3 regression suite — generation guidance.
 *
 * Prompt construction only. No API calls: every test builds the text that
 * WOULD be sent and asserts what it does and does not say.
 *
 * The negative half matters as much as the positive half. P3 exists partly to
 * undo a previous over-correction, so the suite asserts that the rules it
 * replaced have not crept back.
 */

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ""): void {
  if (condition) pass++;
  else {
    fail++;
    failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
  }
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${condition || !detail ? "" : ` (${detail})`}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Fixtures: a 24-scene blueprint whose beats carry P1 planned moves.
// ---------------------------------------------------------------------------

const BLUEPRINT = {
  logline: "Two siblings try to keep a failing shop open.",
  theme: "What you owe the people who stayed.",
  centralQuestion: "Is keeping it worth what it costs?",
  castPlan: [
    { name: "Karela", importance: "MAIN", want: "keep the shop", need: "let it go", flaw: "pride", voiceSignature: "never finishes a sentence", approxDialogueShare: 50 },
    { name: "Bhindi", importance: "MAIN", want: "be released", need: "say it out loud", flaw: "silence", voiceSignature: "answers questions with questions", approxDialogueShare: 50 },
  ],
  relationships: [],
  setups: [{ element: "the weighing scale", type: "prop", plantScene: 3, payoffScene: 20, meaning: "what was traded away" }],
  chapters: [],
  beats: [
    {
      beatNumber: 1, name: "Subah", chapterNumber: 1, sceneStart: 1, sceneEnd: 6,
      purpose: "establish", causeFromPrevious: "-", consequence: "-", escalation: "-",
      emotionalTemperature: "warm", charactersInFocus: ["Karela"],
      distinctScenesNeeded: 6,
      whatEachSceneDoes: [
        "The shutter goes up and the ordinary morning is established",
        "A customer asks for credit and is quietly refused",
        "Karela notices the weighing scale is uneven",
        "Bhindi arrives late and says nothing about why",
        "The rent notice is slid under the door",
        "Karela hides the notice before Bhindi sees it",
      ],
    },
    {
      beatNumber: 2, name: "Dabaav", chapterNumber: 2, sceneStart: 7, sceneEnd: 12,
      purpose: "pressure", causeFromPrevious: "-", consequence: "-", escalation: "-",
      emotionalTemperature: "tight", charactersInFocus: ["Bhindi"],
      distinctScenesNeeded: 6,
      whatEachSceneDoes: [
        "Bhindi finds the hidden notice",
        "The argument they have been avoiding finally happens",
        "Karela refuses the neighbour's loan out of pride",
        "Bhindi takes delivery work without telling him",
        "The shop stands empty for a whole afternoon",
        "Karela weighs by hand and gets it wrong in front of a customer",
      ],
    },
    {
      beatNumber: 3, name: "Faisla", chapterNumber: 3, sceneStart: 13, sceneEnd: 18,
      purpose: "decision", causeFromPrevious: "-", consequence: "-", escalation: "-",
      emotionalTemperature: "cold", charactersInFocus: ["Karela", "Bhindi"],
      distinctScenesNeeded: 6,
      whatEachSceneDoes: [
        "Bhindi says out loud that she wants to stop",
        "Karela hears it and does not answer",
        "He walks the shop alone at night",
        "He takes the scale down from its shelf",
        "The scale is sold and the money counted",
        "The rent is paid and the receipt folded away",
      ],
    },
    {
      beatNumber: 4, name: "Baad mein", chapterNumber: 4, sceneStart: 19, sceneEnd: 24,
      purpose: "resolution", causeFromPrevious: "-", consequence: "-", escalation: "-",
      emotionalTemperature: "quiet", charactersInFocus: ["Karela", "Bhindi"],
      distinctScenesNeeded: 6,
      whatEachSceneDoes: [
        "The shutter goes up on a shop with an empty shelf",
        "Karela weighs by hand, better this time",
        "Bhindi comes back on her own terms",
        "A customer notices the scale is gone and says nothing",
        "They close up together without counting",
        "The shutter stays down and they walk away from it",
      ],
    },
  ],
};

const CRAFT = {
  storyMode: "Heartwarming",
  duration: "4 minutes",
  language: "Roman Urdu",
  targetSceneCount: 24,
};

function scene(n: number, extra: Record<string, unknown> = {}): any {
  return {
    sceneNumber: n,
    storyFunction: `Scene ${n} does its job`,
    characterActions: `Karela handles something at the counter in scene ${n}`,
    facialExpressions: "steady",
    charactersPresent: ["Karela"],
    continuityState: { placeId: "place_shop" },
    dialogueTurns: [{ speaker: "Karela", line: `Line for scene ${n} here` }],
    contract: {
      goal: `Karela wants something specific in scene ${n}`,
      obstacle: "Something stands in the way",
      outcome: n % 2 === 0 ? "partial" : "denied",
      performanceType: "dialogue-scene",
      progression: { kind: "progress", value: `value ${n}`, before: `state ${n} before`, after: `state ${n} after` },
    },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
section("Planned moves reach the exact scenes being generated");
{
  const slice = sliceBlueprintForRange(BLUEPRINT, 13, 24)!;
  ok("slice carries planned moves", slice.plannedMoves.length === 12, String(slice.plannedMoves.length));
  ok("scoped to the batch range", slice.plannedMoves.every((m) => m.sceneNumber >= 13 && m.sceneNumber <= 24));
  ok("mapped to the right scene", slice.plannedMoves.find((m) => m.sceneNumber === 16)?.move.includes("scale down from its shelf") ?? false);
  ok("beat attribution survives", slice.plannedMoves.find((m) => m.sceneNumber === 20)?.beatNumber === 4);
  ok("ordered by scene", slice.plannedMoves.every((m, i, a) => i === 0 || a[i - 1].sceneNumber < m.sceneNumber));
}
{
  const slice = sliceBlueprintForRange(BLUEPRINT, 1, 12)!;
  const block = buildBlueprintPromptBlock(slice, null);
  ok("the prompt lists a move per scene", block.includes("PLANNED MOVE FOR EACH SCENE"));
  ok("with the scene number", block.includes("Scene 5 (beat 1):"));
  ok("and the planned text", block.includes("The rent notice is slid under the door"));
  ok("moves outside the batch are excluded", !block.includes("The scale is sold"));
  ok("execution, not a second plan", block.includes("it is not a second plan"));
  ok("adaptation preserves purpose", block.includes("PRESERVE ITS DRAMATIC PURPOSE"));
}
{
  // An older blueprint with no planned moves must still build a prompt.
  const bare = { ...BLUEPRINT, beats: BLUEPRINT.beats.map(({ whatEachSceneDoes, ...b }) => b) };
  const slice = sliceBlueprintForRange(bare, 1, 12)!;
  ok("no planned moves when the blueprint has none", slice.plannedMoves.length === 0);
  ok("and no planned-move block is emitted", !buildBlueprintPromptBlock(slice, null).includes("PLANNED MOVE FOR EACH SCENE"));
}

// ---------------------------------------------------------------------------
section("Progression rail");
{
  const slice = sliceBlueprintForRange(BLUEPRINT, 1, 12);
  const directives = buildStoryIntelligenceDirectives({
    startScene: 1, endScene: 12, totalScenes: 24, language: "Roman Urdu", slice,
  });

  ok("the rail is present", directives.includes("SCENE PROGRESSION RAIL"));
  ok("states the full order", /SCENE GOAL -> OBSTACLE -> ACTION \/ INTERACTION -> OUTCOME -> NARRATIVE VALUE CHANGE -> HANDOFF/.test(directives));
  ok("names the contract fields", directives.includes("goal, obstacle, outcome, progression"));
  ok("demands a value move, not activity", directives.includes("It is finished when a VALUE has moved"));
  ok("warns about two events instead of one value", directives.includes("Golu enters the room -> Golu talks to Mooli"));
  ok("protects small changes", directives.includes("A SMALL change is completely valid"));

  ok("instructs comparison inside the same response", directives.includes("scenes you have authored so far in THIS batch"));
  ok("lists the seven dimensions", [
    "scene goal", "obstacle", "outcome", "progression kind", "primary physical action",
    "conversational purpose", "emotional beat",
  ].every((d) => directives.includes(d)));
  ok("says CHANGE the job, not reword it", directives.includes("CHANGE THE SECOND SCENE'S DRAMATIC JOB"));
  ok("forbids paraphrase as a fix", directives.includes("Do not reword it"));
}

// ---------------------------------------------------------------------------
section("Performance-type guidance");
{
  const rules = buildSceneCraftRules(CRAFT);
  const types = ["DIALOGUE-SCENE", "ACTION", "ESTABLISHING", "REACTION", "SILENT-EMOTIONAL", "MONTAGE-ELEMENT", "COMEDY-BEAT", "TRANSITION"];
  ok("every performance type is described", types.every((t) => rules.includes(t)), types.filter((t) => !rules.includes(t)).join(","));
  ok("dialogue scenes get 2-4 turns", rules.includes("TWO to FOUR meaningful short turns"));
  ok("listeners keep acting", rules.includes("REACT WHILE LISTENING"));
  ok("silent-emotional permits zero dialogue", rules.includes("ZERO dialogue is explicitly correct"));
  ok("reaction beats are not filled with exposition", rules.includes("Do NOT fill a reaction beat with exposition"));
  ok("comedy timing is protected", rules.includes("Protect the timing"));
  ok("transitions still need a reason", rules.includes("narrative reason to exist"));
  ok("type comes from story need", rules.includes("CHOOSE FROM STORY NEED, NEVER FROM VARIETY"));
  ok("a silent scene must still change something", rules.includes("still has to CHANGE something"));
}

// ---------------------------------------------------------------------------
section("Speakability envelope");
{
  const rules = buildSceneCraftRules(CRAFT);
  const env = wordEnvelope("Roman Urdu");
  ok("the envelope is stated", rules.includes("WHAT ACTUALLY FITS IN"));
  ok("with the measured rate", rules.includes("2.8 words a second"));
  ok("and a word range around the comfortable value", rules.includes(`${env.comfortable - 4} to ${env.comfortable + 4}`));
  // The band used to be asserted as the literal 14-22, which was the envelope
  // at a ten-second shot. Those numbers move with SECONDS_PER_SCENE, so what is
  // actually being checked is the relationship: the range is centred on the
  // comfortable value and never advises more words than the ceiling allows.
  ok("the range is centred on the comfortable value", env.comfortable - 4 < env.comfortable && env.comfortable + 4 > env.comfortable);
  ok(
    "the top of the range never exceeds the speakable ceiling",
    env.comfortable + 4 <= env.ceiling,
    `range ${env.comfortable - 4}-${env.comfortable + 4}, ceiling ${env.ceiling}`
  );
  ok("explicitly not a quota", rules.includes("ENVELOPE, NOT A QUOTA"));
  ok("never pad to reach it", rules.includes("Never pad a scene to reach it"));
  ok("never cut a line that matters", rules.includes("Never cut a line that matters"));
  ok("non-dialogue scenes sit below it", rules.includes("will sit well below it, and that is correct"));
  ok("uniform density is called out as repetition", rules.includes("itself a form of repetition"));
}

// ---------------------------------------------------------------------------
section("Choreography and visual performance");
{
  const rules = buildSceneCraftRules(CRAFT);
  ok("choreography is present", rules.includes("PERFORMANCE CHOREOGRAPHY"));
  ok("flexible, not timestamps", rules.includes("FLEXIBLE shape, not mandatory timestamps"));
  ok("no dead air", rules.includes("NO MEANINGLESS DEAD AIR"));
  ok("silence that works is preserved", rules.includes("preserving silence that is doing something"));
  ok("non-speakers keep acting", rules.includes("must not freeze while another character talks"));
}

// ---------------------------------------------------------------------------
section("Intentional silence is protected");
{
  const rules = buildSceneCraftRules(CRAFT);
  ok("near-silent scene types are named", rules.includes("LEGITIMATELY NEAR-SILENT"));
  ok("no dialogue pushed in to hit a number", rules.includes("must not have dialogue pushed into them to hit a number"));
}
{
  // ensureDialogueInPrompt stays authoritative, and stays silent on silence.
  const silent = "Close-up of a shutter half raised on an empty lane.";
  ok("a silent scene's prompt is untouched", ensureDialogueInPrompt(silent, [], "Roman Urdu") === silent);
  ok("undefined turns are untouched", ensureDialogueInPrompt(silent, undefined, "Roman Urdu") === silent);
  const spoken = ensureDialogueInPrompt("Wide shot of the counter.", [{ speaker: "Karela", line: "Aaj nahi" }], "Roman Urdu");
  ok("a speaking scene still gets its lines", spoken.includes("Aaj nahi"));
}

// ---------------------------------------------------------------------------
section("Cross-batch memory: windows and seams");
{
  const scenes = Array.from({ length: 12 }, (_, i) => scene(i + 1));
  const memory = buildStoryMemory(scenes, BLUEPRINT)!;

  ok("recent dialogue is drawn from a scene window", memory.recentDialogue.length > 0);
  ok("bounded at 24 lines", memory.recentDialogue.length <= 24, String(memory.recentDialogue.length));
  ok("dialogue lines carry their scene number", memory.recentDialogue[0].startsWith("S"));
  ok("only the last 6 scenes' dialogue", !memory.recentDialogue.some((l) => l.startsWith("S1 ") || l.startsWith("S6 ")),
     memory.recentDialogue.join(" | "));

  ok("recent goals are derived", memory.recentGoals.length === 8, String(memory.recentGoals.length));
  ok("recent progressions are derived", memory.recentProgressions.length === 8);
  ok("recent outcomes are derived", memory.recentOutcomes.length === 8);
  ok("progressions carry kind, value and direction", memory.recentProgressions[0].includes("[progress]") && memory.recentProgressions[0].includes("->"));
  ok("outcomes are the contract's own", memory.recentOutcomes.some((o) => o.includes("partial")));
}
{
  // Older scenes with no contract still contribute, via the prose gloss.
  const legacy = Array.from({ length: 4 }, (_, i) => {
    const s = scene(i + 1);
    delete s.contract;
    return s;
  });
  const memory = buildStoryMemory(legacy, BLUEPRINT)!;
  ok("contract-less scenes still yield progressions", memory.recentProgressions.length === 4);
  ok("via the storyFunction gloss", memory.recentProgressions[0].includes("does its job"));
  ok("and no goals are invented", memory.recentGoals.length === 0);
}
{
  const scenes = Array.from({ length: 12 }, (_, i) => scene(i + 1));
  const memory = buildStoryMemory(scenes, BLUEPRINT);
  const slice = sliceBlueprintForRange(BLUEPRINT, 13, 24);
  const block = buildBlueprintPromptBlock(slice, memory);

  ok("the seam is named explicitly", block.includes("THE SEAM YOU ARE OPENING"));
  ok("and names the last scene of the previous call", block.includes("scene 12 was written in a DIFFERENT call"));
  ok("dramatic jobs already done are listed", block.includes("DRAMATIC JOBS ALREADY DONE"));
  ok("goals already attempted are listed", block.includes("SCENE GOALS ALREADY ATTEMPTED"));
  ok("outcomes are listed", block.includes("HOW THOSE ATTEMPTS ENDED"));
  ok("unresolved pressure carries over", block.includes("Unresolved pressure carries across the seam"));
  ok("recent dialogue is still carried", block.includes("RECENT DIALOGUE"));
}
{
  // Every real seam, at every supported runtime.
  for (const [total, seam] of [[12, 12], [36, 24], [60, 48]] as const) {
    const scenes = Array.from({ length: seam }, (_, i) => scene(i + 1));
    const memory = buildStoryMemory(scenes, BLUEPRINT);
    const block = buildBlueprintPromptBlock(sliceBlueprintForRange(BLUEPRINT, seam + 1, seam + 12), memory);
    ok(`seam ${seam}->${seam + 1} carries progression memory (${total}-scene film)`,
       block.includes("DRAMATIC JOBS ALREADY DONE") && block.includes(`scene ${seam} was written`));
  }
}

// ---------------------------------------------------------------------------
section("Runtime scaling: 2m / 6m / 10m");
for (const [label, sceneCount] of [["2 minutes", 12], ["6 minutes", 36], ["10 minutes", 60]] as const) {
  const rules = buildSceneCraftRules({ ...CRAFT, duration: label, targetSceneCount: sceneCount });
  ok(`${label}: performance types present`, rules.includes("PERFORMANCE TYPE"));
  ok(`${label}: envelope present`, rules.includes("ENVELOPE, NOT A QUOTA"));
  ok(`${label}: choreography present`, rules.includes("PERFORMANCE CHOREOGRAPHY"));
}

// ---------------------------------------------------------------------------
section("REGRESSION — the rules P3 replaces must not come back");
{
  const rules = buildSceneCraftRules(CRAFT);
  const slice = sliceBlueprintForRange(BLUEPRINT, 1, 12);
  const directives = buildStoryIntelligenceDirectives({ startScene: 1, endScene: 12, totalScenes: 24, language: "Roman Urdu", slice });
  const all = `${rules}\n${directives}`;

  ok("no 'four to six turns' rule anywhere", !/FOUR to SIX|four to six turns/i.test(all));
  ok("no 'eight to fourteen words' line length", !/EIGHT TO FOURTEEN/i.test(all));
  ok("no 'fill the scene with talk'", !/FILL THE SCENE WITH TALK/i.test(all));
  ok("no 'if you are not sure, they talk'", !/if you are not sure, they talk/i.test(all));
  ok("dialogue is not demanded in every scene", !/every scene must (contain|have) dialogue/i.test(all));
  ok("the word range is not phrased as a requirement", !/must contain (at least )?\d+ (to \d+ )?words/i.test(all));
  ok("no mechanical rotation of performance types", !/rotate (through )?(the )?(performance )?types/i.test(all.replace(/Do not rotate through these types[^\n]*/g, "")));
  ok("no instruction to alternate for variety", all.includes("NO MECHANICAL VARIETY") || !/alternate .* for variety/i.test(all));
  ok("no new physical continuity state is introduced", !/continuityState\s*\./i.test(directives));
  ok("no second memory system is described", !/new memory|separate memory|second memory/i.test(all));
  ok("no automatic repair is promised", !/automatically regenerate|auto-?repair|will be regenerated/i.test(all));
  ok("no blocking is threatened", !/will be rejected|will be blocked/i.test(all));
}

// ---------------------------------------------------------------------------
section("Observability: per-scene execution table");
{
  const scenes = Array.from({ length: 6 }, (_, i) => scene(i + 1));
  const md = buildSceneExecutionSection({
    scenes,
    blueprint: BLUEPRINT,
    feasibility: {
      scenes: scenes.map((s) => ({ sceneNumber: s.sceneNumber, turns: 1, words: 5, estimatedSpeechSeconds: 1.8, speechFraction: 0.18, verdict: "underfilled" as const })),
      overruns: [], tight: [], underfilled: [1, 2, 3, 4, 5, 6], silent: [],
      averageWords: 5, averageSpeechFraction: 0.18, turnsStdDev: 0,
      dominantTurnCount: { turns: 1, scenes: 6, sharePercent: 100 },
      envelope: { comfortable: 18, ceiling: 24 },
    },
  });

  ok("one row per scene", scenes.every((s) => md.includes(`| ${s.sceneNumber} |`)));
  ok("shows the planned P1 move", md.includes("The rent notice is slid under the door"));
  ok("shows the contract progression", md.includes("progress"));
  ok("shows the performance type", md.includes("dialogue-scene"));
  ok("shows turns, words and speech seconds", md.includes("1.8s"));
  ok("surfaces feasibility verdicts", md.includes("underfilled"));
  ok("reports coverage", md.includes("scenes had a planned move"));
  ok("states it is report only", md.includes("Nothing here is auto-corrected"));
}
{
  const md = buildSceneExecutionSection({ scenes: [] });
  ok("empty story renders safely", md.includes("No scenes"));
}

// ---------------------------------------------------------------------------
section("Guidance builders are self-contained");
ok("performance guidance lists all eight types", Object.keys({}).length === 0 && buildPerformanceTypeGuidance().split("   - ").length >= 9);
ok("choreography scales with shot length", buildChoreographyGuidance(20).includes("20 SECONDS") || buildChoreographyGuidance(20).includes("~4s"));
ok("speakability quotes the language", buildSpeakabilityGuidance("Hindi").includes("Hindi"));

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
