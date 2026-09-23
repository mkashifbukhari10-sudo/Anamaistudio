import { buildQualityGateReport, summariseQualityGate } from "../src/server/story/quality-gate.js";
import {
  buildActionDensityReport,
  measureActionDensity,
  BEAT_LIMITS,
  RELOCATION_LIMIT,
} from "../src/server/story/action-density.js";
import { buildDistinctivenessReport } from "../src/server/story/scene-distinctiveness.js";
import { buildFeasibilityReport } from "../src/server/story/performance-budget.js";
import { buildSceneContractReport } from "../src/server/story/scene-contract.js";
import { buildBeatDensityReport } from "../src/server/story/beat-density.js";
import {
  ALL_ACTION_FIXTURES,
  OVERLOADED_FIXTURES,
  RENDERABLE_FIXTURES,
  ROMAN_URDU_RENDERABLE,
  ROMAN_URDU_OVERLOADED,
  UNREADABLE_ACTIONS,
} from "./fixtures/action-fixtures.js";
import { BAD_FIXTURES, NEGATIVE_FIXTURES } from "./fixtures/story-fixtures.js";

/**
 * P4 regression suite — Story Quality Gate + Action Density.
 *
 * Offline. Fixtures only, no API calls.
 *
 * The gate consumes P0–P3; these tests feed it real report objects built by
 * those modules rather than hand-written stubs, so a change in any upstream
 * layer that would break the gate shows up here.
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
// Helpers: build a story and run the whole stack over it, as production does.
// ---------------------------------------------------------------------------

function contract(over: Record<string, unknown> = {}): any {
  return {
    goal: "Karela wants the shutter up before the rain",
    obstacle: "It has stuck since the winter",
    outcome: "partial",
    performanceType: "dialogue-scene",
    progression: {
      kind: "progress",
      value: "the shop day",
      before: "not begun",
      after: "half open",
    },
    ...over,
  };
}

/**
 * A scene that is genuinely DIFFERENT from its neighbours.
 *
 * Deliberately varied on every dimension the distinctiveness engine reads.
 * An earlier version of this helper changed only the scene number inside
 * otherwise identical strings - and the gate correctly reported the result as
 * near-duplicates, which is the behaviour being tested elsewhere. A "good
 * story" fixture has to actually be a good story.
 */
const VARIED = [
  { act: "Karela drags the stuck shutter up with both hands", goal: "get the shop open before the rain", obs: "the shutter has stuck since winter", place: "place_shop", cast: ["Karela"], line: "Aaj jaldi kholna hai" },
  { act: "Bhindi counts yesterday's coins into a tin on the counter", goal: "find out how short they are", obs: "she already knows the answer", place: "place_shop", cast: ["Bhindi"], line: "Teen sau kam" },
  { act: "A customer sets a torn shirt down and waits", goal: "take the work without promising a date", obs: "there is no thread left", place: "place_shop", cast: ["Karela"], line: "Kal tak dekhta hoon" },
  { act: "Mirchi runs in from the lane with a folded notice", goal: "hand over the paper before she is told off", obs: "she read it on the way", place: "place_gali", cast: ["Mirchi", "Bhindi"], line: "Yeh darwaze par tha" },
  { act: "Karela reads the notice by the window and folds it away", goal: "keep the news from the others tonight", obs: "Bhindi is watching him read it", place: "place_room", cast: ["Karela", "Bhindi"], line: "Kuch nahi hai" },
  { act: "Bhindi lifts the tin down from the high shelf", goal: "put her own savings into the rent", obs: "he will refuse it", place: "place_room", cast: ["Bhindi"], line: "Yeh mera hai" },
  { act: "The landlord's man chalks a mark on the doorframe", goal: "leave without being drawn into an argument", obs: "the whole lane is watching", place: "place_gali", cast: ["Karela"], line: "Nishan lagana zaroori tha" },
  { act: "Mirchi scrubs the chalk mark off the doorframe alone", goal: "undo it before anyone else sees", obs: "the chalk has soaked into the wood", place: "place_gali", cast: ["Mirchi"], line: "Nikal nahi raha" },
  { act: "Karela sits on the step with the ledger closed on his knees", goal: "decide whether to tell them tonight", obs: "he has decided four times already", place: "place_step", cast: ["Karela"], line: "Andar chalo" },
  { act: "The family eats without anyone mentioning the notice", goal: "get through one meal normally", obs: "the folded paper is on the shelf behind them", place: "place_room", cast: ["Karela", "Bhindi", "Mirchi"], line: "Roti aur hai" },
];

