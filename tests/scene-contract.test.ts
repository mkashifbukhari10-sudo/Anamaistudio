import {
  buildSceneContractReport,
  validateSceneContract,
  looksLikeActivity,
  summariseContracts,
  BEFORE_AFTER_THRESHOLD,
  ACTIVITY_THRESHOLD,
} from "../src/server/story/scene-contract.js";
import {
  buildDistinctivenessReport,
  isUsableRepetitionIntent,
} from "../src/server/story/scene-distinctiveness.js";
import {
  ALL_CONTRACT_FIXTURES,
  BAD_CONTRACT_FIXTURES,
  LEGITIMATE_CONTRACT_FIXTURES,
  CONTRACTLESS_SCENES,
} from "./fixtures/contract-fixtures.js";

/**
 * P2 regression suite — Scene Progression Contract.
 *
 * Offline. Fixtures only, no API calls.
 *
 * The legitimate fixtures deliberately include SMALL changes — a quiet
 * emotional shift, an establishing shot landing one fact, a wordless beat. A
 * validator that demanded danger, dialogue or a reversal would push every
 * story toward melodrama, so "small but genuine is valid" is tested directly.
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

const run = (f: (typeof ALL_CONTRACT_FIXTURES)[number]) =>
  buildSceneContractReport({ scenes: f.scenes, characters: f.characters });

const codesOf = (r: ReturnType<typeof buildSceneContractReport>) =>
  new Set(r.issues.filter((i) => i.severity === "warning").map((i) => i.code));

// ---------------------------------------------------------------------------
section("Bad fixtures — every fake contract must be caught");
for (const fixture of BAD_CONTRACT_FIXTURES) {
  const r = run(fixture);
  ok(`${fixture.name}: flagged`, r.warnings > 0, `codes=[${[...codesOf(r)].join(",")}]`);
  if (fixture.expectCodes) {
    const codes = codesOf(r);
    ok(
      `${fixture.name}: raises ${fixture.expectCodes.join(" + ")}`,
      fixture.expectCodes.every((c) => codes.has(c as any)),
      `got [${[...codes].join(",")}]`
    );
  }
}

// ---------------------------------------------------------------------------
section("Legitimate fixtures — small but genuine progression is valid");
for (const fixture of LEGITIMATE_CONTRACT_FIXTURES) {
  const r = run(fixture);
  ok(
    `${fixture.name}: clean`,
    r.warnings === 0,
    r.issues.filter((i) => i.severity === "warning").map((i) => `${i.code}@S${i.sceneNumber}`).join(" ")
  );
  ok(`${fixture.name}: every scene counted valid`, r.scenesWithValidContract.length === fixture.scenes.length);
}

// ---------------------------------------------------------------------------
section("Small changes must not be punished");
{
  const quiet = LEGITIMATE_CONTRACT_FIXTURES.find((f) => f.name === "quiet-emotional-shift")!;
  const r = run(quiet);
  ok("a silent scene with no dialogue is valid", r.warnings === 0);
  ok("and its performance type is recorded", r.performanceTypes.some((t) => t.type === "silent-emotional"));
}
{
  const est = LEGITIMATE_CONTRACT_FIXTURES.find((f) => f.name === "establishing-with-small-information")!;
  const r = run(est);
  ok("an establishing scene landing one fact is valid", r.warnings === 0);
}
{
  // A tiny, specific move must survive the before/after similarity check.
  const v = validateSceneContract({
    sceneNumber: 1,
    characterActions: "Mooli sets the tin down on the step",
    contract: {
      goal: "Mooli wants to stop carrying it alone",
      obstacle: "Asking would mean admitting she cannot",
      outcome: "partial",
      performanceType: "reaction",
      progression: { kind: "emotional", value: "Mooli's pride", before: "unbending", after: "bending slightly" },
    },
  });
  ok("a small emotional move passes", v.issues.filter((i) => i.severity === "warning").length === 0,
     v.issues.map((i) => i.code).join(","));
}

// ---------------------------------------------------------------------------
section("Detecting fake value changes");
{
  const v = validateSceneContract({
    sceneNumber: 1,
    contract: { goal: "reach the gate", obstacle: "the slope", outcome: "partial", performanceType: "action",
      progression: { kind: "progress", value: "distance", before: "far", after: "far" } },
  });
  ok("exact same before/after is caught", v.issues.some((i) => i.code === "identical-before-after"));
}
{
  const v = validateSceneContract({
    sceneNumber: 1,
    contract: { goal: "reach the gate", obstacle: "the slope", outcome: "partial", performanceType: "action",
      progression: { kind: "progress", value: "distance", before: "still very far away", after: "very far away still" } },
  });
  ok("reworded before/after is caught", v.issues.some((i) => i.code === "near-identical-before-after"));
}
{
  const v = validateSceneContract({
    sceneNumber: 1,
    contract: { goal: "reach the gate", obstacle: "the slope", outcome: "partial", performanceType: "action",
      progression: { kind: "progress", value: "mood", before: "normal", after: "unchanged" } },
  });
  ok("a generic non-answer is caught", v.issues.some((i) => i.code === "generic-progression"));
}
{
  const v = validateSceneContract(
    {
      sceneNumber: 1,
      characterActions: "Golu walks across the yard and picks up the rope",
      contract: { goal: "get the rope", obstacle: "it is across the yard", outcome: "achieved", performanceType: "action",
        progression: { kind: "progress", value: "the rope", before: "Golu walks across the yard", after: "Golu picks up the rope" } },
    },
    { castNames: ["Golu"] }
  );
  const codes = v.issues.map((i) => i.code);
  ok("two actions instead of a value are caught", codes.includes("activity-as-progression"));
  ok("and the action-restatement is caught separately", codes.includes("progression-restates-action"));
}
ok("looksLikeActivity needs BOTH a cast name and an action verb",
   looksLikeActivity("Golu enters the room", ["Golu"]) === true &&
   looksLikeActivity("trust is guarded", ["Golu"]) === false &&
   looksLikeActivity("the door opens", ["Golu"]) === false);
ok("a value state mentioning a name is not activity",
   looksLikeActivity("Mooli's pride is unbending", ["Mooli"]) === false);

// ---------------------------------------------------------------------------
section("Duplicate contracts across scenes");
{
  const fixture = BAD_CONTRACT_FIXTURES.find((f) => f.name === "duplicate-contracts-across-scenes")!;
  const r = run(fixture);
  ok("the same claim copied across scenes is caught", codesOf(r).has("duplicate-contract" as any));
  ok("and more than one pair is reported", r.issues.filter((i) => i.code === "duplicate-contract").length >= 2);
}

// ---------------------------------------------------------------------------
section("Repetition intent safeguards");
ok("a valid intent is usable",
   isUsableRepetitionIntent({ kind: "callback", echoesScene: 1, variation: "Opposite outcome and nobody is watching" }, 6, new Set([1, 6])));
ok("a forward reference is not", !isUsableRepetitionIntent({ kind: "callback", echoesScene: 9, variation: "Opposite outcome entirely" }, 6, new Set([1, 6, 9])));
ok("a self reference is not", !isUsableRepetitionIntent({ kind: "callback", echoesScene: 6, variation: "Opposite outcome entirely" }, 6, new Set([6])));
ok("an unknown scene is not", !isUsableRepetitionIntent({ kind: "callback", echoesScene: 3, variation: "Opposite outcome entirely" }, 6, new Set([1, 6])));
ok("an unknown kind is not", !isUsableRepetitionIntent({ kind: "flashback", echoesScene: 1, variation: "Opposite outcome entirely" }, 6, new Set([1, 6])));
ok("a missing variation is not", !isUsableRepetitionIntent({ kind: "callback", echoesScene: 1, variation: "" }, 6, new Set([1, 6])));
ok("a token variation is not", !isUsableRepetitionIntent({ kind: "callback", echoesScene: 1, variation: "same" }, 6, new Set([1, 6])));
ok("a non-object is not", !isUsableRepetitionIntent(null, 6));

{
  // The safeguard that matters: declaring a callback must NOT switch off the
  // distinctiveness engine when the declaration is unusable.
  const base = (n: number, intent?: any) => ({
    sceneNumber: n,
    purpose: "Golu tries to carry every crate in one trip",
    storyFunction: "Golu overloads himself with crates and drops every one of them",
    characterActions: "Golu stacks six crates in his arms and drops them all",
    dialogueTurns: [{ speaker: "Golu", line: "Main sab utha sakta hoon" }],
    charactersPresent: ["Golu"],
    continuityState: { placeId: "place_yard" },
    contract: intent ? { repetitionIntent: intent } : undefined,
  });

  const invalid = buildDistinctivenessReport({
    scenes: [base(1), base(2, { kind: "callback", echoesScene: 1, variation: "" })],
  });
  ok("an unusable declaration does not exempt the pair", invalid.pairs.every((p) => !p.exempt));

  const forward = buildDistinctivenessReport({
    scenes: [base(1), base(2, { kind: "callback", echoesScene: 9, variation: "A completely different outcome this time" })],
  });
  ok("a forward reference does not exempt the pair", forward.pairs.every((p) => !p.exempt));

  const unknownScene = buildDistinctivenessReport({
    scenes: [base(1), base(2, { kind: "callback", echoesScene: 7, variation: "A completely different outcome this time" })],
  });
  ok("an echo of a missing scene does not exempt the pair", unknownScene.pairs.every((p) => !p.exempt));
}

// ---------------------------------------------------------------------------
section("Backward compatibility");
{
  const r = buildSceneContractReport({ scenes: CONTRACTLESS_SCENES });
  ok("a contract-less story reports degraded", r.degraded === true);
  ok("and raises no warnings", r.warnings === 0);
  ok("and lists every scene as missing", r.scenesMissingContract.length === CONTRACTLESS_SCENES.length);
  ok("and claims no valid contracts", r.scenesWithValidContract.length === 0);
  ok("the summary says so plainly", summariseContracts(r).includes("no scene contracts"));
}
{
  const mixed = [
    CONTRACTLESS_SCENES[0],
    {
      sceneNumber: 2,
      characterActions: "Mooli sets the tin down",
      contract: {
        goal: "Mooli wants to put it down without being seen",
        obstacle: "Gajar is watching from the step",
        outcome: "denied",
        performanceType: "reaction",
        progression: { kind: "emotional", value: "Mooli's pride", before: "unbending", after: "bending slightly" },
      },
    },
  ];
  const r = buildSceneContractReport({ scenes: mixed });
  ok("a half-migrated story is not degraded", r.degraded === false);
  ok("the contract-less scene is listed missing", r.scenesMissingContract.includes(1));
  ok("the real contract is counted valid", r.scenesWithValidContract.includes(2));
  ok("and the missing one raises no warning", r.warnings === 0);
}

// ---------------------------------------------------------------------------
section("Purity — validation must never mutate a scene");
{
  const fixture = BAD_CONTRACT_FIXTURES.find((f) => f.name === "activity-as-progression")!;
  const before = JSON.stringify(fixture.scenes);
  buildSceneContractReport({ scenes: fixture.scenes, characters: fixture.characters });
  validateSceneContract(fixture.scenes[0], { castNames: ["Golu"] });
  ok("scenes are unchanged after validation", JSON.stringify(fixture.scenes) === before);
}
{
  // The contract must not leak into the layers that own physical and social
  // truth. Nothing in validation should touch these.
  const scene: any = {
    sceneNumber: 1,
    continuityState: { placeId: "place_yard", heldProps: { Golu: "rope" } },
    socialChanges: [{ characterA: "Golu", characterB: "Mooli", dimension: "trust", change: "restored" }],
    contract: {
      goal: "g", obstacle: "o", outcome: "achieved", performanceType: "action",
      progression: { kind: "relationship", value: "trust", before: "guarded", after: "restored" },
    },
  };
  const snapshot = JSON.stringify({ cs: scene.continuityState, sc: scene.socialChanges });
  validateSceneContract(scene);
  ok("ContinuityState and socialChanges are untouched",
     JSON.stringify({ cs: scene.continuityState, sc: scene.socialChanges }) === snapshot);
}

// ---------------------------------------------------------------------------
section("Report shape");
{
  const all = ALL_CONTRACT_FIXTURES.flatMap((f) => f.scenes.map((s, i) => ({ ...s, sceneNumber: s.sceneNumber + i * 0 })));
  const r = buildSceneContractReport({ scenes: all });
  ok("progression kinds are distributed", r.progressionKinds.length > 1);
  ok("performance types are distributed", r.performanceTypes.length > 1);
  ok("shares are percentages", r.progressionKinds.every((k) => k.sharePercent >= 0 && k.sharePercent <= 100));
}
ok("empty input returns an empty report", buildSceneContractReport({ scenes: [] }).sceneCount === 0);
ok("malformed input does not throw", buildSceneContractReport({ scenes: [null, 7, undefined] as any }).sceneCount === 0);
ok("thresholds are exported", BEFORE_AFTER_THRESHOLD > 0 && ACTIVITY_THRESHOLD > 0);

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
