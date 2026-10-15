import { buildActionDensityReport } from "../src/server/story/action-density.js";
import { buildQualityGateReport } from "../src/server/story/quality-gate.js";
import { buildFeasibilityReport } from "../src/server/story/performance-budget.js";
import { POULTRY_PACK } from "../src/server/packs/index.js";

/**
 * WORDLESS FILM regression suite.
 *
 * Every string below is taken from the first real wordless generation
 * (test-output/2026-10-15, "Malka Aur Uskay Choozay"), not invented. That film
 * came back correct in the ways that mattered - 24 of 24 scenes silent, the
 * chick count held, zero distinctiveness flags - and wrong in exactly two
 * measurable ways, both of which are pinned here:
 *
 *   1. Two scenes went UNMEASURED because "pounces" and "charges" were not in
 *      the staging vocabulary. The report blamed the action line's language,
 *      which was English. In a film with no dialogue the action line is the
 *      only thing the quality layer can read, so an unlisted verb means a shot
 *      gets no signal at all.
 *   2. All six `unrenderable-proper-noun` warnings were false positives. The
 *      blueprint registered its places with plain English descriptive names,
 *      the prompts then used those words as ordinary prose - "a terracotta
 *      grain dish" - and a case-insensitive match flagged correct writing.
 *
 * The vegetable films' TRUE positives are pinned alongside them, because the
 * only way to get these two wrong is to fix one film by breaking the other.
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
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}`);
}

// ---------------------------------------------------------------------------
console.log("\nstaging vocabulary — how animals move");
// ---------------------------------------------------------------------------

/** Verbatim action lines from the generation, with the scene they came from. */
const REAL_ACTIONS: Array<[number, string]> = [
  [9, "Cheeku pounces with outstretched claws toward the emerald grasshopper, but freezes mid-hop as a massive black silhouette of ragged crow wings blankets the grass in darkness"],
  [10, "Cheeku scrambles frantically on his belly into a dense tangle of dry blackberry brambles, then Kalu's heavy slate beak strikes the dirt two inches behind him"],
  [11, "Malka charges across the yard hearing Cheeku's cries, rams her broad chest full-force into the five-inch brick gap, but wedges rigidly between the rough mud bricks"],
];

const realScenes = REAL_ACTIONS.map(([n, characterActions]) => ({
  sceneNumber: n,
  charactersPresent: ["Malka", "Cheeku", "Kalu"],
  characterActions,
  dialogueTurns: [],
}));

const realReport = buildActionDensityReport(realScenes as any);
ok(
  "the three real action lines all classify",
  realReport.unclassified.length === 0,
  `unclassified: ${JSON.stringify(realReport.unclassified)}`
);
ok(
  "no scene is left with unrecognised phrasing",
  !realReport.unclassifiedByReason["unrecognised-phrasing"]?.length
);

/**
 * The verbs themselves, each as the opening verb of a plain staged beat.
 * Stemming is the trap: `tokenize` turns "pounces" into "pounc", never
 * "pounce", so a vocabulary holding only the dictionary form silently misses
 * every inflected use.
 */
const CREATURE_VERBS = [
  "pounces", "charges", "leaps", "pecks", "flaps", "darts", "swoops",
  "scrambles", "perches", "huddles", "scratches", "broods", "nestles",
  "tucks", "hops", "flutters", "struts", "preens", "rams", "snaps",
  "dives", "lunges", "plunges", "chases", "freezes", "waddles", "nudges",
  "wedges", "ruffles", "thrashes",
];

const verbScenes = CREATURE_VERBS.map((verb, i) => ({
  sceneNumber: i + 1,
  charactersPresent: ["Malka"],
  characterActions: `Malka ${verb} toward the low mud wall beside the water trough`,
  dialogueTurns: [],
}));
const verbReport = buildActionDensityReport(verbScenes as any);
const missed = verbReport.unclassified.map((n) => CREATURE_VERBS[n - 1]);
ok(
  `all ${CREATURE_VERBS.length} creature verbs are in the staging vocabulary`,
  missed.length === 0,
  `missing: ${missed.join(", ")}`
);

