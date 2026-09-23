import {
  buildLifeJourney,
  buildLifeJourneyReport,
  deriveChapterRanges,
  householdLifeStateAt,
  journeyAllowedAtScale,
  jumpsBetween,
  lifeStageRank,
  lifeStateAt,
  maxPhasesFor,
  phaseForScene,
  storyTimeForScene,
  summariseLifeJourney,
  timeJumpBeforeScene,
} from "../src/server/story/life-journey.js";
import { buildLifeJourneySection } from "../src/server/dev/life-journey-section.js";
import type { SocialGraph } from "../src/types.js";

/**
 * P0 regression suite for the Life Journey Director.
 *
 * Covers normalisation, the single life-state accessor and the report. No API
 * calls: every case runs against fixtures, so this is free to run on every
 * change and is the guard for the "dormant by default" claim.
 */

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(`${name}${detail ? ` -- ${detail}` : ""}`);
  }
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${condition || !detail ? "" : ` (${detail})`}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Fixtures - a 48-scene, 8-chapter story. Deliberately NOT the reference test
// case: no family, no farming, no education arc.
// ---------------------------------------------------------------------------

const BEATS = [
  { beatNumber: 1, chapterNumber: 1, sceneStart: 1, sceneEnd: 6 },
  { beatNumber: 2, chapterNumber: 2, sceneStart: 7, sceneEnd: 12 },
  { beatNumber: 3, chapterNumber: 3, sceneStart: 13, sceneEnd: 18 },
  { beatNumber: 4, chapterNumber: 4, sceneStart: 19, sceneEnd: 24 },
  { beatNumber: 5, chapterNumber: 5, sceneStart: 25, sceneEnd: 30 },
  { beatNumber: 6, chapterNumber: 6, sceneStart: 31, sceneEnd: 36 },
  { beatNumber: 7, chapterNumber: 7, sceneStart: 37, sceneEnd: 42 },
  { beatNumber: 8, chapterNumber: 8, sceneStart: 43, sceneEnd: 48 },
];

const CHAPTERS = Array.from({ length: 8 }, (_, i) => ({
  chapterNumber: i + 1,
  title: `Chapter ${i + 1}`,
  sceneRange: `${i * 6 + 1}-${i * 6 + 6}`,
}));

const SOCIAL_GRAPH: SocialGraph = {
  bonds: [],
  households: [{ id: "household_1", name: "the room above the workshop", memberIds: ["Karela", "Bhindi"] }],
  characterSocial: [
    { characterId: "Karela", lifeStage: "young adult", householdId: "household_1", responsibilities: ["opening the shop"] },
    { characterId: "Bhindi", lifeStage: "young adult", householdId: "household_1" },
  ],
  plannedChanges: [],
};

function twoPhaseRaw(overrides: Record<string, unknown> = {}) {
  return {
    whyThisShape: "The shop's slow failure only reads across seasons, not across an afternoon.",
    openingLife: "Two siblings open a tailoring shop every morning with more hope than customers.",
    closingLife: "The shutters stay down by choice, and they are doing something else together.",
    phases: [
      {
        phaseNumber: 1,
        title: "Every morning, the shutters go up",
        chapterNumbers: [1, 2, 3, 4],
        characterStates: [
          { characterId: "Karela", lifeStage: "young adult", occupation: "tailor", responsibilities: ["opening the shop"] },
          { characterId: "Bhindi", lifeStage: "young adult", occupation: "tailor" },
        ],
        householdStates: [
          { householdId: "household_1", livelihood: "tailoring", possessions: ["the machine"], pressures: ["the rent"] },
        ],
        activePlaceIds: ["place_shop", "place_room"],
      },
      {
        phaseNumber: 2,
        title: "The second winter",
        chapterNumbers: [5, 6, 7, 8],
        entryJump: {
          span: "the following winter",
          magnitude: "seasons",
          screenTreatment: "The same shutter, now rusted, rolling up on an empty street.",
          whatChanged: ["The machine has been sold.", "Bhindi has been taking work elsewhere."],
        },
        characterStates: [
          { characterId: "Karela", lifeStage: "adult", occupation: "tailor", responsibilities: ["opening the shop", "the accounts"] },
          { characterId: "Bhindi", lifeStage: "adult", occupation: "delivery work" },
        ],
        householdStates: [
          { householdId: "household_1", livelihood: "piecework and delivery", pressures: ["the rent", "the silence between them"] },
        ],
        activePlaceIds: ["place_shop", "place_room", "place_street"],
      },
    ],
    aspirations: [
      {
        characterId: "Karela",
        goal: "keep the shop their father opened",
        whyItMatters: "It is the only thing of his that still stands.",
        costToOthers: "Bhindi's own plans, deferred year after year.",
        obstacles: ["no customers", "the rent"],
        resolvesAtPhase: 2,
        outcome: "relinquished",
      },
    ],
    milestones: [
      {
        atScene: 40,
        kind: "the decision",
        description: "They agree to close it.",
        provingSceneNumbers: [8, 22, 33],
        cost: "The shop, and the version of himself Karela had attached to it.",
      },
    ],
    routines: [
      {
        id: "routine_shutters",
        activity: "raising the shutters together",
        characterIds: ["Karela", "Bhindi"],
        placeId: "place_shop",
        phaseNumbers: [1, 2],
        variationAcrossStory: "First in unison, later Karela alone, finally neither of them.",
      },
    ],
    ...overrides,
  };
}

