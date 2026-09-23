import {
  buildSeamText,
  normaliseFrameText,
  stripFrameStatements,
  applyFrameBookends,
  buildSceneFrames,
  SHOT_DECLARATION,
  OPENING_LEAD,
  CLOSING_LEAD,
} from "../src/server/story/seam.js";
import { makeSelfContained } from "../src/server/story/prompt-continuity.js";

/**
 * Phase A regression suite — Seam Identity.
 *
 * No API calls. Every test builds prompt text and asserts what it does and does
 * not say.
 *
 * The suite is weighted toward the two ways this change could do damage:
 * deleting a character bible while stripping a frame statement, and letting the
 * old duplicate-prefix behaviour creep back. Both are asserted directly.
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

const BIBLE =
  "CHARACTER: Beeju: a tiny round tear-shaped mustard seed, soft golden coat glowing cream in the light, " +
  "oversized deep amber eyes with four-pointed white star highlights, a big round open mouth with thin lips, " +
  "two thin dark-brown root-legs, and an old frayed mustard-yellow thread around his waist whose loose end " +
  "drifts in the air, the only thing he wears.";

console.log("\nnormaliseFrameText — clip-relative time and forward references");

ok(
  "strips a leading 'At 10.0s'",
  normaliseFrameText("At 10.0s Beeju stands on the shelf") === "Beeju stands on the shelf"
);
ok(
  "strips 'At 10.0s mark:'",
  normaliseFrameText("At 10.0s mark: Beeju stands on the shelf") === "Beeju stands on the shelf"
);
ok(
  "strips a non-ten duration, so other scene lengths clean too",
  normaliseFrameText("At 6.5 seconds Beeju stands still") === "Beeju stands still"
);
ok(
  "strips a trailing scene-handoff sentence",
  normaliseFrameText("Beeju stands on the shelf. Characters hold finishing posture for Scene 12 handoff.") ===
    "Beeju stands on the shelf"
);
ok(
  "strips 'Scene N must inherit'",
  !/Scene\s*13/.test(normaliseFrameText("Motu lies in the soil. Scene 13 must inherit character positions."))
);
ok(
  "leaves a clean present-tense frame untouched",
  normaliseFrameText("Motu lies half-covered in the soil, mouth open on an unfinished word") ===
    "Motu lies half-covered in the soil, mouth open on an unfinished word"
);
ok("empty input yields empty output", normaliseFrameText("") === "" && normaliseFrameText(null) === "");
ok(
  "no scene number survives into a seam",
  !/Scene\s*\d/.test(normaliseFrameText("Beeju waits. Ready for the next scene."))
);

console.log("\nbuildSeamText — source preference and fallback");

ok(
  "prefers a usable endState",
  buildSeamText({ endState: "At 10.0s Beeju grips the pot rim, leaning in, both hands flat on the terracotta" }) ===
    "Beeju grips the pot rim, leaning in, both hands flat on the terracotta"
);
ok(
  "falls back to continuityState when endState is missing",
  buildSeamText({
    continuityState: {
      characterPositions: "Beeju at frame left, Ankuri at frame right",
      heldProps: "Beeju holds a single wet leaf",
      lighting: "low amber lamplight from the window",
    },
  }).includes("Beeju holds a single wet leaf")
);
ok(
  "falls back to continuityState when endState is too thin to be a frame",
  buildSeamText({
    endState: "Done.",
    continuityState: { characterPositions: "Beeju stands alone at frame centre, arms at his sides, head down" },
  }).includes("frame centre")
);
ok(
  "ignores placeholder continuity values",
  !buildSeamText({
    continuityState: { heldProps: "none", characterPositions: "Beeju at frame left, both hands open at his sides" },
  }).toLowerCase().includes("none")
);

console.log("\nstripFrameStatements — never deletes a character bible");

const withBible = `First frame: a tiny mustard seed stands on a wet step. ${BIBLE} Action: he runs.`;
const stripped = stripFrameStatements(withBible);
ok("bible survives stripping", stripped.includes("four-pointed white star highlights"));
ok("bible survives in full", stripped.includes("the only thing he wears"));
ok("the frame label itself is gone", !/First frame\s*[,:]/i.test(stripped));

const longFrame = "Opening frame: " + "a very long description of the room ".repeat(30) + ". Cute 3D Pixar-style animation.";
ok(
  "an over-long frame block keeps its content and loses only the label",
  stripFrameStatements(longFrame).includes("a very long description of the room") &&
    !/Opening frame\s*[,:]/i.test(stripFrameStatements(longFrame))
);

const shortFrame = "Opening frame: Beeju stands at frame left. Cute 3D Pixar-style animation. He runs right.";
const shortStripped = stripFrameStatements(shortFrame);
ok("a short frame statement is removed whole", !shortStripped.includes("Beeju stands at frame left"));
ok("the body after it survives", shortStripped.includes("Cute 3D Pixar-style animation"));

const multi =
  "Opening frame: At 10.0s Beeju stands upright on the paper lip, arms flung wide. " +
  "Behind him Motu's silhouette is rising into view. The camera has drifted a step right. " +
  "Cute 3D Pixar-style animation. Beeju leaps.";
const multiStripped = stripFrameStatements(multi);
ok("a multi-sentence frame block is fully removed", !multiStripped.includes("Motu's silhouette is rising"));
ok("stripping stops at the body marker", multiStripped.includes("Cute 3D Pixar-style animation"));
ok("and keeps the action", multiStripped.includes("Beeju leaps"));

ok(
  "a trailing closing frame is removed",
  !stripFrameStatements("He runs right. Final frame: Beeju mid-stride against the wall.").includes("mid-stride")
);
ok("a prompt with no frame statement is unchanged in substance",
  stripFrameStatements("Cute 3D animation. Beeju runs. Foley: rain.").includes("Beeju runs"));

console.log("\napplyFrameBookends — placement and symmetry");

const body = "Cute 3D Pixar-style animation. Beeju runs along the ledge. Foley: rain on glass.";
const rendered = applyFrameBookends(body, { opening: "Beeju crouches at frame left", closing: "Beeju stands at frame right" });
ok("declares a single continuous shot before anything else", rendered.startsWith(SHOT_DECLARATION));
ok("then opens on the opening frame", rendered.includes(`${OPENING_LEAD}Beeju crouches at frame left.`));
ok("ends on the closing frame", rendered.endsWith(`${CLOSING_LEAD}Beeju stands at frame right.`));
ok("keeps the body between them", rendered.includes("Beeju runs along the ledge"));
ok("exactly two frame lead-ins", (rendered.match(/The shot (?:opens|ends) on:/gi) || []).length === 2);
// The old "Opening frame:" / "Closing frame:" labels read as form fields in a
// spec sheet, which is part of what was being rendered as a comic page.
ok("the old form-field labels are gone", !/(?:Opening|Closing)\s+frame:/i.test(rendered));

const first = applyFrameBookends(body, { opening: "", closing: "Beeju stands at frame right" });
ok("a missing opening frame emits no empty lead-in", !/The shot opens on:/i.test(first));
ok("the closing frame still lands", first.endsWith(`${CLOSING_LEAD}Beeju stands at frame right.`));

console.log("\nbuildSceneFrames — the join is one shared text");

const sceneA = { endState: "At 10.0s Beeju grips the pot rim, leaning in" };
const sceneB = { startState: "Beeju grips the pot rim", endState: "At 10.0s Beeju turns his head back along the shelf" };

const framesA = buildSceneFrames(sceneA, null);
const framesB = buildSceneFrames(sceneB, sceneA);
ok(
  "scene N's closing frame IS scene N+1's opening frame",
  framesA.closing === framesB.opening && framesA.closing.length > 0,
  `${framesA.closing} :: ${framesB.opening}`
);
ok("scene 1 opens from its own startState", buildSceneFrames(sceneB, null).opening === "Beeju grips the pot rim");
ok("no timestamp survives into either frame", !/\d+\.?\d*\s*s\b/i.test(framesB.opening + framesB.closing));

console.log("\nmakeSelfContained — the duplicate-prefix behaviour must not come back");

const selfContained = makeSelfContained("CONTINUE DIRECTLY FROM PREVIOUS SHOT [Scene 4]: Beeju runs right.");
ok("cross-scene references are still stripped", !/previous shot/i.test(selfContained));
ok("the surviving text is the description", selfContained === "Beeju runs right.");
ok(
  "it no longer prepends an opening frame",
  !/Opening frame:/i.test(makeSelfContained("Beeju runs right."))
);
ok(
  "a trailing negative block is still removed",
  !/avoid/i.test(makeSelfContained("Beeju runs right. Avoid: extra limbs, blur."))
);
ok("it takes one argument now", makeSelfContained.length === 1);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