const KINDS = ["information", "decision", "emotional", "discovery", "setback", "payoff", "reversal", "escalation", "obstacle", "consequence"];

function scene(n: number, over: Record<string, unknown> = {}): any {
  const v = VARIED[(n - 1) % VARIED.length];
  return {
    sceneNumber: n,
    purpose: `${v.goal}, against ${v.obs}`,
    storyFunction: `${v.act} — and ${v.goal} moves on`,
    characterActions: v.act,
    facialExpressions: "steady",
    charactersPresent: v.cast,
    setupOrPayoff: `plants something for scene ${n + 4}`,
    socialChanges: [{ characterA: "Karela", characterB: "Bhindi", dimension: "trust", change: "warmer" }],
    transitionType: "CUT",
    dialogueTurns: [{ speaker: v.cast[0], line: v.line }],
    continuityState: { placeId: v.place, cameraState: { shotSize: "medium", movement: "static", screenDirection: "left-to-right" } },
    contract: contract({
      goal: v.goal,
      obstacle: v.obs,
      progression: {
        kind: KINDS[(n - 1) % KINDS.length],
        value: `${v.goal.split(" ").slice(0, 3).join(" ")}`,
        before: `${v.obs} still stands`,
        after: `${v.goal} has moved`,
      },
    }),
    ...over,
  };
}

function runGate(scenes: any[], blueprint?: any) {
  const distinctiveness = buildDistinctivenessReport({ scenes, characters: [], setups: blueprint?.setups ?? [] });
  const feasibility = buildFeasibilityReport(scenes, "Roman Urdu");
  const actionDensity = buildActionDensityReport(scenes);
  const contracts = buildSceneContractReport({ scenes });
  const beatDensity = blueprint?.beats
    ? buildBeatDensityReport({ beats: blueprint.beats, targetSceneCount: scenes.length })
    : null;

  return buildQualityGateReport({
    scenes,
    blueprint,
    distinctiveness,
    feasibility,
    actionDensity,
    contracts,
    beatDensity,
    storyQuality: { unpaidSetups: [] },
  });
}

const codes = (r: ReturnType<typeof buildQualityGateReport>) => new Set(r.findings.map((f) => f.code));

// ---------------------------------------------------------------------------
section("Action density — overloaded fixtures must be flagged");
for (const f of OVERLOADED_FIXTURES) {
  const m = measureActionDensity(f.scene);
  ok(`${f.name}: overloaded`, m.overloaded, `${m.sequentialBeats} beats / ${m.relocations} reloc / limit ${m.limit}`);
  ok(`${f.name}: confident`, m.confident);
}

section("Action density — renderable staging must NOT be flagged");
for (const f of RENDERABLE_FIXTURES) {
  const m = measureActionDensity(f.scene);
  ok(`${f.name}: renderable`, !m.overloaded, `${m.sequentialBeats} beats / ${m.relocations} reloc / limit ${m.limit}`);
}

section("Action density — the distinction that matters");
{
  const simultaneous = measureActionDensity(
    RENDERABLE_FIXTURES.find((f) => f.name === "busy-frame-with-background")!.scene
  );
  ok("simultaneous strands are counted separately", simultaneous.simultaneousStrands >= 1);
  ok("and never inflate the beat count", simultaneous.sequentialBeats <= 2, String(simultaneous.sequentialBeats));
}
{
  const compound = measureActionDensity(
    RENDERABLE_FIXTURES.find((f) => f.name === "continuous-compound-action")!.scene
  );
  ok("a four-verb action in ONE place is renderable", !compound.overloaded);
  ok("because it has no relocations", compound.relocations === 0);
}
{
  const tour = measureActionDensity(OVERLOADED_FIXTURES.find((f) => f.name === "fetch-and-return")!.scene);
  ok("an errand across places is overloaded", tour.overloaded);
  ok("because the actor relocates", tour.relocations >= RELOCATION_LIMIT);
}
{
  // performanceType must change the verdict, not just the label.
  const text =
    "Karela lifts the shutter, steps out into the lane and sweeps the step, then goes back inside and sets the stool down.";
  const asAction = measureActionDensity({ sceneNumber: 1, characterActions: text, contract: { performanceType: "action" } });
  const asMontage = measureActionDensity({ sceneNumber: 1, characterActions: text, contract: { performanceType: "montage-element" } });
  ok("the same staging is judged against its type", asMontage.limit < asAction.limit);
  ok("montage limit is stricter", BEAT_LIMITS["montage-element"] < BEAT_LIMITS.action);
}

