import {
  validateContinuity,
  screenAxis,
  screenDirectionConflicts,
  isEmptyHanded,
  isSelectiveFraming,
  crossesIntoNewDay,
} from "../src/server/story/continuity-director.js";
import { measureActionDensity, buildActionDensityReport } from "../src/server/story/action-density.js";
import { buildSceneContractReport } from "../src/server/story/scene-contract.js";
import { buildQualityGateReport } from "../src/server/story/quality-gate.js";
import { buildStoryQualityReport } from "../src/server/story/blueprint.js";

/**
 * VALIDATOR PRECISION regression suite.
 *
 * Every fixture here is taken from a REAL false positive observed in
 * `2026-09-19T09-10-14-193Z__complete__chhota-beej-bada-sapna.md`, the first
 * fully instrumented generation. That story produced 25 continuity warnings of
 * which at least 15 were demonstrably false, and a BLOCK built entirely on
 * four prose-comparison artifacts.
 *
 * The suite has two halves and both matter equally:
 *   - the false positives must be GONE
 *   - the genuine findings must still FIRE
 *
 * A precision pass that silences real problems is worse than the noise it
 * replaced, so every fix below is paired with a still-fires assertion.
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

/** Two scenes joined by CHAIN, with whatever state the test needs. */
function chainPair(prevState: any, currState: any, extra: any = {}): any[] {
  return [
    {
      sceneNumber: 1,
      transitionType: "CUT",
      charactersPresent: extra.prevChars ?? ["Beeju"],
      characterActions: "Beeju stands on the shelf board",
      continuityState: prevState,
    },
    {
      sceneNumber: 2,
      transitionType: "CHAIN",
      charactersPresent: extra.currChars ?? ["Beeju"],
      characterActions: "Beeju stays on the shelf board",
      continuityState: currState,
      ...extra.currScene,
    },
  ];
}

const issuesOf = (scenes: any[]) => {
  validateContinuity(scenes);
  return (scenes[1].continuityIssues ?? []) as any[];
};
const hasIssue = (scenes: any[], fragment: string) =>
  issuesOf(scenes).some((i) => i.title.toLowerCase().includes(fragment.toLowerCase()));

// ---------------------------------------------------------------------------
section("1. Screen direction — semantic, not prose");

ok("left-to-right is an axis", screenAxis("left-to-right along the shelf") === "left-to-right");
ok("added detail keeps the axis", screenAxis("left-to-right along the shelf toward the pot") === "left-to-right");
ok("facing right reads as left-to-right", screenAxis("Beeju faces right toward the work table") === "left-to-right");
ok("facing left reads as right-to-left", screenAxis("she turns toward frame left") === "right-to-left");
ok("a layout naming BOTH sides is not a direction", screenAxis("Beeju inside at frame left and Ankuri outside at frame right") === null);
ok("prose with no direction yields null", screenAxis("settled side-on and stopped") === null);

ok(
  "the real S2->S3 pair does not conflict",
  !screenDirectionConflicts("left-to-right along the shelf", "left-to-right along the shelf toward the pot")
);
ok(
  "the real S9->S10 pair does not conflict",
  !screenDirectionConflicts("Beeju faces along the shelf toward frame right", "Beeju faces right toward the work table")
);
ok(
  "the real S21->S22 pair (repunctuated) does not conflict",
  !screenDirectionConflicts(
    "the pane divides the frame vertically with Beeju inside at frame left and Ankuri outside at frame right",
    "the pane divides the frame vertically, Beeju inside at frame left, Ankuri outside at frame right"
  )
);
ok("a GENUINE reversal still conflicts", screenDirectionConflicts("left-to-right across the yard", "right-to-left across the yard"));
ok("toward vs away from camera conflicts", screenDirectionConflicts("moving toward the camera", "moving away from the camera"));

