import {
  classifyJoin,
  buildFrameHandoff,
  buildReferenceAssets,
  reconcileWorldText,
  worldTextOf,
  samePlace,
  castOverlaps,
  numbersConflict,
} from "../src/server/story/frame-handoff.js";
import { applyFrameBookends, CLOSING_LEAD } from "../src/server/story/seam.js";
import { stripSpeakerLabelsInQuotes } from "../src/server/story/prompt-continuity.js";
import { VIDEO_NEGATIVE_PROMPT } from "../src/server/story/prompt-continuity.js";

/**
 * Phase 1 regression suite — Flow-side continuity.
 *
 * No API calls. Every test builds scene objects and asserts the operator step.
 *
 * Weighted toward the failure this phase exists to fix - a cut that stays in
 * the same room being told it needs no reference frame - and toward the
 * opposite error, forcing a reference frame onto a scene that genuinely moved.
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

const akhara = (n: number, extra: any = {}) => ({
  sceneNumber: n,
  charactersPresent: ["Aloo", "Karela"],
  continuityState: {
    placeId: "place_akhara",
    location: "the village wrestling ring, ropes on four sides",
    timeOfDay: "late afternoon",
    ...(extra.continuityState || {}),
  },
  ...extra,
});

console.log("\nclassifying a join");

ok("scene 1 has no previous frame to inherit", classifyJoin("CUT", akhara(1), null) === "FRESH");
ok("a CHAIN is always a chain", classifyJoin("CHAIN", akhara(2), akhara(1)) === "CHAIN");

ok(
  "a cut in the same place with the same cast asks for an identity reference",
  classifyJoin("CUT", akhara(2), akhara(1)) === "IDENTITY"
);

ok(
  "a cut to a new place does not",
  classifyJoin(
    "CUT",
    { sceneNumber: 2, charactersPresent: ["Aloo"], continuityState: { placeId: "place_field", location: "an open mustard field" } },
    akhara(1)
  ) === "FRESH"
);

ok(
  "a cut with no shared cast does not",
  classifyJoin(
    "CUT",
    { sceneNumber: 2, charactersPresent: ["Gobhi"], continuityState: { placeId: "place_akhara", location: "the village wrestling ring" } },
    akhara(1)
  ) === "FRESH"
);

ok(
  "crossing into a new day does not",
  classifyJoin(
    "CUT",
    akhara(2, { continuityState: { placeId: "place_akhara", location: "the village wrestling ring", timeOfDay: "dawn" } }),
    akhara(1, { continuityState: { placeId: "place_akhara", location: "the village wrestling ring", timeOfDay: "night" } })
  ) === "FRESH"
);

console.log("\nplace and cast comparison");

ok("placeId decides when both scenes carry one", samePlace(akhara(1), akhara(2)));
ok(
  "a reworded location is still the same place",
  samePlace(
    { continuityState: { location: "the corner of the workroom, by the window" } },
    { continuityState: { location: "the workroom corner beside the window" } }
  )
);
ok(
  "a genuinely different location is not",
  !samePlace(
    { continuityState: { location: "the corner of the workroom by the window" } },
    { continuityState: { location: "an open mustard field under heavy rain" } }
  )
);
ok("shared cast is detected", castOverlaps(akhara(1), akhara(2)));
ok(
  "a fully replaced cast is not",
  !castOverlaps(akhara(1), { charactersPresent: ["Gobhi", "Tamatar"] })
);
ok("an empty cast never counts as overlap", !castOverlaps(akhara(1), { charactersPresent: [] }));

console.log("\nthe operator instruction");

const chain = buildFrameHandoff("CHAIN", akhara(2), akhara(1));
ok("CHAIN requires an upload", chain.requiresFrameUpload === true);
ok("CHAIN names the source scene", chain.sourceSceneNumber === 1);
ok("CHAIN asks for the FIRST frame", /FIRST-FRAME/i.test(chain.instruction));

const identity = buildFrameHandoff("CUT", akhara(2), akhara(1));
ok("a same-place cut requires an upload", identity.requiresFrameUpload === true);
ok("it stays a CUT for the edit", identity.type === "CUT");
ok("its mode is IDENTITY", identity.mode === "IDENTITY");
ok("it asks for a REFERENCE, not a first frame", /REFERENCE image/i.test(identity.instruction));
ok("it says what breaks without it", /re-invents/i.test(identity.instruction));

const fresh = buildFrameHandoff(
  "CUT",
  { sceneNumber: 2, charactersPresent: ["Aloo"], continuityState: { placeId: "place_field", location: "an open field" } },
  akhara(1)
);
ok("a real break requires no upload", fresh.requiresFrameUpload === false);
ok("and still keeps the character references attached", /character reference/i.test(fresh.instruction));

ok(
  "the old 'no frame upload needed' blanket is gone",
  !/no frame upload needed/i.test(identity.instruction) && !/generate from the prompt alone/i.test(identity.instruction)
);

console.log("\nreference assets");

const refs = [
  { characterId: "char_aloo", characterName: "Aloo" },
  { characterId: "char_karela", characterName: "Karela" },
  { characterId: "char_gobhi", characterName: "Gobhi" },
];
const assets = buildReferenceAssets(akhara(4), refs);
ok("only the characters on screen are listed", assets.length === 2);
ok("and they are the right ones", assets.map((a) => a.characterName).sort().join(",") === "Aloo,Karela");
ok("an absent character is not attached", !assets.some((a) => a.characterName === "Gobhi"));
ok("no references means no assets", buildReferenceAssets(akhara(4), []).length === 0);
ok("an unknown name is skipped rather than invented",
  buildReferenceAssets({ charactersPresent: ["Nobody"] }, refs).length === 0);
ok("duplicates collapse",
  buildReferenceAssets({ charactersPresent: ["Aloo", "Aloo"] }, refs).length === 1);

console.log("\nin-frame text");

ok("'None' reads as no text", worldTextOf({ worldText: "None" }) === "");
ok("an empty field reads as no text", worldTextOf({}) === "");
ok("real text survives", worldTextOf({ worldText: "5,00,000" }) === "5,00,000");

const scenes = [
  { sceneNumber: 1, worldText: "Jo Karele ko harayega use 5 lakh rupay inaam diya jayega" },
  { sceneNumber: 2, worldText: "None" },
  { sceneNumber: 3, worldText: "Jo Karele ko harayega, usay paanch lakh rupay inaam milega" },
  { sceneNumber: 4, worldText: "Sabzi Mandi — subah 6 baje" },
];
reconcileWorldText(scenes);
ok(
  "a paraphrased sign is forced back to its first wording",
  scenes[2].worldText === scenes[0].worldText,
  `${scenes[2].worldText}`
);
ok("an unrelated sign is left alone", scenes[3].worldText === "Sabzi Mandi — subah 6 baje");
ok("a scene with no text stays without text", scenes[1].worldText === "None");
ok("reconciling an empty timeline does not throw", (() => { try { reconcileWorldText([]); return true; } catch { return false; } })());

console.log("\nthe number guard — a merge must never change an amount on screen");

ok("different prizes conflict", numbersConflict("Inaam: 5 lakh rupay", "Inaam: 10 lakh rupay"));
ok("the same amount does not", !numbersConflict("5,00,000 paanch lakh", "5,00,000 — paanch lakh rupay"));
ok("a digit against a spelled-out word is not a conflict", !numbersConflict("use 5 lakh", "usay paanch lakh"));
ok("no numbers at all is not a conflict", !numbersConflict("Nursery band hai", "Nursery band hai."));
ok("different years conflict", numbersConflict("Dangal 2026", "Dangal 2027"));
ok("commas in a number do not create a false conflict", !numbersConflict("5,00,000", "500000"));

const amounts = [
  { sceneNumber: 1, worldText: "Inaam: 5 lakh rupay" },
  { sceneNumber: 2, worldText: "Inaam: 10 lakh rupay" },
];
reconcileWorldText(amounts);
ok(
  "two different prizes are NOT merged despite 0.92 similarity",
  amounts[1].worldText === "Inaam: 10 lakh rupay",
  `${amounts[1].worldText}`
);

const withText = applyFrameBookends("Cute 3D animation. Aloo steps into the ring.", {
  opening: "Aloo at frame left",
  closing: "Aloo at frame right",
  worldText: "5,00,000",
});
ok("the text is quoted in the prompt", withText.includes('"5,00,000"'));
// Stated as a fact about the scene rather than as "render this text legibly",
// which pulled the whole prompt toward an illustrated page.
ok("it is stated as something the shot shows", /lettering visible in the shot reads exactly/i.test(withText));
ok("it is not phrased as a rendering instruction", !/rendered exactly and legibly/i.test(withText));
ok("it sits before the closing frame", withText.indexOf('"5,00,000"') < withText.indexOf(CLOSING_LEAD));
ok(
  "a scene with no in-frame text gets no text line",
  !/Text visible in frame/i.test(applyFrameBookends("Aloo runs.", { opening: "a", closing: "b" }))
);

console.log("\nnegative prompt");

ok("garbled lettering is named", /garbled lettering/i.test(VIDEO_NEGATIVE_PROMPT));
ok("malformed numerals are named", /malformed numerals/i.test(VIDEO_NEGATIVE_PROMPT));
ok("the existing artifacts are still there", /extra limbs/.test(VIDEO_NEGATIVE_PROMPT) && /warped face/.test(VIDEO_NEGATIVE_PROMPT));


console.log("\nspeaker labels never reach the spoken line");

// A real generation put the label inside the quotes in 8 lines across 5 scenes:
//   stammering earnestly: "Chhotu: Dada... main toh sirf madad?"
// Flow speaks whatever is in the quotes, so the clip said "Chhotu" out loud.
const CAST = ["Chhotu", "Kaddu Dada", "Karela Chacha", "Gajar Khala", "Aloo Mian", "Mirchi"];

ok(
  "a leading speaker label is removed",
  stripSpeakerLabelsInQuotes(`earnestly: "Chhotu: Dada... main toh sirf madad?"`, CAST) ===
    `earnestly: "Dada... main toh sirf madad?"`
);
ok(
  "a two-word name is removed",
  stripSpeakerLabelsInQuotes(`barks: "Kaddu Dada: Hatt! Dekh raha hoon!"`, CAST) ===
    `barks: "Hatt! Dekh raha hoon!"`
);
ok(
  "the quotation marks survive",
  /"Pura hissa/.test(stripSpeakerLabelsInQuotes(`says: "Karela Chacha: Pura hissa."`, CAST))
);
ok(
  "a colon that is part of the LINE is left alone",
  stripSpeakerLabelsInQuotes(`he says, "Sau baje: sab aa jana."`, CAST) ===
    `he says, "Sau baje: sab aa jana."`
);
ok(
  "an unknown name is not stripped",
  stripSpeakerLabelsInQuotes(`a voice: "Someone: hello"`, CAST).includes("Someone:")
);
ok("no cast means no change", stripSpeakerLabelsInQuotes(`"Chhotu: hi"`, []) === `"Chhotu: hi"`);
ok(
  "every occurrence in a prompt is cleared",
  !/"(Chhotu|Kaddu Dada):/.test(
    stripSpeakerLabelsInQuotes(`one: "Chhotu: a" and two: "Kaddu Dada: b"`, CAST)
  )
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