// The original vocabulary must not have been disturbed.
const HUMAN_VERBS = ["walks", "lifts", "pours", "kneels", "sweeps", "wraps", "counts"];
const humanReport = buildActionDensityReport(
  HUMAN_VERBS.map((verb, i) => ({
    sceneNumber: i + 1,
    charactersPresent: ["Ammi"],
    characterActions: `Ammi ${verb} the clay pot across the kitchen floor`,
    dialogueTurns: [],
  })) as any
);
ok(
  "the original human-staging verbs still classify",
  humanReport.unclassified.length === 0,
  `unclassified: ${JSON.stringify(humanReport.unclassified)}`
);

// A non-English action line must still be reported, not quietly passed. The
// English-action rule in the poultry doctrine exists because of this path: in
// a wordless film an unmeasured action line means the shot has no quality
// signal at all.
//
// NOTE: language detection here is a separate, pre-existing concern with known
// slack - some Roman Urdu lines are read as English and classified. Widening
// the verb vocabulary neither caused nor touched that; none of the verbs added
// above appear in Urdu prose. This asserts only that the path still works.
const nonEnglish = buildActionDensityReport([
  { sceneNumber: 1, charactersPresent: ["Gajri"], characterActions: "Gajri ne chaadar uthayi aur chalne lagi", dialogueTurns: [] },
] as any);
ok(
  "a non-English action line is still unclassified",
  nonEnglish.unclassified.length === 1 &&
    nonEnglish.unclassifiedByReason["unsupported-language"]?.length === 1,
  JSON.stringify(nonEnglish.unclassifiedByReason)
);

// ---------------------------------------------------------------------------
console.log("\nunrenderable proper nouns — names, not descriptions");
// ---------------------------------------------------------------------------

/** The poultry film's registry: plain English descriptive names. */
const POULTRY_REGISTRY = {
  places: [
    { name: "The Sunlit Mud Courtyard" },
    { name: "The Henhouse Interior" },
    { name: "The Broken Brick Wall Gap" },
  ],
  entities: [{ name: "Terracotta Grain Dish" }, { name: "Dried Seed Gourd" }],
};

/** The vegetable films' registry: opaque story names. */
const VEGETABLE_REGISTRY = {
  places: [{ name: "Dhobi Chabootra" }, { name: "Gaon ka Chok" }],
  entities: [{ name: "Pital Ka Ghanta" }, { name: "Shahi Daig" }],
};

function properNounFindings(prompt: string, registry: any) {
  return buildQualityGateReport({
    scenes: [{ sceneNumber: 1, finalVideoPrompt: prompt }],
    worldRegistry: registry,
  }).findings.filter((f) => f.code === "unrenderable-proper-noun");
}

// --- the false positives this fix removes, verbatim from the real prompts ---
const DESCRIPTIVE_USES = [
  "a tiny pale-cream baby chick huddle near a terracotta grain dish. Camera tracks Malka's run",
  "Malka accidentally strikes a dried seed gourd hanging by jute twine from the low beam",
  "Malka steps firmly over the wooden threshold board into the sunlit mud courtyard",
  "an upright crimson comb stands beside a shallow terracotta grain dish. She meets her chick's eyes",
];
for (const prompt of DESCRIPTIVE_USES) {
  ok(
    `descriptive prose is not flagged: "${prompt.slice(0, 44)}…"`,
    properNounFindings(prompt, POULTRY_REGISTRY).length === 0
  );
}

// --- the true positives it must keep, verbatim from the vegetable films ---
const NAMED_USES = [
  "Distant behind them on Dhobi Chabootra, Pital Ka Ghanta rests silently under an old tree.",
  "The heavy Shahi Daig sits untouched at the edge of the gathering.",
  "Villagers cross Gaon ka Chok as the storm lifts.",
];
for (const prompt of NAMED_USES) {
  ok(
    `a real name IS flagged: "${prompt.slice(0, 44)}…"`,
    properNounFindings(prompt, VEGETABLE_REGISTRY).length === 1
  );
}