section("Action density — Roman Urdu");
for (const f of ROMAN_URDU_RENDERABLE) {
  const m = measureActionDensity(f.scene);
  ok(`${f.name}: renderable`, !m.overloaded, `${m.sequentialBeats} beats / ${m.relocations} reloc / limit ${m.limit}`);
  ok(`${f.name}: classified`, m.confident, "a real Roman Urdu line must not fall through as unreadable");
}
for (const f of ROMAN_URDU_OVERLOADED) {
  const m = measureActionDensity(f.scene);
  ok(`${f.name}: overloaded`, m.overloaded, `${m.sequentialBeats} beats / ${m.relocations} reloc / limit ${m.limit}`);
}

section("Roman Urdu — the distinction that matters");
{
  // Participles BIND: "uthate hue ... chalti hai" is walking WHILE carrying.
  const participle = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Tamatar tokri uthate hue darwaze ki taraf chalti hai.",
    contract: { performanceType: "action" },
  });
  ok("a participle chain is ONE beat", participle.sequentialBeats === 1, String(participle.sequentialBeats));
  ok("and is renderable", !participle.overloaded);

  // Finite verbs in series are separate beats.
  const series = measureActionDensity({
    sceneNumber: 2,
    characterActions:
      "Tamatar tokri uthati hai, aangan paar karti hai, almari kholti hai, tokri andar rakhti hai, phir darwaza band karti hai.",
    contract: { performanceType: "action" },
  });
  ok("finite verbs in series are separate beats", series.sequentialBeats === 5, String(series.sequentialBeats));
  ok("and are overloaded", series.overloaded);
}
{
  const conjunctive = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Nazar Bitto ke haathon se patangon ke bundle utha kar unhe pharsh par halke se patakta hai.",
    contract: { performanceType: "action" },
  });
  ok("'kar' binds a compound action into one beat", conjunctive.sequentialBeats === 1, String(conjunctive.sequentialBeats));
}
{
  const jabki = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Razia tin kholti hai, jabki Sultan darwaze ki taraf mudta hai.",
    contract: { performanceType: "dialogue-scene" },
  });
  ok("'jabki' marks parallel staging", jabki.simultaneousStrands >= 1);

  const usiWaqt = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Nikku drum uthata hai aur usi waqt Chintu ki patang hawa mein uchhalti hai.",
    contract: { performanceType: "action" },
  });
  ok("'usi waqt' marks parallel staging", usiWaqt.simultaneousStrands >= 1);
}
{
  // A different named actor joined by 'aur' is two people in one frame.
  const twoActors = measureActionDensity({
    sceneNumber: 1,
    characterActions:
      "Razia shelf se kagaz ki roll utaar kar takht par rakh deti hai aur Sultan der tak khara reh kar use dekhta hai.",
    contract: { performanceType: "dialogue-scene" },
  });
  ok("a second named actor is parallel, not sequential", twoActors.simultaneousStrands >= 1);
  ok("and does not overload the shot", !twoActors.overloaded);
}
{
  const variants = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Razia tokree utha kar kamray ke andar chalee jaatee hai.",
    contract: { performanceType: "action" },
  });
  ok("doubled-vowel spelling variants are understood", variants.confident && variants.sequentialBeats >= 1);
}
ok(
  "'paar' (across) is not confused with 'par' (on)",
  measureActionDensity({ sceneNumber: 1, characterActions: "Nikku aangan paar karta hai aur almari kholta hai", contract: { performanceType: "action" } }).relocations === 1
);
{
  const mixed = measureActionDensity({
    sceneNumber: 1,
    characterActions: "Nikku picks up the tin dabba aur darwaze ki taraf chalta hai.",
    contract: { performanceType: "action" },
  });
  ok("a mixed English/Roman Urdu line is classified", mixed.confident);
  ok("and read as one continuous action", !mixed.overloaded);
}