const build = (raw: any, targetSceneCount = 48, scope: any = "Auto") =>
  buildLifeJourney({ raw, beats: BEATS, chapters: CHAPTERS, targetSceneCount, scope });

// ---------------------------------------------------------------------------

section("Scale gating");
ok("6 scenes never allows a journey", !journeyAllowedAtScale(6));
ok("12 scenes does not auto-allow", !journeyAllowedAtScale(12));
ok("12 scenes allows an explicit request", journeyAllowedAtScale(12, "Life Journey"));
ok("24 scenes auto-allows", journeyAllowedAtScale(24));
ok("Single Episode always refuses", !journeyAllowedAtScale(60, "Single Episode"));
ok("phase ceiling scales", maxPhasesFor(6) === 1 && maxPhasesFor(30) === 3 && maxPhasesFor(60) === 5);

section("Dormant by default");
ok("no raw input yields no journey", build(undefined).journey === undefined);
ok("empty object yields no journey", build({}).journey === undefined);
ok("no phases yields no journey", build({ phases: [] }).journey === undefined);
{
  const single = build({ ...twoPhaseRaw(), phases: [twoPhaseRaw().phases[0]] });
  ok("a single phase stays dormant", single.journey === undefined);
  ok("and says why", single.issues.some((i) => i.kind === "phase" && i.severity === "info"));
}
{
  const gated = build(twoPhaseRaw(), 12, "Auto");
  ok("a journey below the scale gate is discarded", gated.journey === undefined);
  ok("and is reported as a scope issue", gated.issues.some((i) => i.kind === "scope"));
}

section("Chapter range derivation");
{
  const ranges = deriveChapterRanges(BEATS, CHAPTERS);
  ok("one range per chapter", ranges.length === 8);
  ok("derived from beats", ranges[0].sceneStart === 1 && ranges[0].sceneEnd === 6);
  ok("ordered by scene", ranges[7].sceneStart === 43);
}
{
  // Chapter 9 has no beat; only its own sceneRange string can describe it.
  const ranges = deriveChapterRanges(BEATS, [...CHAPTERS, { chapterNumber: 9, sceneRange: "49-54" }]);
  const ninth = ranges.find((r) => r.chapterNumber === 9);
  ok("falls back to the chapter's own range when no beat claims it", ninth?.sceneStart === 49);
}
{
  // A beat range and a chapter label that disagree: the beat must win.
  const conflicting = [{ chapterNumber: 1, title: "x", sceneRange: "1-99" }];
  const ranges = deriveChapterRanges(BEATS, conflicting);
  ok("beats outrank a disagreeing chapter label", ranges[0].sceneEnd === 6);
}