{
  const cam = (dir: string) => ({ shotSize: "medium", movement: "static", screenDirection: dir });
  const clean = chainPair(
    { placeId: "p", location: "shelf", cameraState: cam("left-to-right along the shelf") },
    { placeId: "p", location: "shelf", cameraState: cam("left-to-right along the shelf toward the pot") }
  );
  ok("reworded direction raises nothing", !hasIssue(clean, "screen direction"));

  const reversed = chainPair(
    { placeId: "p", location: "shelf", cameraState: cam("left-to-right across the yard") },
    { placeId: "p", location: "shelf", cameraState: cam("right-to-left across the yard") }
  );
  ok("a real reversal is still reported", hasIssue(reversed, "screen direction"));
}

// ---------------------------------------------------------------------------
section("2. Location — placeId is the identity");
{
  const same = chainPair(
    { placeId: "place_shelf", location: "the shelf, under the neem tree" },
    { placeId: "place_shelf", location: "the shelf, at the bracket end" }
  );
  ok("same placeId, reworded location raises nothing", !hasIssue(same, "location changes"));

  const moved = chainPair(
    { placeId: "place_shelf", location: "the shelf" },
    { placeId: "place_yard", location: "the yard" }
  );
  ok("a genuine place change is still reported", hasIssue(moved, "location changes"));

  const noIds = chainPair({ location: "the shelf" }, { location: "the yard" });
  ok("without placeIds the prose check still applies", hasIssue(noIds, "location changes"));
}

// ---------------------------------------------------------------------------
section("3. Held props — an empty hand is not an object");

ok('"nothing" is empty', isEmptyHanded("nothing"));
ok('"nothing in his hands" is empty', isEmptyHanded("nothing in his hands"));
ok('"hands open at his sides" is empty', isEmptyHanded("hands open at his sides"));
ok('"hands empty" is empty', isEmptyHanded("hands empty"));
ok('"empty-handed" is empty', isEmptyHanded("empty-handed"));
ok('"-" is empty', isEmptyHanded("-"));
ok("an actual prop is not empty", !isEmptyHanded("the mustard packet in both hands"));
ok('"nothing" inside a real prop name is not empty', !isEmptyHanded("a note saying nothing much"));

{
  const empties = chainPair(
    { placeId: "p", location: "shelf", heldProps: { Beeju: "nothing in his hands" } },
    { placeId: "p", location: "shelf", heldProps: { Beeju: "nothing, hands open at his sides" } }
  );
  ok("an empty hand cannot disappear", !hasIssue(empties, "held object disappears"));

  const vanished = chainPair(
    { placeId: "p", location: "shelf", heldProps: { Beeju: "the mustard packet" } },
    { placeId: "p", location: "shelf", heldProps: {} }
  );
  ok("a real prop vanishing is still reported", hasIssue(vanished, "held object disappears"));
}

// ---------------------------------------------------------------------------
section("4. Reframe — selective framing explains absence");

ok("a two-shot is selective", isSelectiveFraming("medium two-shot"));
ok("over-the-shoulder is selective", isSelectiveFraming("over-the-shoulder medium"));
ok("an insert is selective", isSelectiveFraming("insert"));
ok("a plain medium is not selective", !isSelectiveFraming("medium"));
ok("a wide is not selective", !isSelectiveFraming("wide"));

{
  const reframed = chainPair(
    { placeId: "p", location: "shelf", cameraState: { shotSize: "medium", movement: "static", screenDirection: "left-to-right" } },
    { placeId: "p", location: "shelf", cameraState: { shotSize: "medium two-shot", movement: "static", screenDirection: "left-to-right" } },
    { prevChars: ["Beeju", "Motu", "Teeli"], currChars: ["Beeju", "Ankuri"] }
  );
  ok("a two-shot does not make the others vanish", !hasIssue(reframed, "leaves without an exit"));

  const vanished = chainPair(
    { placeId: "p", location: "shelf", cameraState: { shotSize: "wide", movement: "static", screenDirection: "left-to-right" } },
    { placeId: "p", location: "shelf", cameraState: { shotSize: "wide", movement: "static", screenDirection: "left-to-right" } },
    { prevChars: ["Beeju", "Motu"], currChars: ["Beeju"] }
  );
  ok("an unexplained disappearance in the same wide shot is still reported", hasIssue(vanished, "leaves without an exit"));
}

