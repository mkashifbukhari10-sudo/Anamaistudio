import { readFileSync } from "node:fs";
import {
  STORY_PACKS,
  DEFAULT_PACK_ID,
  resolvePack,
  isKnownPack,
  listPacks,
  buildCharacterReferencePackage,
  isWordless,
  speechFindingsApply,
  VEGETABLE_PACK,
  POULTRY_PACK,
} from "../src/server/packs/index.js";
import {
  PACKS as SHARED_PACKS,
  DEFAULT_PACK_ID as SHARED_DEFAULT_ID,
  findPack,
  isPackWordless,
} from "../src/shared/packs.js";
import {
  TOPIC_SUGGESTIONS,
  POULTRY_SUGGESTIONS,
  ALL_SUGGESTIONS,
} from "../src/data/suggestions.js";
/**
 * The StoryMode union, as data. Kept here rather than exported from types.ts
 * because the union is the source of truth and a second export would be a
 * second place to forget. A new mode added to the union and used in a
 * suggestion will fail typecheck before it reaches this list.
 */
const VALID_MODES: string[] = [
  "Cinematic Emotional",
  "Cinematic",
  "Heartwarming",
  "Emotional",
  "Friendship",
  "Moral Story",
  "Adventure",
  "Funny & Slapstick",
  "Mystery",
  "Fantasy",
  "Simple Kids Story",
];