section("Valid two-phase journey");
{
  const { journey, issues } = build(twoPhaseRaw());
  ok("journey is built", Boolean(journey));
  ok("two phases", journey?.phases.length === 2);
  ok("phase 1 range derived from its chapters", journey?.phases[0].sceneStart === 1 && journey?.phases[0].sceneEnd === 24);
  ok("phase 2 range derived from its chapters", journey?.phases[1].sceneStart === 25 && journey?.phases[1].sceneEnd === 48);
  ok("phase 1 has no entry jump", journey?.phases[0].entryJump === undefined);
  ok("phase 2 has one", Boolean(journey?.phases[1].entryJump));
  ok("jump is pinned to the boundary", journey?.phases[1].entryJump?.afterScene === 24);
  ok("timeJumps rebuilt from boundaries", journey?.timeJumps.length === 1 && journey?.timeJumps[0].afterScene === 24);
  ok("magnitude normalised", journey?.timeJumps[0].magnitude === "seasons");
  ok("no warnings on a clean journey", issues.filter((i) => i.severity === "warning").length === 0,
     issues.filter((i) => i.severity === "warning").map((i) => i.title).join("; "));
}

section("Structural corrections");
{
  const raw = twoPhaseRaw();
  raw.phases[1].chapterNumbers = [4, 5, 6, 7, 8]; // chapter 4 already claimed
  const { journey, issues } = build(raw);
  ok("a chapter cannot belong to two phases", journey?.phases[1].chapterNumbers.includes(4) === false);
  ok("and the double claim is reported", issues.some((i) => i.title.includes("Chapter 4")));
  ok("ranges stay contiguous afterwards", journey?.phases[1].sceneStart === journey!.phases[0].sceneEnd + 1);
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].chapterNumbers = [6, 7, 8]; // leaves chapter 5 orphaned -> gap
  const { journey, issues } = build(raw);
  ok("a gap between phases is closed", journey?.phases[1].sceneStart === journey!.phases[0].sceneEnd + 1);
  ok("and reported", issues.some((i) => i.title.includes("Gap or overlap")));
}
{
  const raw = twoPhaseRaw();
  raw.phases[0].chapterNumbers = [2, 3, 4];
  const { journey, issues } = build(raw);
  ok("coverage is extended back to scene 1", journey?.phases[0].sceneStart === 1);
  ok("and reported", issues.some((i) => i.title.includes("do not begin at scene 1")));
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].chapterNumbers = [5, 6, 7];
  const { journey, issues } = build(raw);
  ok("coverage is extended to the final scene", journey?.phases[1].sceneEnd === 48);
  ok("and reported", issues.some((i) => i.title.includes("do not reach the final scene")));
}
{
  const raw = twoPhaseRaw();
  (raw.phases[0] as any).entryJump = { span: "before", magnitude: "years", screenTreatment: "x", whatChanged: ["y"] };
  const { journey } = build(raw);
  ok("a jump on phase 1 is stripped", journey?.phases[0].entryJump === undefined);
}
{
  const raw = twoPhaseRaw();
  raw.phases.reverse();
  const { journey } = build(raw);
  ok("phases are renumbered in scene order", journey?.phases[0].sceneStart === 1 && journey?.phases[0].phaseNumber === 1);
}

section("Time jumps");
{
  const raw = twoPhaseRaw();
  raw.phases[1].entryJump.screenTreatment = "";
  const { issues } = build(raw);
  ok("an unshown jump is a warning", issues.some((i) => i.kind === "time-jump" && i.severity === "warning"));
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].entryJump.whatChanged = [];
  const { issues } = build(raw);
  ok("a jump changing nothing is reported", issues.some((i) => i.title.includes("states no changes")));
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].entryJump.magnitude = "a few years later";
  const { journey } = build(raw);
  ok("loose magnitude wording is normalised", journey?.timeJumps[0].magnitude === "years");
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].entryJump.magnitude = "???";
  raw.phases[1].entryJump.span = "???";
  const { journey } = build(raw);
  ok("an unrecognised span defaults to the smallest safe jump", journey?.timeJumps[0].magnitude === "days");
}

section("Life-stage monotonicity");
ok("known stages rank", lifeStageRank("small child") < lifeStageRank("young adult"));
ok("unknown phrasing does not rank", lifeStageRank("betwixt") === -1);
{
  const raw = twoPhaseRaw();
  raw.phases[1].characterStates[0].lifeStage = "small child";
  const { issues } = build(raw);
  ok("getting younger is a warning", issues.some((i) => i.kind === "life-state" && i.title.includes("younger")));
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].characterStates[0].lifeStage = "settled into the work";
  const { issues } = build(raw);
  ok("unrecognised stages produce no false finding", !issues.some((i) => i.kind === "life-state"));
}