// ---------------------------------------------------------------------------
section("5. Time — an overnight wrap is forward");

ok(
  "night -> dawn is a new day",
  crossesIntoNewDay({ continuityState: { timeOfDay: "night" } }, { continuityState: { timeOfDay: "dawn" } })
);
ok(
  "evening -> early morning is a new day",
  crossesIntoNewDay({ continuityState: { timeOfDay: "late evening" } }, { continuityState: { timeOfDay: "first light" } })
);
ok(
  "morning -> dawn on the SAME day is not",
  !crossesIntoNewDay({ continuityState: { timeOfDay: "late morning" } }, { continuityState: { timeOfDay: "dawn" } })
);
ok(
  "a real dayIndex is preferred when present",
  crossesIntoNewDay(
    { storyTime: { dayIndex: 0 }, continuityState: { timeOfDay: "noon" } },
    { storyTime: { dayIndex: 1 }, continuityState: { timeOfDay: "dawn" } }
  )
);
ok(
  "and a same-day index blocks the excuse",
  !crossesIntoNewDay(
    { storyTime: { dayIndex: 2 }, continuityState: { timeOfDay: "night" } },
    { storyTime: { dayIndex: 2 }, continuityState: { timeOfDay: "dawn" } }
  )
);

{
  const overnight = chainPair(
    { placeId: "p", location: "field", timeOfDay: "night" },
    { placeId: "p", location: "field", timeOfDay: "dawn" }
  );
  ok("night -> dawn raises no time warning", !hasIssue(overnight, "time of day moves backwards"));

  const backwards = chainPair(
    { placeId: "p", location: "field", timeOfDay: "late afternoon" },
    { placeId: "p", location: "field", timeOfDay: "late morning" }
  );
  ok("genuine backwards time is still reported", hasIssue(backwards, "time of day moves backwards"));
}

// ---------------------------------------------------------------------------
section("6. Action density — closed English vocabulary gaps");
{
  const realLines: Array<[number, string, string]> = [
    [7, "Roopa leans against the inside of the glass jar and calls Beeju over from across the room, holding her paper fan up like a parasol.", "dialogue-scene"],
    [17, "A rack of the camera travels from the stripped counter across the room to Beeju on the shelf, following his shout, and comes to rest on him as the crate lid goes down behind him.", "montage-element"],
    [20, "Beeju sprints along the bare shelf board from frame left, skids to a stop at the board's end above the work table, and stares down at the wiped, still-damp tabletop.", "transition"],
    [22, "Beeju asks through the glass without moving at all, and Ankuri raises her new leaf straight up in front of her face before answering without any question in her voice.", "dialogue-scene"],
    [33, "Kadoo Bi tips the seeded tray out into the border row, presses the whole line flat with both palms and counts it down to eight.", "action"],
  ];
  for (const [n, text, type] of realLines) {
    const m = measureActionDensity({ sceneNumber: n, characterActions: text, contract: { performanceType: type } });
    ok(`S${n} is now classified`, m.confident, "was unclassified before the vocabulary fix");
  }
}