section("Action density — honesty about what it cannot read");
for (const [i, text] of UNREADABLE_ACTIONS.entries()) {
  const m = measureActionDensity({ sceneNumber: i + 1, characterActions: text, contract: { performanceType: "action" } });
  ok(`unreadable language ${i + 1} stays unclassified`, m.confident === false);
  ok(`unreadable language ${i + 1} is not reported clean`, m.overloaded === false && m.sequentialBeats === 0);
}
{
  // This line is taken verbatim from the first post-P3 generation. It used to
  // come back unclassified because the vocabulary was English-only; it is now
  // read properly, which is the whole point of the Roman Urdu support.
  const urdu = measureActionDensity({
    sceneNumber: 1,
    characterActions:
      "Nazar ka khali thela gali ke modh par rukta hai aur woh thele ke peechay khara reh kar darwaze par khare parivar ko dekhta hai",
    contract: { performanceType: "dialogue-scene" },
  });
  ok("a real Roman Urdu action line is now classified", urdu.confident === true);
  ok("and is read as renderable staging", urdu.overloaded === false);

  const report = buildActionDensityReport([
    { sceneNumber: 1, characterActions: "Nazar ka thela gali ke modh par rukta hai aur woh khara reh kar dekhta hai" },
  ]);
  ok("the report classifies it", report.unclassified.length === 0);
  ok("and claims no overloaded scenes", report.overloaded.length === 0);
}
ok("a very short action line is unclassified", measureActionDensity({ sceneNumber: 1, characterActions: "Golu sits." }).confident === false);
ok("malformed input does not throw", buildActionDensityReport([null, 7, undefined] as any).scenes.length === 0);

// ---------------------------------------------------------------------------
section("Gate — GOOD stories produce no severe findings");
{
  const scenes = Array.from({ length: 6 }, (_, i) => scene(i + 1));
  const r = runGate(scenes);
  ok("no blocking findings", r.blocked === 0, JSON.stringify([...codes(r)]));
  ok("no repair candidates", r.repairCandidates.length === 0, JSON.stringify(r.repairCandidates));
  ok("not degraded", r.degraded === false);
  ok("evidence records what was available", r.evidence.contracts && r.evidence.feasibility && r.evidence.distinctiveness);
}
{
  const silent = scene(1, {
    dialogueTurns: [],
    contract: contract({ performanceType: "silent-emotional" }),
    characterActions: "Karela sets the folded shirt down on the counter without looking up",
  });
  const r = runGate([silent, scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) })]);
  const aboutScene1 = (code: string) => r.findings.some((f) => f.code === code && f.sceneNumbers.includes(1));
  ok("a silent scene is never reported for being silent", !aboutScene1("dialogue-underfilled"));
  ok("and not reported as overloaded", !aboutScene1("action-overloaded"));
}
{
  const reaction = scene(1, {
    dialogueTurns: [{ speaker: "Karela", line: "Kya" }],
    contract: contract({ performanceType: "reaction" }),
    characterActions: "Karela's hand stops halfway to the shutter handle",
  });
  const r = runGate([reaction, scene(2, { contract: contract({ progression: { kind: "emotional", value: "v2", before: "b2", after: "a2" } }) })]);
  ok("a reaction scene is not punished for minimal dialogue", !r.findings.some((f) => f.code === "dialogue-underfilled" && f.sceneNumbers.includes(1)));
}
{
  // CHAIN with correct screen direction must be silent.
  const a = scene(1, { transitionType: "CUT" });
  const b = scene(2, { transitionType: "CHAIN", continuityIssues: [] });
  const r = runGate([a, b]);
  ok("a clean CHAIN raises nothing", !codes(r).has("chain-screen-direction-reversed"));
}