section("Milestones - nothing is earned by the future");
{
  const raw = twoPhaseRaw();
  raw.milestones[0].provingSceneNumbers = [8, 22, 44, 47];
  const { journey, issues } = build(raw);
  ok("forward references are dropped", journey?.milestones[0].provingSceneNumbers.every((n) => n < 40));
  ok("and reported", issues.some((i) => i.kind === "milestone" && i.title.includes("come after it")));
}
{
  const raw = twoPhaseRaw();
  raw.milestones[0].atScene = 999;
  const { journey } = build(raw);
  ok("a milestone outside the timeline is dropped", journey?.milestones.length === 0);
}
{
  const { journey } = build(twoPhaseRaw());
  ok("milestone is attributed to its phase", journey?.milestones[0].phaseNumber === 2);
}

section("Routines");
{
  const raw = twoPhaseRaw();
  raw.routines[0].variationAcrossStory = "";
  const { issues } = build(raw);
  ok("a routine without variation is a warning", issues.some((i) => i.kind === "routine"));
}

section("Aspirations");
{
  const raw = twoPhaseRaw();
  raw.aspirations[0].resolvesAtPhase = 9;
  const { journey, issues } = build(raw);
  ok("resolution is clamped into the story", journey?.aspirations[0].resolvesAtPhase === 2);
  ok("and reported", issues.some((i) => i.kind === "aspiration"));
}
{
  const raw = twoPhaseRaw();
  raw.aspirations[0].outcome = "nonsense";
  const { journey } = build(raw);
  ok("an unknown outcome falls back safely", journey?.aspirations[0].outcome === "achieved");
}
{
  const { journey } = build(twoPhaseRaw());
  ok("relinquished is a first-class outcome", journey?.aspirations[0].outcome === "relinquished");
}

section("Reading life state - the single accessor");
{
  const { journey } = build(twoPhaseRaw());

  ok(
    "phase 1 reads the phase's own statement",
    lifeStateAt({ journey, socialGraph: SOCIAL_GRAPH, characterId: "Karela", phaseNumber: 1 })?.occupation === "tailor"
  );
  ok(
    "phase 2 reads the override",
    lifeStateAt({ journey, socialGraph: SOCIAL_GRAPH, characterId: "Bhindi", phaseNumber: 2 })?.occupation === "delivery work"
  );
  ok(
    "lookup is case-insensitive",
    lifeStateAt({ journey, socialGraph: SOCIAL_GRAPH, characterId: "karela", phaseNumber: 2 })?.lifeStage === "adult"
  );
  ok(
    "an unknown character yields null",
    lifeStateAt({ journey, socialGraph: SOCIAL_GRAPH, characterId: "Nobody", phaseNumber: 1 }) === null
  );

  // A phase only needs to state what CHANGED, so an unmentioned character
  // falls back to the most recent phase that did mention them.
  const sparse = build({
    ...twoPhaseRaw(),
    phases: [
      twoPhaseRaw().phases[0],
      { ...twoPhaseRaw().phases[1], characterStates: [{ characterId: "Karela", lifeStage: "adult" }] },
    ],
  }).journey;
  ok(
    "an unmentioned character falls back to the previous phase",
    lifeStateAt({ journey: sparse, socialGraph: SOCIAL_GRAPH, characterId: "Bhindi", phaseNumber: 2 })?.occupation === "tailor"
  );

  ok(
    "household state is read the same way",
    householdLifeStateAt({ journey, householdId: "household_1", phaseNumber: 2 })?.livelihood === "piecework and delivery"
  );
}
{
  // The dormant path: no journey at all, so life state comes from the graph.
  const state = lifeStateAt({ journey: null, socialGraph: SOCIAL_GRAPH, characterId: "Karela", phaseNumber: 1 });
  ok("with no journey, life state projects from the social graph", state?.lifeStage === "young adult");
  ok("and carries its responsibilities", state?.responsibilities?.[0] === "opening the shop");
}

