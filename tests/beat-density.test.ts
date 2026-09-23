import {
  buildBeatDensityReport,
  clusterMoves,
  summariseBeatDensity,
  MOVE_SIMILARITY_THRESHOLD,
} from "../src/server/story/beat-density.js";
import {
  BAD_BEAT_FIXTURES,
  NEGATIVE_BEAT_FIXTURES,
  ALL_BEAT_FIXTURES,
  LEGACY_BEATS,
  PARTIAL_BEATS,
} from "./fixtures/beat-fixtures.js";

/**
 * P1 regression suite — Beat Density.
 *
 * Offline. Fixtures only, no API calls.
 *
 * The negative fixtures carry the weight: a check that flags a real escalation
 * sequence or a multi-scene climax would push the blueprint toward thinner
 * beats, which is the opposite of what this is for.
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

const run = (f: (typeof ALL_BEAT_FIXTURES)[number]) =>
  buildBeatDensityReport({ beats: f.beats, targetSceneCount: f.targetSceneCount });

const hasStretchWarning = (r: ReturnType<typeof buildBeatDensityReport>) =>
  r.findings.some(
    (x) =>
      x.severity === "warning" &&
      (x.code === "beat-stretched" ||
        x.code === "resolution-stretched" ||
        x.code === "declared-distinctness-unsupported" ||
        x.code === "premise-too-small")
  );

// ---------------------------------------------------------------------------
section("Move clustering");
{
  const same = ["They keep searching the shed", "They search the shed again", "They go on searching the shed"];
  ok("paraphrases of one move collapse to one cluster", clusterMoves(same).length === 1, String(clusterMoves(same).length));
}
{
  const different = [
    "Kheera finds a chalk mark nobody admits to making",
    "The ledger shows a crate that was never delivered",
    "The hollow crate stack proves the child was never inside",
  ];
  ok("genuinely different moves stay separate", clusterMoves(different).length === 3);
}
{
  // Single-linkage matters: a stretched beat drifts, so A~B and B~C should
  // make all three one move even when A and C are less alike.
  const drifting = [
    "They walk along the road toward the town",
    "They keep walking down the road toward town",
    "They continue along the road heading for the town",
  ];
  ok("drifting paraphrase chains merge transitively", clusterMoves(drifting).length === 1);
}
ok("empty list clusters to nothing", clusterMoves([]).length === 0);
{
  const blanks = ["", "   ", ""];
  ok("blank descriptions are not evidence of repetition", clusterMoves(blanks).length === 3);
}
{
  // A blank must not act as a BRIDGE between two moves, and must not be
  // absorbed into their cluster. Descriptions are full sentences here because
  // that is what a real beat sheet contains - three-word fragments are below
  // the length any similarity measure can work on.
  const mixed = [
    "They search the shed for the missing lamp and find nothing",
    "",
    "They keep searching the shed for the lamp and still find nothing",
  ];
  const clusters = clusterMoves(mixed);
  ok("the two real moves still merge across a blank", clusters.some((c) => c.length === 2), JSON.stringify(clusters));
  ok("and the blank stays its own cluster", clusters.length === 2, String(clusters.length));
}

// ---------------------------------------------------------------------------
section("Bad fixtures — every planned stretch must be caught");
for (const fixture of BAD_BEAT_FIXTURES) {
  const r = run(fixture);
  ok(`${fixture.name}: flagged`, hasStretchWarning(r), `codes=[${r.findings.map((f) => f.code).join(",")}]`);
  ok(
    `${fixture.name}: fewer verified moves than scenes`,
    r.totalVerifiedDistinctMoves < r.totalScenes,
    `${r.totalVerifiedDistinctMoves}/${r.totalScenes}`
  );
}

// ---------------------------------------------------------------------------
section("Negative fixtures — legitimate multi-scene beats must stay clean");
for (const fixture of NEGATIVE_BEAT_FIXTURES) {
  const r = run(fixture);
  ok(
    `${fixture.name}: not flagged`,
    !hasStretchWarning(r),
    r.findings.map((f) => `${f.code}:${f.title}`).join(" | ")
  );
  ok(
    `${fixture.name}: every scene has its own move`,
    r.totalStretchScenes === 0,
    `stretch=${r.totalStretchScenes}`
  );
}

// ---------------------------------------------------------------------------
section("False distinctness claims — the specific lie this catches");
{
  const fixture = BAD_BEAT_FIXTURES.find((f) => f.name === "false-distinctness-claim")!;
  const r = run(fixture);
  const finding = r.findings.find((f) => f.code === "declared-distinctness-unsupported");
  ok("a false distinctScenesNeeded is caught", Boolean(finding));
  ok("the declared number is reported", finding?.detail.includes("6 distinct scene(s)") ?? false);
  ok("the verified number is lower", r.beats[0].verifiedDistinctMoves < r.beats[0].declaredDistinctScenes!);
  ok("the repeated scenes are named", (r.beats[0].repeatedGroups[0]?.sceneNumbers.length ?? 0) > 1);
}
{
  // Declaring an HONEST smaller number must not be punished - that is exactly
  // the behaviour the doctrine asks for.
  const beats = [
    {
      beatNumber: 1,
      name: "Talaash",
      sceneStart: 1,
      sceneEnd: 3,
      distinctScenesNeeded: 1,
      whatEachSceneDoes: ["They search the shed", "They search the shed again", "They keep searching the shed"],
    },
  ];
  const r = buildBeatDensityReport({ beats, targetSceneCount: 3 });
  ok(
    "an honest low declaration is not reported as a false claim",
    !r.findings.some((f) => f.code === "declared-distinctness-unsupported")
  );
  ok("but the stretch itself is still reported", r.findings.some((f) => f.code.includes("stretched")));
}

// ---------------------------------------------------------------------------
section("Resolution compression");
{
  const beats = [
    {
      beatNumber: 1,
      name: "Bandh tootne wala hai",
      sceneStart: 1,
      sceneEnd: 3,
      whatEachSceneDoes: [
        "The water reaches the lower field and the sandbags run out",
        "Golu floods his own plot to save the shared channel",
        "The cart is swept off the bank and Tinku goes in after it",
      ],
    },
    {
      beatNumber: 2,
      name: "Sab khush",
      sceneStart: 4,
      sceneEnd: 8,
      whatEachSceneDoes: [
        "The villagers cheer around the saved channel",
        "The villagers keep cheering happily by the channel",
        "Everyone goes on celebrating beside the channel",
        "The crowd continues cheering around the saved channel",
        "The village carries on celebrating by the channel",
      ],
    },
  ];
  const r = buildBeatDensityReport({ beats, targetSceneCount: 8 });
  ok("a stretched ending is reported as a resolution problem", r.findings.some((f) => f.code === "resolution-stretched"));
  ok("the earlier dense beat is not flagged", r.beats[0].stretchScenes === 0);
  ok("the closing beat is", r.beats[1].stretchScenes > 0);
}
{
  const fixture = NEGATIVE_BEAT_FIXTURES.find((f) => f.name === "multi-scene-climax")!;
  const r = run(fixture);
  ok("a five-scene climax that keeps changing is not 'stretched resolution'", !hasStretchWarning(r));
}

// ---------------------------------------------------------------------------
section("Premise too small for the runtime");
{
  const fixture = BAD_BEAT_FIXTURES.find((f) => f.name === "thin-beat-stretched-long-runtime")!;
  const r = run(fixture);
  const finding = r.findings.find((f) => f.code === "premise-too-small");
  ok("a thin premise across a long runtime is reported", Boolean(finding));
  ok("and the advice is to add story, not lengthen a beat", finding?.suggestedFix.includes("Do not lengthen") ?? false);
  ok("the dense beats around it are not blamed", r.beats[0].stretchScenes === 0 && r.beats[2].stretchScenes === 0);
  ok("the stretched middle beat is", r.beats[1].stretchScenes > 0);
}
{
  const fixture = NEGATIVE_BEAT_FIXTURES.find((f) => f.name === "well-paced-full-film")!;
  const r = run(fixture);
  ok("a well-paced film is not accused of a thin premise", !r.findings.some((f) => f.code === "premise-too-small"));
  ok("and reports one move per scene", r.totalVerifiedDistinctMoves === r.totalScenes, `${r.totalVerifiedDistinctMoves}/${r.totalScenes}`);
}

// ---------------------------------------------------------------------------
section("Description-count mismatch");
{
  const beats = [
    {
      beatNumber: 1,
      name: "Adhoora",
      sceneStart: 1,
      sceneEnd: 6,
      whatEachSceneDoes: ["A decides to go", "B refuses to follow", "The gate is locked behind them"],
    },
  ];
  const r = buildBeatDensityReport({ beats, targetSceneCount: 6 });
  const finding = r.findings.find((f) => f.code === "description-count-mismatch");
  ok("fewer moves than scenes is reported", Boolean(finding));
  ok("and treated as a warning", finding?.severity === "warning");
  ok("three distinct moves are still credited", r.beats[0].verifiedDistinctMoves === 3);
  ok("the shortfall counts as stretch", r.beats[0].stretchScenes === 3);
}
{
  const beats = [
    {
      beatNumber: 1,
      name: "Zyada",
      sceneStart: 1,
      sceneEnd: 2,
      whatEachSceneDoes: ["A decides to go", "B refuses to follow", "The gate is locked behind them"],
    },
  ];
  const r = buildBeatDensityReport({ beats, targetSceneCount: 2 });
  ok("more moves than scenes is a note, not a warning", r.findings.find((f) => f.code === "description-count-mismatch")?.severity === "info");
  ok("and is not counted as stretch", r.beats[0].stretchScenes === 0);
}

// ---------------------------------------------------------------------------
section("Backward compatibility");
{
  const r = buildBeatDensityReport({ beats: LEGACY_BEATS, targetSceneCount: 12 });
  ok("an old blueprint reports degraded", r.degraded === true);
  ok("and raises no stretch warnings", !hasStretchWarning(r));
  ok("and names the unverifiable beats", r.unverifiableBeats.length === 2);
  ok("and does not claim a clean bill of health", r.findings.every((f) => f.code === "unverifiable"));
  ok("unverifiable beats are credited, not accused", r.totalStretchScenes === 0);
  ok("the summary says so plainly", summariseBeatDensity(r).includes("not measured"));
}
{
  const r = buildBeatDensityReport({ beats: PARTIAL_BEATS, targetSceneCount: 6 });
  ok("a half-migrated blueprint is not degraded", r.degraded === false);
  ok("the described beat is verified", r.beats[0].verifiable === true);
  ok("the bare beat is not", r.beats[1].verifiable === false);
  ok("and only the bare beat is listed unverifiable", r.unverifiableBeats.length === 1 && r.unverifiableBeats[0] === 2);
  ok("no false stretch from the missing half", r.totalStretchScenes === 0);
}

// ---------------------------------------------------------------------------
section("Robustness — measurement must never break a generation");
ok("no beats returns an empty report", buildBeatDensityReport({ beats: [] }).beats.length === 0);
ok("no beats reports degraded", buildBeatDensityReport({ beats: [] }).degraded === true);
ok("malformed beats do not throw", buildBeatDensityReport({ beats: [null, undefined, 7] as any }).beats.length === 0);
{
  const r = buildBeatDensityReport({ beats: [{ beatNumber: 1, whatEachSceneDoes: ["only move"] }], targetSceneCount: 1 });
  ok("a beat with no scene range does not throw", r.beats.length === 1);
}
ok("threshold is surfaced in the report", buildBeatDensityReport({ beats: LEGACY_BEATS }).threshold === MOVE_SIMILARITY_THRESHOLD);

// ---------------------------------------------------------------------------
section("Report-only guarantee");
{
  const fixture = BAD_BEAT_FIXTURES.find((f) => f.name === "stretched-celebration")!;
  const before = JSON.stringify(fixture.beats);
  buildBeatDensityReport({ beats: fixture.beats, targetSceneCount: fixture.targetSceneCount });
  ok("the beat sheet is never mutated", JSON.stringify(fixture.beats) === before);
}

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