// --- the boundary cases the rule turns on ---
ok(
  "a capitalised name mid-sentence is flagged",
  properNounFindings("The camera pans across Dhobi Chabootra at dawn.", VEGETABLE_REGISTRY).length === 1
);
ok(
  "a leading article on the registry name does not prevent the match",
  properNounFindings("Malka crosses The Sunlit Mud Courtyard at dawn.", POULTRY_REGISTRY).length === 1,
  "capitalised use of a descriptively-named place is still name-like"
);
ok(
  "a single capitalised word opening a sentence is not enough",
  properNounFindings("Chabootra stones are wet with rinse water.", { places: [{ name: "Chabootra" }], entities: [] }).length === 0
);
ok(
  "that same single word IS flagged mid-sentence",
  properNounFindings("They gather on the Chabootra before dawn.", { places: [{ name: "Chabootra" }], entities: [] }).length === 1
);
ok(
  "an empty registry raises nothing",
  properNounFindings("a terracotta grain dish sits on the stone", { places: [], entities: [] }).length === 0
);
ok(
  "a malformed registry does not throw",
  (() => {
    try {
      properNounFindings("anything at all", { places: undefined, entities: null } as any);
      return true;
    } catch {
      return false;
    }
  })()
);

// ---------------------------------------------------------------------------
console.log("\na wordless film raises no speech findings");
// ---------------------------------------------------------------------------

const silentScenes = Array.from({ length: 12 }, (_, i) => ({
  sceneNumber: i + 1,
  charactersPresent: ["Malka", "Cheeku"],
  characterActions: "Malka spreads both wings wide and drives forward, then tucks the three chicks beneath her",
  dialogue: "None",
  dialogueTurns: [],
  contract: { performanceType: "silent-emotional" },
}));

const silentGate = buildQualityGateReport({
  scenes: silentScenes,
  feasibility: buildFeasibilityReport(silentScenes, "Roman Urdu"),
  actionDensity: buildActionDensityReport(silentScenes as any),
});
const codes = silentGate.findings.map((f) => f.code);

ok("uniform-dialogue-density does not fire on a silent film", !codes.includes("uniform-dialogue-density"));
ok("dialogue-underfilled does not fire", !codes.includes("dialogue-underfilled"));
ok("speaker-monologue does not fire", !codes.includes("speaker-monologue"));
ok("dialogue-overruns-shot does not fire", !codes.includes("dialogue-overruns-shot"));

// The guard must be the ZERO-turn case only: a real quota signature still fires.
const quotaScenes = Array.from({ length: 12 }, (_, i) => ({
  sceneNumber: i + 1,
  charactersPresent: ["Ammi", "Beta"],
  characterActions: "Ammi lifts the pot while Beta watches",
  contract: { performanceType: "dialogue-scene" },
  dialogueTurns: [
    { speaker: "Ammi", line: "Chalo beta, der ho rahi hai", accompanyingAction: "Ammi lifts the pot" },
    { speaker: "Beta", line: "Aa raha hoon Ammi, ek minute", accompanyingAction: "Beta ties his laces" },
  ],
}));
const quotaGate = buildQualityGateReport({
  scenes: quotaScenes,
  feasibility: buildFeasibilityReport(quotaScenes, "Roman Urdu"),
});
ok(
  "a real uniform-density quota still fires",
  quotaGate.findings.some((f) => f.code === "uniform-dialogue-density")
);

// ---------------------------------------------------------------------------
console.log("\nthe pack doctrine matches what the real film actually did");
// ---------------------------------------------------------------------------

const doctrine = POULTRY_PACK.extraDoctrine ?? "";
ok("chicks are named cast, not background", /NAME THE CHICKS AND PUT THEM IN THE CAST/.test(doctrine));
ok("background chicks still use backgroundCast", /backgroundCast/.test(doctrine));
ok("each chick keeps one fixed mark", /ONE fixed distinguishing mark/.test(doctrine));
ok("separation states the remaining count", /how many remain with the hen/.test(doctrine));

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