section("Scene lookups");
{
  const { journey } = build(twoPhaseRaw());
  ok("scene 1 is in phase 1", phaseForScene(journey, 1)?.phaseNumber === 1);
  ok("scene 24 is still phase 1", phaseForScene(journey, 24)?.phaseNumber === 1);
  ok("scene 25 is phase 2", phaseForScene(journey, 25)?.phaseNumber === 2);
  ok("a scene outside the film has no phase", phaseForScene(journey, 99) === null);

  ok("the jump sits before scene 25", timeJumpBeforeScene(journey, 25)?.afterScene === 24);
  ok("no jump before scene 24", timeJumpBeforeScene(journey, 24) === null);
  ok("jumpsBetween finds the seam", Boolean(jumpsBetween(journey, 24, 25)));
  ok("jumpsBetween ignores non-consecutive scenes", jumpsBetween(journey, 20, 25) === null);

  ok("story time reflects the phase", storyTimeForScene(journey, 30).phaseNumber === 2);
  ok("day index starts at zero", storyTimeForScene(journey, 30).dayIndex === 0);
}
{
  // The guarantee that makes every phase-aware check degrade to old behaviour.
  const marker = storyTimeForScene(null, 42);
  ok("with no journey every scene is phase 1 / day 0", marker.phaseNumber === 1 && marker.dayIndex === 0);
  ok("and no scene has a jump before it", timeJumpBeforeScene(null, 42) === null);
}

section("Report");
{
  const { journey, issues } = build(twoPhaseRaw());
  const report = buildLifeJourneyReport(journey, issues, 48);
  ok("phase count", report.phaseCount === 2);
  ok("scene counts per phase", report.scenesPerPhase[0].scenes === 24 && report.scenesPerPhase[1].scenes === 24);
  ok("jump count", report.timeJumpCount === 1);
  ok("milestone counted", report.milestoneCount === 1);
  ok("a milestone proven across phases is earned", report.unearnedMilestones.length === 0);
}
{
  const raw = twoPhaseRaw();
  raw.milestones[0].provingSceneNumbers = [33];
  const { journey, issues } = build(raw);
  const report = buildLifeJourneyReport(journey, issues, 48);
  ok("a thinly-proven milestone is unearned", report.unearnedMilestones.includes(40));
  ok("and explained", report.issues.some((i) => i.title.includes("is not earned")));
}
{
  const report = buildLifeJourneyReport(undefined, [], 12);
  ok("a story with no journey still reports one phase", report.phaseCount === 1);
  ok("covering every scene", report.scenesPerPhase[0].scenes === 12);
  ok("with no jumps", report.timeJumpCount === 0);
}
ok("summary line for a dormant story", summariseLifeJourney(null).includes("single episode"));

section("Dev report rendering");
{
  const { journey, issues } = build(twoPhaseRaw());
  const report = buildLifeJourneyReport(journey, issues, 48);
  const md = buildLifeJourneySection({ journey, report, scope: "Auto" });

  ok("renders the phase table", md.includes("| Phase | Title | Scenes | Chapters | Entry jump |"));
  ok("names both ends of the life", md.includes("Opening life:") && md.includes("Closing life:"));
  ok("shows the jump and how it is shown", md.includes("After scene 24") && md.includes("rusted"));
  ok("shows life state per phase", md.includes("delivery work"));
  ok("shows the aspiration outcome", md.includes("relinquished"));
  ok("shows what proved the milestone", md.includes("proven by: S8, S22, S33"));
  ok("shows routine variation", md.includes("varies:"));
}
{
  // The dormant path must still render, and must still explain itself.
  const single = build({ ...twoPhaseRaw(), phases: [twoPhaseRaw().phases[0]] });
  const report = buildLifeJourneyReport(single.journey, single.issues, 48);
  const md = buildLifeJourneySection({ journey: single.journey, report, scope: "Auto" });

  ok("a story with no journey still renders", md.includes("Single episode"));
  ok("and explains why there is none", md.includes("single phase"));
}
{
  const raw = twoPhaseRaw();
  raw.phases[1].entryJump.screenTreatment = "";
  const { journey, issues } = build(raw);
  const md = buildLifeJourneySection({ journey, report: buildLifeJourneyReport(journey, issues, 48) });
  ok("an unshown jump is called out in the report", md.includes("NOT SHOWN ON SCREEN"));
}
{
  const raw = twoPhaseRaw();
  raw.milestones[0].provingSceneNumbers = [33];
  const { journey, issues } = build(raw);
  const md = buildLifeJourneySection({ journey, report: buildLifeJourneyReport(journey, issues, 48) });
  ok("an unearned milestone is flagged in the report", md.includes("UNEARNED"));
}

// ---------------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
