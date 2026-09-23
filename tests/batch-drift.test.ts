import {
  applyFrameBookends,
  buildStyleLock,
  stripStylePreamble,
  SHOT_DECLARATION,
} from "../src/server/story/seam.js";
import { buildBeatClock, renderBeatClock } from "../src/server/story/beat-clock.js";
import { buildLedger, buildLedgerBlock } from "../src/server/story/continuity-director.js";

/**
 * BATCH DRIFT regression suite.
 *
 * Every test here is anchored to a defect found by reading a real 36-scene
 * generation (test-output/2026-09-22, "Teen Rotiyaan"), not to an imagined
 * failure. Each one is a thing that WAS in a shipped film:
 *
 *   1. the style sentence changed at both 12-scene batch boundaries, so Veo was
 *      told to render three different-looking films joined at 2:00 and 4:00
 *   2. a beat clock attributed the mother's action to her son
 *   3. no batch could see how long the film had already sat in one room
 *
 * No API calls.
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

// ---------------------------------------------------------------------------
console.log("\nstripStylePreamble - the three wordings one real film produced");
// ---------------------------------------------------------------------------

// Batch 1 (scenes 1-12): style fused into the sentence that carries the cast.
// Cutting the whole sentence here would delete the character description, so
// the cut has to land on the connective instead.
const b1 = stripStylePreamble(
  "Stylized 3D cartoon animation of an anthropomorphic deep-purple Baigan mother wearing a faded mustard dupatta, crouched beside an earthen mud hearth."
);
ok("batch-1 'animation of X' keeps the character", /anthropomorphic deep-purple Baigan mother/.test(b1), b1.slice(0, 70));
ok("batch-1 drops the style words", !/Stylized 3D cartoon animation/i.test(b1), b1.slice(0, 70));
ok("batch-1 recapitalises the remainder", /^An anthropomorphic/.test(b1), b1.slice(0, 30));

// Standalone form. The " of " sixty characters later must NOT be the cut point:
// the sentence end comes first and wins.
const b1b = stripStylePreamble(
  "Stylized 3D cartoon animation. Close-up on the purple hands of an anthropomorphic Baigan mother."
);
ok(
  "batch-1 standalone cuts at the period, not the later 'of'",
  b1b === "Close-up on the purple hands of an anthropomorphic Baigan mother.",
  b1b
);

// Batch 2 (scenes 13-24).
const b2 = stripStylePreamble(
  "Children's 3D cartoon animation style with rich warm textures. In a freezing village alley threshold, an elder pauses."
);
ok("batch-2 wording is stripped", b2 === "In a freezing village alley threshold, an elder pauses.", b2);

// Batch 3 (scenes 25-36).
const b3 = stripStylePreamble("Stylized cartoon 3D animation. Inside the humble mud living room, a mother kneels.");
ok("batch-3 wording is stripped", b3 === "Inside the humble mud living room, a mother kneels.", b3);

// A setting that rides on the connective must survive the cut.
const b4 = stripStylePreamble("Stylized 3D cartoon animation of a warm, humble kitchen corner. An eggplant mother kneels.");
ok("a setting carried by 'of' is kept", /warm, humble kitchen corner/.test(b4), b4);

// A body that never had a preamble must come through untouched.
const clean = "An anthropomorphic slender green Bhindi boy sprints through a misty alley.";
ok("a prompt with no style preamble is untouched", stripStylePreamble(clean) === clean);

// A style word deep in the action is content, not a preamble.
const late = "Tipu runs past a painted sign advertising a 3D cartoon show at the village hall.";
ok("a style word deep in the body is not a preamble", stripStylePreamble(late) === late, stripStylePreamble(late));

// ---------------------------------------------------------------------------
console.log("\nbuildStyleLock - byte-identical per film, different across films");
// ---------------------------------------------------------------------------

ok("the same style always renders the same sentence", buildStyleLock("Cartoon") === buildStyleLock("Cartoon"));
ok("two styles render differently", buildStyleLock("Cartoon") !== buildStyleLock("Watercolor"));
ok("an empty style still produces a lock", buildStyleLock("").length > 0);
ok("the style name is carried", /Watercolor/.test(buildStyleLock("Watercolor")));
ok(
  "the lock names no technique of its own",
  !/\b(?:3D|2D|cel|claymation)\b/i.test(buildStyleLock("Watercolor")),
  buildStyleLock("Watercolor")
);

// ---------------------------------------------------------------------------
console.log("\napplyFrameBookends - one style statement, in one place");
// ---------------------------------------------------------------------------

const style = buildStyleLock("Cartoon");
const assembled = applyFrameBookends(
  "Stylized 3D cartoon animation. Ammi kneels at the hearth and blows into the coals.",
  { opening: "Ammi crouches at frame left", closing: "Ammi lowers the blowpipe", style }
);

ok("the style lock is present", assembled.includes(style));
ok("it follows the shot declaration", assembled.indexOf(SHOT_DECLARATION) < assembled.indexOf(style));
ok("it precedes the opening frame", assembled.indexOf(style) < assembled.indexOf("Ammi crouches at frame left"));
ok("the model's own style wording is gone", !/Stylized 3D cartoon animation/i.test(assembled), assembled.slice(0, 200));
ok(
  "only one style statement survives",
  (assembled.match(/Visual style, identical in every shot/g) || []).length === 1
);
ok("the body is kept", /blows into the coals/.test(assembled));
ok(
  "omitting the style changes nothing else",
  !/Visual style/.test(applyFrameBookends("Ammi kneels.", { opening: "a", closing: "b" }))
);

// The whole point: two batches that worded the style differently must now
// assemble into the same prompt.
const fromBatchOne = applyFrameBookends("Stylized 3D cartoon animation. Tipu runs down the lane.", {
  opening: "x",
  closing: "y",
  style,
});
const fromBatchThree = applyFrameBookends("Stylized cartoon 3D animation. Tipu runs down the lane.", {
  opening: "x",
  closing: "y",
  style,
});
ok("two batch wordings converge on the same prompt", fromBatchOne === fromBatchThree);

// ---------------------------------------------------------------------------
console.log("\nbeat clock - the action follows the character who last acted");
// ---------------------------------------------------------------------------

// Scene 20 of the real film, verbatim. The clock rendered "Tipu lifts her head
// with a practiced, radiant smile of comfort" - the boy lifting his mother's
// head - because the subject carried forward was the FIRST name in the beat
// rather than the last character to act in it.
const scene20 = {
  sceneNumber: 20,
  charactersPresent: ["Tipu", "Ammi", "Chunnu", "Meenu"],
  characterActions:
    "Tipu points a trembling green finger directly at the bare jute mat in front of Ammi; Ammi startles, then lifts her head with a practiced, radiant smile of comfort.",
  dialogueTurns: [
    { speaker: "Tipu", line: "Ammi... aapki thaali kahan hai?", accompanyingAction: "Points at the bare mat." },
    {
      speaker: "Ammi",
      line: "Mera laal... main to pehle hi kha chuki hoon.",
      accompanyingAction: "Folds her hands over her chest.",
    },
  ],
};
const clock20 = renderBeatClock(buildBeatClock(scene20, "Roman Urdu"));
ok("the handed-over action is attributed to Ammi", /Ammi lifts her head/.test(clock20), clock20.slice(0, 220));
ok("it is no longer attributed to Tipu", !/Tipu lifts her head/.test(clock20));

// A subordinate clause must NOT hand the subject over: in "Ammi blows ... while
// Meenu huddles", the actor the next beat continues is still Ammi.
const subordinate = {
  sceneNumber: 1,
  charactersPresent: ["Ammi", "Meenu"],
  characterActions:
    "Ammi crouches by the mud hearth blowing into gray embers, while Meenu huddles beside her clutching a salt pot. Then reaches out a flour-dusted finger to brush a cheek.",
  dialogueTurns: [],
};
const clockSub = renderBeatClock(buildBeatClock(subordinate, "Roman Urdu"));
ok(
  "a 'while' clause does not steal the subject",
  !/Meenu reaches out a flour-dusted finger/.test(clockSub),
  clockSub.slice(0, 280)
);

// A single-actor scene must be completely unaffected by the change.
const solo = {
  sceneNumber: 5,
  charactersPresent: ["Tipu"],
  characterActions: "Tipu pulls the dented tin canister from the shelf, then runs his fingers across the bare bottom.",
  dialogueTurns: [],
};
const clockSolo = renderBeatClock(buildBeatClock(solo, "Roman Urdu"));
ok("a one-character scene still reads correctly", /Tipu runs his fingers/.test(clockSolo), clockSolo.slice(0, 220));

// ---------------------------------------------------------------------------
console.log("\nplace run - the ledger reports how long the film has stood still");
// ---------------------------------------------------------------------------

const stuck = [
  ...Array(6).fill("Kitchen corner of the mud cottage"),
  "Cottage entrance vestibule",
  "Village alley at night",
  ...Array(5).fill("Interior of the grain mill"),
  "Village alley at night",
  ...Array(22).fill("Living room dastarkhwan of the cottage"),
].map((location, i) => ({ sceneNumber: i + 1, continuityState: { location } }));

const stuckBlock = buildLedgerBlock(buildLedger(stuck));
ok(
  "the real film's 22-scene run is reported",
  /PLACE RUN: the film has now played 22 consecutive scenes/.test(stuckBlock),
  stuckBlock.slice(-320)
);
ok("the share is reported", /61% of everything shot so far/.test(stuckBlock));
ok("it is stated as a fact, not an order", /This is a FACT, not an instruction/.test(stuckBlock));

const moving = ["hut", "path", "river", "market", "hut", "hill", "river", "market"].map((location, i) => ({
  sceneNumber: i + 1,
  continuityState: { location },
}));
ok("a story that moves is not nagged", !/PLACE RUN/.test(buildLedgerBlock(buildLedger(moving))));

// Rewording the same room must not restart the count - the reason the run is
// measured on normalised content words rather than on the literal string.
const reworded = [
  "The living room of the cottage",
  "Cottage living room",
  "Living room, cottage",
  "the low-ceilinged living room of the cottage",
  "Living room of the cottage",
].map((location, i) => ({ sceneNumber: i + 1, continuityState: { location } }));
ok(
  "a reworded place name does not restart the run",
  /PLACE RUN: the film has now played 5 consecutive scenes/.test(buildLedgerBlock(buildLedger(reworded))),
  buildLedgerBlock(buildLedger(reworded)).slice(-240)
);

// A short stay must stay silent.
const brief = ["mill", "mill", "mill", "alley"].map((location, i) => ({
  sceneNumber: i + 1,
  continuityState: { location },
}));
ok("a three-scene stay is not reported", !/PLACE RUN/.test(buildLedgerBlock(buildLedger(brief))));

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