/**
 * STORY PACK regression suite.
 *
 * The pack layer exists so a second film world costs a data file instead of a
 * fork. Its whole value depends on one promise: extracting the vegetable
 * domain out of app.ts did not change a single character of what the vegetable
 * path sends to the model.
 *
 * That promise is tested against `fixtures/reference-baseline.json`, captured
 * from the ORIGINAL private function in app.ts before any of this existed. If
 * a reviewer reworded a prompt while tidying the pack, this file fails - which
 * is the only way that mistake would ever be noticed, because the 979-assertion
 * craft suite does not read prompt wording.
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
console.log("\nregistry");
// ---------------------------------------------------------------------------

ok("vegetables is the default pack", DEFAULT_PACK_ID === "vegetables");
ok("the default is first in the list", STORY_PACKS[0].id === "vegetables");
ok("both packs are registered", STORY_PACKS.length === 2 && STORY_PACKS[1].id === "poultry");
ok("an unknown id falls back to the default", resolvePack("tractors").id === "vegetables");
ok("a missing id falls back to the default", resolvePack(undefined).id === "vegetables");
ok("an empty id falls back to the default", resolvePack("   ").id === "vegetables");
ok("a known id resolves", resolvePack("poultry").id === "poultry");
ok("ids are matched case-insensitively", resolvePack("POULTRY").id === "poultry");
ok("isKnownPack distinguishes the fallback from a real hit", isKnownPack("poultry") && !isKnownPack("tractors"));
ok("the picker exposes id, label, tagline and dialogue", (() => {
  const rows = listPacks();
  return rows.length === 2 && rows.every((r) => !!r.id && !!r.label && !!r.tagline && !!r.dialogue);
})());

// Every pack must fill every field, or a prompt renders the word "undefined".
for (const p of STORY_PACKS) {
  const missing = Object.entries({
    castDescription: p.castDescription,
    filmDescription: p.filmDescription,
    characterTypeLabel: p.characterTypeLabel,
    featuresLabel: p.featuresLabel,
    anatomyLabel: p.anatomyLabel,
    portraitAnatomyLabel: p.portraitAnatomyLabel,
    sheetAnatomyLabel: p.sheetAnatomyLabel,
    bodyShapeNoun: p.bodyShapeNoun,
    featureLockRule: p.featureLockRule,
    heartwarmingFlavour: p.heartwarmingFlavour,
    speechDeclaration: p.speechDeclaration,
  })
    .filter(([, v]) => !String(v ?? "").trim())
    .map(([k]) => k);
  ok(`pack "${p.id}" fills every required string`, missing.length === 0, missing.join(", "));

  const defs = Object.entries(p.defaults).filter(([, v]) => !String(v ?? "").trim()).map(([k]) => k);
  ok(`pack "${p.id}" fills every character default`, defs.length === 0, defs.join(", "));

  ok(`pack "${p.id}" names the features slot in its lock rule`, p.featureLockRule.includes("{features}"));
  ok(`pack "${p.id}" supplies at least one realism negative`, p.realismNegatives.length > 0);
}

// ---------------------------------------------------------------------------
console.log("\nvegetable reference packages — byte-identical to the baseline");
// ---------------------------------------------------------------------------

const baseline: any[] = JSON.parse(
  readFileSync(new URL("./fixtures/reference-baseline.json", import.meta.url), "utf8")
);

// The same two inputs the baseline was captured from: one fully populated,
// one empty so every default is exercised.
const CASES: any[] = [
  {
    id: "char_gajar_1",
    name: "Gajar Baji",
    veggieType: "Carrot",
    bodyShape: "stocky toddler proportions",
    faceDesign: "round cheeks, freckles",
    eyeStyleAndColor: "large hazel eyes",
    mouthStyle: "small shy smile",
    veggieFeatures: "three-frond green top",
    clothing: "patched blue kurta",
    shoes: "red cloth shoes",
    accessories: "woven basket",
    mainColors: "orange and green",
  },
  {},
];

const BASELINE_KEYS = [
  "characterId",
  "characterName",
  "veggieType",
  "fullBodyPrompt",
  "frontFacingPrompt",
  "characterSheetPrompt",
  "expressionSheetPrompt",
  "flowVeoInstructions",
  "negativePrompt",
];

ok("the baseline holds both capture cases", baseline.length === CASES.length);

CASES.forEach((input, i) => {
  const produced = buildCharacterReferencePackage(input, "Cute 3D", VEGETABLE_PACK);
  const expected = baseline[i];

  for (const key of BASELINE_KEYS) {
    const a = String(produced[key] ?? "");
    const b = String(expected[key] ?? "");
    if (a === b) {
      pass++;
      console.log(`  PASS  case ${i} · ${key} unchanged`);
    } else {
      fail++;
      // Report the first divergence rather than two 900-character strings.
      let at = 0;
      while (at < a.length && at < b.length && a[at] === b[at]) at++;
      failures.push(
        `case ${i} · ${key} CHANGED at char ${at}\n      was: ...${b.slice(Math.max(0, at - 40), at + 40)}...\n      now: ...${a.slice(Math.max(0, at - 40), at + 40)}...`
      );
      console.log(`  FAIL  case ${i} · ${key} CHANGED at char ${at}`);
    }
  }
});

// The default argument must also be vegetables, so a caller that forgot to
// pass a pack cannot silently produce a different film's reference sheet.
ok(
  "the pack argument defaults to vegetables",
  buildCharacterReferencePackage(CASES[0], "Cute 3D").fullBodyPrompt ===
    buildCharacterReferencePackage(CASES[0], "Cute 3D", VEGETABLE_PACK).fullBodyPrompt
);

// Historical field names must keep working — stories generated before the
// rename are still in the client's hands.
ok(
  "the legacy veggieType field is still read",
  buildCharacterReferencePackage({ name: "X", veggieType: "Turnip" }, "Cute 3D").fullBodyPrompt.includes(
    "anthropomorphic Turnip"
  )
);
ok(
  "the new characterType field is read",
  buildCharacterReferencePackage({ name: "X", characterType: "Hen" }, "Cute 3D", POULTRY_PACK).fullBodyPrompt.includes(
    "anthropomorphic Hen"
  )
);
ok(
  "characterType wins when both are present",
  buildCharacterReferencePackage({ name: "X", characterType: "Hen", veggieType: "Turnip" }, "Cute 3D").fullBodyPrompt.includes(
    "anthropomorphic Hen"
  )
);
ok(
  "the result carries both type field names",
  (() => {
    const r = buildCharacterReferencePackage({ name: "X", characterType: "Hen" }, "Cute 3D", POULTRY_PACK);
    return r.characterType === "Hen" && r.veggieType === "Hen";
  })()
);

// ---------------------------------------------------------------------------
console.log("\npoultry pack — a different film, not a reskinned vegetable");
// ---------------------------------------------------------------------------

const hen = buildCharacterReferencePackage(
  { name: "Murghi", characterType: "Hen", characterFeatures: "russet body feathers and a single red comb" },
  "Cute 3D",
  POULTRY_PACK
);

ok("the poultry sheet uses plumage anatomy, not botanical", /Plumage and beak anatomy:/.test(hen.fullBodyPrompt));
ok("no botanical vocabulary leaks in", !/[Bb]otanical|vegetable|leaf crown/.test(hen.fullBodyPrompt));
ok("the lock rule names plumage and the comb", /PLUMAGE & BEAK/.test(hen.flowVeoInstructions));
ok("the lock rule interpolated the features", hen.flowVeoInstructions.includes("russet body feathers"), hen.flowVeoInstructions.slice(0, 200));
ok("no unreplaced placeholder survives", !/\{features\}/.test(hen.flowVeoInstructions));
ok("the silhouette rule names the bird, not the vegetable", /bird silhouette/.test(hen.flowVeoInstructions));
ok("real-chicken photography is negated", /real chicken photography/.test(hen.negativePrompt));
ok("no vegetable negatives leak in", !/missing leaves|produce photographs/.test(hen.negativePrompt));

// ---------------------------------------------------------------------------
console.log("\ndialogue mode");
// ---------------------------------------------------------------------------

ok("vegetables is a dialogue pack", VEGETABLE_PACK.dialogue === "full" && !isWordless(VEGETABLE_PACK));
ok("poultry is wordless", POULTRY_PACK.dialogue === "none" && isWordless(POULTRY_PACK));
ok("speech findings apply to vegetables", speechFindingsApply(VEGETABLE_PACK));
ok("speech findings do NOT apply to poultry", !speechFindingsApply(POULTRY_PACK));

ok(
  "the vegetable declaration promises lip-sync",
  /SPOKEN aloud/.test(VEGETABLE_PACK.speechDeclaration) && /lip-synced/.test(VEGETABLE_PACK.speechDeclaration)
);
ok(
  "the poultry declaration forbids speech outright",
  /NO character speaks/.test(POULTRY_PACK.speechDeclaration) &&
    /no dialogue/.test(POULTRY_PACK.speechDeclaration)
);
ok(
  "the poultry declaration also bars drawn words",
  /no speech balloons/i.test(POULTRY_PACK.speechDeclaration) && /written words/i.test(POULTRY_PACK.speechDeclaration)
);

// The doctrine is what keeps a wordless film measurable and continuous.
const doctrine = POULTRY_PACK.extraDoctrine ?? "";
ok("poultry ships extra doctrine", doctrine.length > 500);
ok("the doctrine forbids dialogue turns", /Leave 'dialogueTurns' empty/.test(doctrine));
ok("the doctrine requires English action lines", /ACTION LINES IN ENGLISH/.test(doctrine));
ok("the doctrine fixes the chick count", /CHICK COUNT/.test(doctrine) && /backgroundCast/.test(doctrine));
ok("the doctrine restates openThread without speech", /openThread/.test(doctrine) && /never a question someone asked/.test(doctrine));
ok("the doctrine requires per-scene Foley", /Foley/.test(doctrine));
ok("vegetables ships no extra doctrine", !VEGETABLE_PACK.extraDoctrine);

// ---------------------------------------------------------------------------
console.log("\nshared descriptors — the client and the server must not drift");
// ---------------------------------------------------------------------------

// The picker reads shared/packs.ts; the prompts read server/packs/*. They are
// two files describing the same set, so the ONLY thing stopping a rename in one
// from silently disagreeing with the other is this block.
ok("every server pack has a shared descriptor", STORY_PACKS.every((p) => SHARED_PACKS.some((s) => s.id === p.id)));
ok("every shared descriptor has a server pack", SHARED_PACKS.every((s) => STORY_PACKS.some((p) => p.id === s.id)));
ok("the two lists are the same length", SHARED_PACKS.length === STORY_PACKS.length);
ok("the default id agrees", SHARED_DEFAULT_ID === DEFAULT_PACK_ID);
ok("order agrees, so both default to the same pack", SHARED_PACKS[0].id === STORY_PACKS[0].id);

for (const s of SHARED_PACKS) {
  const server = STORY_PACKS.find((p) => p.id === s.id)!;
  ok(`"${s.id}" label agrees`, s.label === server.label, `${s.label} vs ${server.label}`);
  ok(`"${s.id}" tagline agrees`, s.tagline === server.tagline);
  ok(`"${s.id}" dialogue mode agrees`, s.dialogue === server.dialogue, `${s.dialogue} vs ${server.dialogue}`);
  ok(`"${s.id}" has UI field labels`, !!s.anatomyFieldLabel.trim() && !!s.typeFieldLabel.trim());
  ok(`"${s.id}" has a badge, description and emoji`, !!s.badge.trim() && !!s.description.trim() && !!s.emoji.trim());
}

ok("findPack falls back to the default", findPack("tractors").id === SHARED_DEFAULT_ID);
ok("findPack handles undefined", findPack(undefined).id === SHARED_DEFAULT_ID);
ok("isPackWordless is true only for poultry", isPackWordless("poultry") && !isPackWordless("vegetables"));
ok("isPackWordless treats an unknown id as the default", !isPackWordless("tractors"));

// The UI anatomy label must not carry the other world's vocabulary.
ok(
  "the vegetable UI label is botanical, the poultry one is not",
  /Veggie/i.test(findPack("vegetables").anatomyFieldLabel) &&
    !/Veggie|Botanic/i.test(findPack("poultry").anatomyFieldLabel)
);

// ---------------------------------------------------------------------------
console.log("\npoultry topic ideas — wordless-safe and correctly tagged");
// ---------------------------------------------------------------------------

ok("poultry ships topic ideas", POULTRY_SUGGESTIONS.length >= 4);
ok("every poultry idea is tagged to the pack", POULTRY_SUGGESTIONS.every((s) => s.pack === "poultry"));
ok(
  "poultry ideas cover all three languages",
  ["Roman Urdu", "Hindi", "Urdu"].every((l) => POULTRY_SUGGESTIONS.some((s) => s.language === l))
);
ok(
  "vegetable ideas are untagged, so they default to vegetables",
  TOPIC_SUGGESTIONS.every((s) => s.pack === undefined)
);
ok("the combined list holds both sets", ALL_SUGGESTIONS.length === TOPIC_SUGGESTIONS.length + POULTRY_SUGGESTIONS.length);
ok(
  "filtering by pack never mixes the worlds",
  (() => {
    const forPoultry = ALL_SUGGESTIONS.filter((s) => (s.pack ?? "vegetables") === "poultry");
    const forVeg = ALL_SUGGESTIONS.filter((s) => (s.pack ?? "vegetables") === "vegetables");
    return (
      forPoultry.length === POULTRY_SUGGESTIONS.length &&
      forVeg.length === TOPIC_SUGGESTIONS.length &&
      forPoultry.every((s) => !/gajar|tamatar|aloo|baingan|sabzi/i.test(s.topic))
    );
  })()
);
ok(
  "every suggestion declares a valid mode",
  ALL_SUGGESTIONS.every((s) => s.suggestedMode === undefined || VALID_MODES.includes(s.suggestedMode))
);

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