// ---------------------------------------------------------------------------
section("Gate — BAD stories produce the right findings");
{
  const r = runGate(BAD_FIXTURES.find((f) => f.name === "repeated-jogging")!.scenes as any[]);
  ok("a repetition run is caught", codes(r).has("repetition-run"));
  ok("a long run blocks", r.blocked > 0, `blocked=${r.blocked}`);
}
{
  const scenes = [
    scene(1, { contract: contract({ progression: { kind: "progress", value: "the shop day", before: "not begun", after: "half open" } }) }),
    scene(2, { contract: contract({ progression: { kind: "progress", value: "the shop day", before: "half open", after: "half open now" } }) }),
  ];
  const r = runGate(scenes);
  ok("consecutive scenes doing the same job are caught", codes(r).has("consecutive-same-dramatic-job"));
  ok("and become repair candidates", r.repairCandidates.includes(2));
}
{
  const scenes = [
    scene(1, {
      dialogueTurns: Array.from({ length: 6 }, (_, i) => ({ speaker: "Karela", line: `Yeh baat bilkul theek hai aur hum sab jaante hain ${i}` })),
    }),
    scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) }),
  ];
  const r = runGate(scenes);
  ok("dialogue that cannot be spoken is caught", codes(r).has("dialogue-overruns-shot"));
  ok("and is a repair candidate", r.repairCandidates.includes(1));
}
{
  const scenes = [
    scene(1, { contract: contract({ outcome: "achieved", progression: { kind: "setback", value: "the money", before: "enough", after: "short" } }) }),
    scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) }),
  ];
  const r = runGate(scenes);
  ok("an outcome contradicting the change is caught", codes(r).has("outcome-contradicts-progression"));
}
{
  const scenes = [
    scene(1, { socialChanges: [], contract: contract({ progression: { kind: "relationship", value: "trust", before: "thin", after: "thinner" } }) }),
    scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) }),
  ];
  const r = runGate(scenes);
  ok("a relationship claim with no delta is noted", codes(r).has("relationship-change-uncorroborated"));
  ok("as info, not a failure", r.findings.find((f) => f.code === "relationship-change-uncorroborated")?.severity === "info");
}
{
  const blueprint = {
    beats: [
      {
        beatNumber: 1, name: "B", sceneStart: 1, sceneEnd: 2, distinctScenesNeeded: 2,
        whatEachSceneDoes: [
          "Karela discovers the landlord has sold the building to a developer",
          "Bhindi refuses to sign the eviction paperwork in front of the clerk",
        ],
      },
    ],
  };
  const scenes = [
    scene(1, { purpose: "unrelated", storyFunction: "unrelated", characterActions: "Karela lifts the shutter handle", contract: contract({ goal: "open the shutter", progression: { kind: "progress", value: "shop day", before: "shut", after: "open" } }) }),
    scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) }),
  ];
  const r = runGate(scenes, blueprint);
  ok("a planned move that was not executed is caught", codes(r).has("planned-move-not-executed"), JSON.stringify([...codes(r)]));
}
{
  const scenes = [
    scene(1, { transitionType: "CUT" }),
    scene(2, {
      transitionType: "CHAIN",
      continuityIssues: [
        { sceneNumber: 2, dimension: "camera", title: "Screen direction flips across an unbroken join", previousState: "", currentState: "", suggestedFix: "", severity: "warning" },
      ],
    }),
  ];
  const r = runGate(scenes);
  ok("a CHAIN with reversed screen direction blocks", codes(r).has("chain-screen-direction-reversed"));
  ok("because the join cannot be rendered", r.blocked > 0);
}
{
  const overloaded = scene(1, {
    characterActions: OVERLOADED_FIXTURES[0].scene.characterActions,
    contract: contract({ performanceType: "silent-emotional" }),
    dialogueTurns: [],
  });
  const r = runGate([overloaded, scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) })]);
  ok("staging that needs an edit is caught", codes(r).has("action-overloaded"));
}
{
  const scenes = Array.from({ length: 10 }, (_, i) =>
    scene(i + 1, {
      purpose: `Distinct purpose ${i + 1} entirely different subject`,
      storyFunction: `Distinct change ${i + 1}`,
      characterActions: `Karela ${["lifts", "counts", "wipes", "folds", "opens", "locks", "sweeps", "stacks", "ties", "pours"][i]} something carefully now`,
      dialogueTurns: [
        { speaker: "Karela", line: `Line ${i} one` },
        { speaker: "Bhindi", line: `Line ${i} two` },
        { speaker: "Karela", line: `Line ${i} three` },
      ],
      contract: contract({ progression: { kind: ["information", "decision", "emotional", "discovery", "setback", "payoff", "reversal", "escalation", "obstacle", "consequence"][i], value: `v${i}`, before: `b${i}`, after: `a${i}` } }),
    })
  );
  const r = runGate(scenes);
  ok("uniform dialogue density is caught at story level", codes(r).has("uniform-dialogue-density"));
}

section("Gate — legitimate repetition is respected");
for (const fixture of NEGATIVE_FIXTURES) {
  const r = runGate(fixture.scenes as any[]);
  ok(
    `${fixture.name}: no repetition finding`,
    !codes(r).has("repetition-run") && !codes(r).has("near-duplicate-scenes"),
    JSON.stringify([...codes(r)])
  );
}

