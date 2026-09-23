import fs from "fs";
import path from "path";
import {
  buildDistinctivenessReport,
  buildSignature,
  scorePair,
  textSimilarity,
  tokenSimilarity,
  trigramSimilarity,
  tokenize,
  normalise,
  NEAR_THRESHOLD,
  FAR_THRESHOLD,
  NEAR_WINDOW,
  RUN_LENGTH,
} from "../src/server/story/scene-distinctiveness.js";
import {
  buildFeasibilityReport,
  countWords,
  measureScene,
  speechRateFor,
  wordEnvelope,
} from "../src/server/story/performance-budget.js";
import { BAD_FIXTURES, NEGATIVE_FIXTURES, ALL_FIXTURES } from "./fixtures/story-fixtures.js";
import { parseReport } from "./parse-report.js";

/**
 * P0 regression suite — Scene Distinctiveness + Performance Budget.
 *
 * Entirely offline: fixtures plus already-saved reports, no API calls.
 *
 * The negative fixtures matter more than the positive ones. A detector that
 * flags legitimate montage, callbacks, rituals, silence or a one-room story
 * will be switched off, and then it protects nothing.
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

const report = (f: (typeof ALL_FIXTURES)[number]) =>
  buildDistinctivenessReport({
    scenes: f.scenes,
    characters: f.characters ?? [],
    lifeJourney: f.lifeJourney ?? null,
    setups: f.setups ?? [],
  });

// ---------------------------------------------------------------------------
section("Text similarity primitives");

ok("identical text scores 1.0", textSimilarity("the red cart", "the red cart") > 0.99);
ok("unrelated text scores low", textSimilarity("the red cart", "a silent moon") < 0.2);
ok(
  "reworded text scores high",
  textSimilarity("Hum kar sakte hain", "Hum zaroor kar sakte hain") > 0.5,
  String(textSimilarity("Hum kar sakte hain", "Hum zaroor kar sakte hain"))
);
ok(
  "the exact-match detector would have missed that pair",
  normalise("Hum kar sakte hain") !== normalise("Hum zaroor kar sakte hain")
);

// The single most likely false-positive source: two empty sets are "identical".
ok("two empty token sets score 0, not 1", tokenSimilarity([], []) === 0);
ok("one empty token set scores 0", tokenSimilarity(["cart"], []) === 0);
ok("two empty strings score 0 on trigrams", trigramSimilarity("", "") === 0);
ok("empty vs text scores 0 on trigrams", trigramSimilarity("", "the cart") === 0);
ok("blank fields score 0 overall", textSimilarity("", "") === 0);

ok("stopwords are dropped", !tokenize("the cart is in the yard").includes("the"));
ok("Roman Urdu function words are dropped", !tokenize("yeh cart hai").includes("hai"));
ok("content words survive", tokenize("the cart is in the yard").includes("cart"));
ok("short tokens are dropped", !tokenize("a b cd cart").includes("cd"));
ok("punctuation and case do not matter", normalise("Hum, KAR sakte... hain!") === "hum kar sakte hain");

// ---------------------------------------------------------------------------
section("Signatures");
{
  const scene = BAD_FIXTURES[0].scenes[0];
  const sig = buildSignature(scene);
  ok("signature carries the scene number", sig.sceneNumber === 1);
  ok("signature captures the place", sig.placeId === "place_path");
  ok("signature captures dialogue", sig.dimensions.dialogue.includes("pahunch"));
  ok("signature captures action", sig.dimensions.action.includes("jogs"));
  ok("signature captures camera", sig.dimensions.camera.length > 0);
}
{
  // Locked character descriptions are restated in EVERY Flow prompt by design.
  // If they are not stripped, every pair of prompts looks similar for a reason
  // that has nothing to do with the story.
  const locked = "a tall carrot in a green cap and blue dungarees with round black eyes and a soft orange body";
  const characters = [{ name: "Golu", lockedVisualDescription: locked }];
  const a = { sceneNumber: 1, finalVideoPrompt: `${locked}. Golu runs uphill fast.` };
  const b = { sceneNumber: 2, finalVideoPrompt: `${locked}. A silent moon over still water.` };
  const scored = scorePair(buildSignature(a, characters), buildSignature(b, characters)).score;
  const unstripped = textSimilarity(a.finalVideoPrompt, b.finalVideoPrompt);
  ok("locked descriptions are stripped before comparison", scored < unstripped, `${scored} vs ${unstripped}`);
  ok("and the stripped prompts score low", scored < 0.3, String(scored));
}
{
  // A dimension missing on one side must not count as dissimilarity - it is an
  // absence of evidence, and scoring it 0 would let a sparse scene hide.
  const full = { sceneNumber: 1, characterActions: "Golu jogs uphill", purpose: "reach the gate" };
  const sparse = { sceneNumber: 2, characterActions: "Golu jogs uphill" };
  const scored = scorePair(buildSignature(full), buildSignature(sparse)).score;
  ok("missing dimensions are excluded, not scored zero", scored > 0.9, String(scored));
}

// ---------------------------------------------------------------------------
section("Bad fixtures — every one must be flagged");
for (const fixture of BAD_FIXTURES) {
  const r = report(fixture);
  const flagged = r.pairs.filter((p) => !p.exempt);
  ok(`${fixture.name}: flagged`, flagged.length > 0, `${flagged.length} pairs`);
  ok(`${fixture.name}: stall detected`, r.runs.length > 0, `${r.runs.length} runs`);
}

// ---------------------------------------------------------------------------
section("Negative fixtures — every one must stay clean");
for (const fixture of NEGATIVE_FIXTURES) {
  const r = report(fixture);
  const flagged = r.pairs.filter((p) => !p.exempt);
  ok(
    `${fixture.name}: not flagged`,
    flagged.length === 0,
    flagged.map((p) => `S${p.sceneA}~S${p.sceneB}=${p.score}`).join(" ")
  );
  ok(`${fixture.name}: no stall reported`, r.runs.length === 0);
}

// ---------------------------------------------------------------------------
section("Anti-overfitting — different verbs, same failure");
{
  const jog = report(BAD_FIXTURES.find((f) => f.name === "repeated-jogging")!);
  const walk = report(BAD_FIXTURES.find((f) => f.name === "repeated-walking")!);
  const celebrate = report(BAD_FIXTURES.find((f) => f.name === "repeated-celebration")!);
  const react = report(BAD_FIXTURES.find((f) => f.name === "repeated-reaction-shots")!);
  ok("jogging caught", jog.runs.length > 0);
  ok("walking caught (different verb)", walk.runs.length > 0);
  ok("celebration caught (stretched resolution)", celebrate.runs.length > 0);
  ok("reaction shots caught (padding)", react.runs.length > 0);
  ok(
    "repeated-celebration is caught at the calibrated threshold",
    celebrate.pairs.filter((p) => !p.exempt).length > 0,
    "an earlier hand-picked 0.55 missed this fixture entirely"
  );
}

// ---------------------------------------------------------------------------
section("Exemptions — declared repetition is craft");
{
  const ritual = NEGATIVE_FIXTURES.find((f) => f.name === "legitimate-ritual")!;
  const r = report(ritual);
  ok("a Life Journey routine does not read as a duplicate", r.pairs.filter((p) => !p.exempt).length === 0);
}
{
  // A declared callback that did NOT vary must still be reported. Repetition
  // works through variation; an unchanged repeat is not a callback.
  const scenes = [
    { sceneNumber: 1, purpose: "Tinku drops the crates", storyFunction: "Tinku drops every crate he tries to carry", characterActions: "Tinku stacks six crates and drops them all", dialogueTurns: [{ speaker: "Tinku", line: "Main sab utha sakta hoon" }], charactersPresent: ["Tinku"], continuityState: { placeId: "place_yard" } },
    { sceneNumber: 2, purpose: "Tinku drops the crates", storyFunction: "Tinku drops every crate he tries to carry", characterActions: "Tinku stacks six crates and drops them all", dialogueTurns: [{ speaker: "Tinku", line: "Main sab utha sakta hoon" }], charactersPresent: ["Tinku"], continuityState: { placeId: "place_yard" }, contract: { repetitionIntent: { kind: "callback", echoesScene: 1, variation: "" } } },
  ];
  const r = buildDistinctivenessReport({ scenes });
  // P2 tightened this: an empty variation makes the declaration UNUSABLE, so
  // the pair is never exempted in the first place rather than being exempted
  // and then withdrawn. The outcome that matters is unchanged and the path is
  // cleaner - the pair stays fully measurable.
  ok("a declared callback with no variation is still reported", r.pairs.length === 1);
  ok("and it is never exempt", r.pairs.every((p) => !p.exempt));
}
{
  // The withdrawal mechanism still exists, for the case it was built for: a
  // VALID declaration on two scenes that turn out near-identical anyway.
  const line = { speaker: "Tinku", line: "Main sab utha sakta hoon" };
  const shared = {
    purpose: "Tinku drops the crates",
    storyFunction: "Tinku drops every crate he tries to carry",
    characterActions: "Tinku stacks six crates in his arms and drops them all",
    dialogueTurns: [line],
    charactersPresent: ["Tinku"],
    continuityState: { placeId: "place_yard" },
  };
  const scenes = [
    { sceneNumber: 1, ...shared },
    {
      sceneNumber: 2,
      ...shared,
      contract: {
        repetitionIntent: {
          kind: "callback",
          echoesScene: 1,
          variation: "This time the outcome is supposed to be completely different",
        },
      },
    },
  ];
  const r = buildDistinctivenessReport({ scenes });
  ok("a valid declaration on identical scenes is withdrawn", r.pairs.some((p) => p.unvariedRecurrence));
  ok("and the pair is reported rather than exempted", r.pairs.every((p) => !p.exempt));
}
{
  const setups = [{ element: "the chalk line", plantScene: 1, payoffScene: 2, meaning: "it means something else now" }];
  const scenes = [
    { sceneNumber: 1, purpose: "Kheera marks the paving", storyFunction: "Kheera marks the paving with chalk and does not know why it matters", characterActions: "Kheera draws a short white chalk line on the paving", dialogueTurns: [{ speaker: "Kheera", line: "Yeh nishan rakho" }], charactersPresent: ["Kheera"], continuityState: { placeId: "place_corner" } },
    { sceneNumber: 2, purpose: "Kheera reads the chalk mark", storyFunction: "Kheera reads the chalk mark and learns the crates were moved overnight", characterActions: "Kheera stands over the smudged white chalk line on the paving", dialogueTurns: [{ speaker: "Kheera", line: "Yeh nishan badal gaya" }], charactersPresent: ["Kheera"], continuityState: { placeId: "place_corner" } },
  ];
  const r = buildDistinctivenessReport({ scenes, setups });
  const flagged = r.pairs.filter((p) => !p.exempt);
  ok("a setup and its payoff are not a duplicate", flagged.length === 0);
}

// ---------------------------------------------------------------------------
section("Robustness");
ok("no scenes returns an empty report", buildDistinctivenessReport({ scenes: [] }).sceneCount === 0);
ok("one scene returns an empty report", buildDistinctivenessReport({ scenes: [{ sceneNumber: 1 }] }).pairs.length === 0);
ok("malformed input does not throw", buildDistinctivenessReport({ scenes: [null, undefined, 7] as any }).pairs.length === 0);
{
  const blank = [
    { sceneNumber: 1, continuityState: {} },
    { sceneNumber: 2, continuityState: {} },
    { sceneNumber: 3, continuityState: {} },
  ];
  const r = buildDistinctivenessReport({ scenes: blank });
  ok("wholly empty scenes are not reported as duplicates", r.pairs.length === 0);
}
ok("thresholds are exported for the report", NEAR_THRESHOLD < FAR_THRESHOLD && NEAR_WINDOW > 0 && RUN_LENGTH >= 3);

// ---------------------------------------------------------------------------
section("Place concentration is measured, never punished");
{
  const r = report(NEGATIVE_FIXTURES.find((f) => f.name === "single-location-story")!);
  ok("a one-room story reports 100% concentration", r.placeConcentration[0].sharePercent === 100);
  ok("and is still not flagged", r.pairs.filter((p) => !p.exempt).length === 0);
}

// ---------------------------------------------------------------------------
section("Performance budget");
ok("word counting handles Roman Urdu", countWords("Hum kar sakte hain") === 4);
ok("word counting ignores punctuation", countWords("Zanjeer laga do. Aaj nahi!") === 5);
ok("empty line counts zero", countWords("") === 0);
ok("null line counts zero", countWords(null) === 0);
ok("speech rate has a default", speechRateFor("klingon") > 0);
{
  const env = wordEnvelope("Roman Urdu");
  ok("envelope is sane for a ten-second shot", env.comfortable >= 14 && env.comfortable <= 22, String(env.comfortable));
  ok("ceiling exceeds comfortable", env.ceiling > env.comfortable);
}
{
  const silent = measureScene({ sceneNumber: 1, dialogueTurns: [] }, "Roman Urdu");
  ok("a silent scene is 'silent', never 'underfilled'", silent.verdict === "silent");
}
{
  const tiny = measureScene({ sceneNumber: 1, dialogueTurns: [{ line: "Haan" }] }, "Roman Urdu");
  ok("one word in a talking scene is underfilled", tiny.verdict === "underfilled");
}
{
  const good = measureScene(
    { sceneNumber: 1, dialogueTurns: [{ line: "Chaabi kahan gayi" }, { line: "Pata nahi kahan" }, { line: "Phir se dekho" }] },
    "Roman Urdu"
  );
  ok("a ~10-word exchange is comfortable", good.verdict === "comfortable", `${good.words}w ${good.speechFraction}`);
}
{
  // The exact shape of the corrected regression: six turns of ~10 words.
  const overstuffed = measureScene(
    {
      sceneNumber: 1,
      dialogueTurns: Array.from({ length: 6 }, () => ({ line: "Yeh baat bilkul theek hai aur hum sab jaante hain" })),
    },
    "Roman Urdu"
  );
  ok("six long turns overrun a ten-second shot", overstuffed.verdict === "overruns", `${overstuffed.words}w ${overstuffed.speechFraction}`);
  ok("and the overrun is reported honestly", overstuffed.speechFraction > 1);
}
{
  const r = buildFeasibilityReport(
    Array.from({ length: 10 }, (_, i) => ({ sceneNumber: i + 1, dialogueTurns: [{ line: "a b c" }, { line: "d e f" }] })),
    "Roman Urdu"
  );
  ok("uniform density produces a zero standard deviation", r.turnsStdDev === 0);
  ok("and the dominant turn count covers the film", r.dominantTurnCount?.sharePercent === 100);
}
ok("empty story does not divide by zero", buildFeasibilityReport([], "Roman Urdu").averageWords === 0);

// ---------------------------------------------------------------------------
section("Real generated stories (offline, from test-output/)");
{
  const dir = path.resolve(process.cwd(), "test-output");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : [];

  if (files.length === 0) {
    console.log("  (no saved reports — skipped)");
  } else {
    for (const file of files) {
      const parsed = parseReport(path.join(dir, file));
      ok(`${file.slice(0, 40)}: parses into scenes`, parsed.scenes.length > 0, `${parsed.scenes.length}`);
      const d = buildDistinctivenessReport({
        scenes: parsed.scenes,
        characters: parsed.characters,
        setups: parsed.setups,
      });
      ok(`${file.slice(0, 40)}: distinctiveness runs without throwing`, d.sceneCount === parsed.scenes.length);
      const f = buildFeasibilityReport(parsed.scenes, parsed.language);
      ok(`${file.slice(0, 40)}: feasibility runs without throwing`, f.scenes.length === parsed.scenes.length);
    }
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