// ---------------------------------------------------------------------------
section("7. Unclassified reasons are honest");
{
  const short = measureActionDensity({ sceneNumber: 1, characterActions: "Golu sits." });
  ok("a short line reports insufficient evidence", short.reason === "insufficient-evidence", String(short.reason));

  const foreign = measureActionDensity({
    sceneNumber: 2,
    characterActions: "Le personnage traverse la cour et ouvre la porte lentement avant de sortir.",
  });
  ok("a genuinely unknown language says so", foreign.reason === "unsupported-language", String(foreign.reason));
  ok("and is not classified", foreign.confident === false);

  const englishUnknown = measureActionDensity({
    sceneNumber: 3,
    characterActions: "The apparatus oscillates within the chamber and the indicator fluctuates across the dial repeatedly.",
  });
  ok(
    "unparsed English is phrasing, NOT language",
    englishUnknown.reason === "unrecognised-phrasing",
    String(englishUnknown.reason)
  );

  const report = buildActionDensityReport([
    { sceneNumber: 1, characterActions: "Golu sits." },
    { sceneNumber: 2, characterActions: "Le personnage traverse la cour et ouvre la porte lentement avant de sortir." },
  ]);
  ok("the report groups unclassified scenes by reason", Object.keys(report.unclassifiedByReason).length === 2);
}

// ---------------------------------------------------------------------------
section("8. Relocation — one traverse is one relocation");
{
  // The real S25: a single continuous crawl with three waypoint phrases.
  const traverse = measureActionDensity({
    sceneNumber: 25,
    characterActions:
      "Beeju rolls onto his front and crosses the dark floor to the back door, passing directly beneath the shut tin with his head down, and squeezes under the propped door onto the wet step outside.",
    contract: { performanceType: "transition" },
  });
  ok("a continuous traverse counts as one relocation", traverse.relocations <= 1, String(traverse.relocations));
  ok("and is not reported as overloaded", !traverse.overloaded);

  // The real S35: five separate actions. Must still fire.
  const genuine = measureActionDensity({
    sceneNumber: 35,
    characterActions:
      "Kadoo Bi pulls the back door shut, turns the key, climbs onto the loaded cart, looks back once at the field, and drives the cart away from the gate.",
    contract: { performanceType: "establishing" },
  });
  ok("genuine multi-action staging is still overloaded", genuine.overloaded);

  // Noun/verb ambiguity, the root cause of the phantom relocations.
  const nounUse = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Beeju lowers himself with his head down onto the wet step and lies still on the thin soil.",
    contract: { performanceType: "silent-emotional" },
  });
  ok('"his head down" and "the wet step" are nouns, not travel', nounUse.relocations === 0, String(nounUse.relocations));
}