section("Gate — scene necessity needs COMBINED evidence");
{
  // Quiet but necessary: no setup/payoff and no social change is only TWO
  // signals, and a quiet scene must never be called filler for being quiet.
  const quiet = scene(1, {
    setupOrPayoff: "",
    socialChanges: [],
    dialogueTurns: [],
    contract: contract({ performanceType: "silent-emotional", progression: { kind: "emotional", value: "resolve", before: "wavering", after: "settled" } }),
  });
  const r = runGate([quiet, scene(2, { contract: contract({ progression: { kind: "discovery", value: "v2", before: "b2", after: "a2" } }) })]);
  ok("two signals are not enough to doubt a scene", !codes(r).has("scene-necessity-doubtful"));
}

// ---------------------------------------------------------------------------
section("Backward compatibility");
{
  const contractless = [
    { sceneNumber: 1, purpose: "a", storyFunction: "b", characterActions: "Karela lifts the shutter and pulls it up", dialogueTurns: [{ speaker: "K", line: "Aaj" }], continuityState: { placeId: "p" } },
    { sceneNumber: 2, purpose: "c", storyFunction: "d", characterActions: "Bhindi counts the coins into the tin", dialogueTurns: [{ speaker: "B", line: "Kal" }], continuityState: { placeId: "p" } },
  ];
  const r = runGate(contractless);
  ok("a contract-less story is degraded", r.degraded === true);
  ok("and raises no contract findings", !codes(r).has("consecutive-same-dramatic-job") && !codes(r).has("outcome-contradicts-progression"));
  ok("evidence says contracts were absent", r.evidence.contracts === false);
  ok("but feasibility still ran", r.evidence.feasibility === true);
  ok("the summary says it is degraded", summariseQualityGate(r).includes("degraded") || summariseQualityGate(r).includes("not evaluated"));
}
{
  const partial = [
    scene(1),
    { sceneNumber: 2, purpose: "x", storyFunction: "y", characterActions: "Bhindi counts the coins into the tin", dialogueTurns: [], continuityState: { placeId: "p" } },
  ];
  const r = runGate(partial);
  ok("a half-migrated story is not degraded", r.degraded === false);
  ok("and does not invent a contract for the bare scene", !r.findings.some((f) => f.code === "contract-unusable" && f.sceneNumbers.includes(2)));
}
{
  const r = buildQualityGateReport({ scenes: [] });
  ok("an empty story returns an empty report", r.findings.length === 0);
  ok("and is degraded", r.degraded === true);
}
ok("malformed scenes do not throw", buildQualityGateReport({ scenes: [null, 7] as any }).findings.length === 0);
ok("missing optional layers do not throw", buildQualityGateReport({ scenes: [scene(1), scene(2)] }).findings !== undefined);
{
  const r = buildQualityGateReport({
    scenes: [scene(1)],
    distinctiveness: null,
    feasibility: null,
    actionDensity: null,
    contracts: null,
    beatDensity: null,
  });
  ok("explicit nulls degrade cleanly", r.degraded === true && r.findings.length === 0);
}

// ---------------------------------------------------------------------------
section("Gate — report-only guarantees");
{
  const scenes = [scene(1), scene(2)];
  const before = JSON.stringify(scenes);
  runGate(scenes);
  ok("scenes are never mutated", JSON.stringify(scenes) === before);
}
{
  const r = runGate(BAD_FIXTURES.find((f) => f.name === "repeated-jogging")!.scenes as any[]);
  ok("blocking findings are still returned, not thrown", r.findings.length > 0);
  ok("blocked is a count, not a signal to stop", typeof r.blocked === "number");
}
{
  // Continuity noise is recorded separately, never promoted to quality.
  const scenes = [
    scene(1),
    scene(2, {
      transitionType: "CUT",
      continuityIssues: [
        { sceneNumber: 2, dimension: "location", title: "Location changes on an unbroken join", previousState: "", currentState: "", suggestedFix: "", severity: "warning" },
        { sceneNumber: 2, dimension: "time", title: "Time of day moves backwards", previousState: "", currentState: "", suggestedFix: "", severity: "warning" },
      ],
    }),
  ];
  const r = runGate(scenes);
  ok("known-noisy continuity findings are counted separately", r.continuityNoise === 2);
  ok("and are not turned into quality findings", !codes(r).has("chain-join-unrenderable"));
}

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) {
  console.log("Failures:");
  failures.forEach((f) => console.log(`  - ${f}`));
}
process.exit(fail === 0 ? 0 : 1);