// ---------------------------------------------------------------------------
section("9. Contract calibration");
{
  // A. The tracked VALUE is who holds something - the verb is the state.
  const heldPosition = buildSceneContractReport({
    scenes: [
      {
        sceneNumber: 2,
        characterActions: "Motu surges up through the packet's open corner and shoulders Beeju off the paper lip",
        contract: {
          goal: "Beeju wants to keep the top spot on the packet lip",
          obstacle: "Motu is twice his size",
          outcome: "denied",
          performanceType: "dialogue-scene",
          progression: {
            kind: "relationship",
            value: "who holds the packet's top spot",
            before: "Beeju holds it, standing in the light",
            after: "Motu holds it by size alone, and Beeju is back on the bare board",
          },
        },
      },
    ],
    characters: [{ name: "Beeju" }, { name: "Motu" }],
  });
  ok(
    "a state expressed with a verb is not activity",
    !heldPosition.issues.some((i) => i.code === "activity-as-progression"),
    heldPosition.issues.map((i) => i.code).join(",")
  );

  // Genuine activity must still be caught.
  const realActivity = buildSceneContractReport({
    scenes: [
      {
        sceneNumber: 1,
        characterActions: "Golu walks across the yard and picks up the rope",
        contract: {
          goal: "Golu wants the rope",
          obstacle: "it is across the yard",
          outcome: "achieved",
          performanceType: "action",
          progression: { kind: "progress", value: "the rope", before: "Golu enters the room", after: "Golu talks to Mooli" },
        },
      },
    ],
    characters: [{ name: "Golu" }, { name: "Mooli" }],
  });
  ok("two actions are still caught as activity", realActivity.issues.some((i) => i.code === "activity-as-progression"));
}
{
  // B. obstacle + achieved is NOT a contradiction.
  const scenes = [
    {
      sceneNumber: 26,
      characterActions: "Beeju is knocked off his feet by the gutter water, stands up and finds the brick wall",
      dialogueTurns: [{ speaker: "Beeju", line: "Beeju ko deewar mil gayi" }],
      contract: {
        goal: "Beeju wants to reach the wall",
        obstacle: "the flooded slab takes his feet out from under him",
        outcome: "achieved",
        performanceType: "action",
        progression: { kind: "obstacle", value: "Beeju's line to the field", before: "clear and straight ahead", after: "wiped out by the flood and rebuilt by reading shapes in the dark" },
      },
    },
  ];
  const gate = buildQualityGateReport({ scenes, contracts: buildSceneContractReport({ scenes }) });
  ok(
    "obstacle + achieved is no longer a contradiction",
    !gate.findings.some((f) => f.code === "outcome-contradicts-progression"),
    gate.findings.map((f) => f.code).join(",")
  );

  const contradictory = [
    {
      sceneNumber: 1,
      characterActions: "Golu counts the coins and stops",
      contract: {
        goal: "pay the fee",
        obstacle: "the tin is light",
        outcome: "achieved",
        performanceType: "reaction",
        progression: { kind: "setback", value: "the fee", before: "believed covered", after: "short by a week's work" },
      },
    },
  ];
  const gate2 = buildQualityGateReport({ scenes: contradictory, contracts: buildSceneContractReport({ scenes: contradictory }) });
  ok("setback + achieved is still a contradiction", gate2.findings.some((f) => f.code === "outcome-contradicts-progression"));
}

// ---------------------------------------------------------------------------
section("11. Thin dialogue is performance-type aware");
{
  const scene = (n: number, turns: number, type: string) => ({
    sceneNumber: n,
    storyFunction: `scene ${n} does something distinct and specific here`,
    characterActions: `Beeju does a distinct thing in scene ${n}`,
    charactersPresent: ["Beeju"],
    dialogueTurns: Array.from({ length: turns }, (_, i) => ({ speaker: "Beeju", line: `line ${n}-${i}` })),
    contract: { performanceType: type },
  });

  const report = buildStoryQualityReport(
    [
      scene(1, 1, "silent-emotional"),
      scene(2, 1, "reaction"),
      scene(3, 1, "establishing"),
      scene(4, 1, "transition"),
      scene(5, 1, "action"),
      scene(6, 1, "montage-element"),
      scene(7, 1, "dialogue-scene"),
    ],
    { beats: [], setups: [], relationships: [] },
    [{ name: "Beeju" }]
  );

  ok("a one-word beat in a silent scene is not thin", !report.thinDialogueScenes?.includes(1));
  ok("a reaction scene is not thin", !report.thinDialogueScenes?.includes(2));
  ok("an establishing scene is not thin", !report.thinDialogueScenes?.includes(3));
  ok("a transition is not thin", !report.thinDialogueScenes?.includes(4));
  ok("an action scene is not thin", !report.thinDialogueScenes?.includes(5));
  ok("a montage element is not thin", !report.thinDialogueScenes?.includes(6));
  ok("a ONE-turn dialogue scene IS thin", report.thinDialogueScenes?.includes(7), JSON.stringify(report.thinDialogueScenes));
}
{
  const noContract = buildStoryQualityReport(
    [{ sceneNumber: 1, storyFunction: "does a thing", characterActions: "acts", charactersPresent: ["A"], dialogueTurns: [{ speaker: "A", line: "hi" }] }],
    { beats: [], setups: [], relationships: [] },
    [{ name: "A" }]
  );
  ok("an older contract-less scene is not judged", noContract.thinDialogueScenes?.length === 0);
}

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
