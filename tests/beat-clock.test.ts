import { buildBeatClock, renderBeatClock, segmentAction } from "../src/server/story/beat-clock.js";
import { speechRateFor } from "../src/server/story/performance-budget.js";
import { SECONDS_PER_SCENE } from "../src/shared/duration.js";
import {
  applyFrameBookends,
  SHOT_DECLARATION,
  OPENING_LEAD,
  CLOSING_LEAD,
} from "../src/server/story/seam.js";

/**
 * Phase B regression suite — the beat clock.
 *
 * No API calls. Every test builds a clock from a scene object and asserts the
 * allocation.
 *
 * Weighted toward the two ways this could do harm: pushing speech into scenes
 * that chose silence, and rendering a line faster than it can be spoken. Both
 * are asserted directly, as is the promise that the clock generalises to scene
 * lengths other than ten seconds.
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

const LANG = "Roman Urdu";
const RATE = speechRateFor(LANG);

const conversation = {
  sceneNumber: 4,
  charactersPresent: ["Beeju", "Ankuri"],
  characterActions: "Beeju grips the pot rim and leans in, then pulls back and looks along the shelf.",
  dialogueTurns: [
    { speaker: "Beeju", line: "Ankuri, dekho!" },
    { speaker: "Ankuri", line: "Beeju, dheere bolo." },
  ],
};

const silent = {
  sceneNumber: 8,
  charactersPresent: ["Beeju"],
  characterActions: "Beeju turns away from the counter mid-step, then walks back.",
  dialogueTurns: [],
};

console.log("\nevery scene gets a clock");

ok("a conversation scene produces rows", buildBeatClock(conversation, LANG).rows.length > 0);
ok("a silent scene produces rows", buildBeatClock(silent, LANG).rows.length > 0);
ok("a scene with nothing at all produces no rows", buildBeatClock({ sceneNumber: 1 }, LANG).rows.length === 0);
ok("an empty clock renders as empty text", renderBeatClock(buildBeatClock({ sceneNumber: 1 }, LANG)) === "");
ok("malformed input does not throw", (() => {
  try { buildBeatClock(null, LANG); buildBeatClock({ dialogueTurns: "no" }, LANG); return true; } catch { return false; }
})());

console.log("\nsilence is never filled with words");

const silentClock = buildBeatClock(silent, LANG);
ok("a silent scene gets no speech rows", silentClock.rows.every((r) => r.kind === "action"));
ok("a silent scene allocates no speech seconds", silentClock.speechSeconds === 0);
ok("a silent scene still gets its time allocated", silentClock.rows[silentClock.rows.length - 1].endSeconds === SECONDS_PER_SCENE);
ok("turns with empty lines are not counted as speech",
  buildBeatClock({ ...silent, dialogueTurns: [{ speaker: "Beeju", line: "   " }] }, LANG)
    .rows.every((r) => r.kind === "action"));

console.log("\nspeech is sized from the real speaking rate");

const convClock = buildBeatClock(conversation, LANG);
const speechRows = convClock.rows.filter((r) => r.kind === "speech");
ok("both lines appear", speechRows.length === 2);
ok("each speech row carries its speaker", speechRows.every((r) => !!r.speaker));
ok("each speech row quotes the line", speechRows[0].text === "Ankuri, dekho!");
ok(
  "a longer line gets more time than a shorter one",
  (() => {
    const c = buildBeatClock(
      {
        ...conversation,
        dialogueTurns: [
          { speaker: "Beeju", line: "Haan" },
          { speaker: "Ankuri", line: "Beeju yeh deewar bahut oonchi hai aur hum thak gaye hain" },
        ],
      },
      LANG
    );
    const rows = c.rows.filter((r) => r.kind === "speech");
    return rows[1].endSeconds - rows[1].startSeconds > rows[0].endSeconds - rows[0].startSeconds;
  })()
);
ok(
  "speech seconds track word count at the language rate",
  Math.abs(buildBeatClock({ sceneNumber: 1, dialogueTurns: [{ speaker: "A", line: "ek do teen chaar paanch chhe saat aath nau das" }] }, LANG).speechSeconds - (10 / RATE + 0.3)) < 0.2
);

console.log("\nthe shot is filled exactly, never overrun");

for (const [label, scene] of [["conversation", conversation], ["silent", silent]] as const) {
  const c = buildBeatClock(scene, LANG);
  ok(`${label}: first row starts at 0`, c.rows[0].startSeconds === 0);
  ok(`${label}: last row ends at the shot length`, c.rows[c.rows.length - 1].endSeconds === SECONDS_PER_SCENE);
  ok(`${label}: rows are contiguous`, c.rows.every((r, i) => i === 0 || Math.abs(r.startSeconds - c.rows[i - 1].endSeconds) < 0.15));
  ok(`${label}: no row exceeds the shot`, c.rows.every((r) => r.endSeconds <= SECONDS_PER_SCENE + 0.001));
}

console.log("\noverflow is reported, not hidden");

const crammed = {
  sceneNumber: 9,
  charactersPresent: ["Beeju"],
  characterActions: "Beeju runs.",
  dialogueTurns: Array.from({ length: 8 }, (_, i) => ({
    speaker: "Beeju",
    line: `yeh ek lambi line hai jo das second mein nahi aa sakti number ${i}`,
  })),
};
const crammedClock = buildBeatClock(crammed, LANG);
ok("an unspeakable scene is flagged", crammedClock.overflows === true);
ok("a speakable scene is not flagged", buildBeatClock(conversation, LANG).overflows === false);
ok("an overflowing clock is still clamped to the shot", crammedClock.rows.every((r) => r.endSeconds <= SECONDS_PER_SCENE + 0.001));

ok(
  "action gives way to speech rather than the reverse",
  (() => {
    const heavy = {
      sceneNumber: 5,
      charactersPresent: ["Beeju"],
      characterActions: "Beeju steps forward, then turns, then kneels, then stands, then runs.",
      dialogueTurns: [{ speaker: "Beeju", line: "yeh ek kaafi lambi baat hai jo waqt leti hai" }],
    };
    const c = buildBeatClock(heavy, LANG);
    const speech = c.rows.find((r) => r.kind === "speech")!;
    const spoken = speech.endSeconds - speech.startSeconds;
    // The line needs ~9 words / 2.8 = 3.2s. It must not be crushed to an
    // action-sized sliver just because the scene also lists five moves.
    return spoken > 1.5;
  })()
);

console.log("\naction segmentation is lossless");

const wordsOf = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) || []).map((w) => w.toLowerCase());

for (const line of [
  "Beeju grips the rim and leans in, then Motu shoves the pot.",
  "Kadoo Bi's big hand sweeps along the shelf, lifts the packet off the board and carries it to the work table.",
  "Beeju uthta hai, phir deewar ki taraf chalta hai.",
  "He runs. She follows. They stop.",
]) {
  const segs = segmentAction(line);
  const after = segs.flatMap((s) => wordsOf(s));
  // The connective a line is split on is a delimiter, not content, so it is not
  // expected to survive. Every word that carries meaning must.
  const CONNECTIVE = new Set(["then", "phir", "fir", "next", "meanwhile", "baad", "uske", "iske"]);
  const before = wordsOf(line).filter((w) => !CONNECTIVE.has(w));
  const missing = before.filter((w) => !after.includes(w));
  ok(`no content word lost: ${line.slice(0, 38)}...`, missing.length === 0, `missing ${missing.join(",")}`);
}

ok("a sequential marker splits the line", segmentAction("Beeju climbs, then Motu shoves.").length === 2);
ok("a Roman Urdu marker splits the line", segmentAction("Beeju uthta hai phir chalta hai.").length === 2);
ok("a single continuous action stays one beat", segmentAction("Beeju walks slowly along the ledge.").length === 1);
ok("empty input yields no beats", segmentAction("").length === 0);
ok(
  "a long chain is merged down to a readable number of rows",
  segmentAction("A runs. B walks. C stops. D turns. E kneels. F stands. G jumps.").length <= 5
);

console.log("\nthe six clauses a real generation mangled");

// Every one of these produced unfilmable direction in
// test-output/...kaddu-dada-ki-kassi.md and is asserted verbatim.
const mangled: Array<[string, string[], string, RegExp[]]> = [
  [
    "participial tail kept its clause",
    ["Kaddu Dada"],
    "A severe tremor wrenches Kaddu Dada's right shoulder; the kassi clangs against the marker before settling in the dry ditch.",
    [/Kaddu Dada settling/],
  ],
  [
    "sound effect did not become a beat",
    ["Aloo Mian"],
    "At his outdoor log bench, Aloo Mian taps the blade twice with a hammer—Tunn! Tunn!—runs his thumb over the bevel.",
    [/Aloo Mian tunn/i, /^tunn/i],
  ],
  [
    "bracketed sound effect did not split",
    ["Kaddu Dada", "Chhotu"],
    "A distant gong echoes ('Tann! Tann!'). Kaddu Dada lifts the kassi from the dirt.",
    [/Chhotu tann/i, /Kaddu Dada tann/i],
  ],
  [
    "the head clause never gains a second subject",
    ["Aloo Mian"],
    "At his outdoor log bench, Aloo Mian taps the iron blade twice.",
    [/Aloo Mian at his outdoor/i],
  ],
  [
    "a possessive is recognised as the subject",
    ["Kaddu Dada", "Chhotu"],
    "Chhotu grabs a fistful of dust, then Dada's other hand sifts straw into the clay.",
    [/Kaddu Dada dada/i],
  ],
  [
    "no row is only a name",
    ["Chhotu", "Kaddu Dada"],
    "Chhotu dumps both baskets at the mouth of the breach, then drops to his knees, bowing his head before Kaddu Dada.",
    [/^Kaddu Dada\.?$/, /^Chhotu\.?$/],
  ],
];

for (const [name, cast, action, forbidden] of mangled) {
  const rows = buildBeatClock(
    { sceneNumber: 1, charactersPresent: cast, characterActions: action, dialogueTurns: [] },
    LANG
  ).rows.map((r) => r.text);
  const hit = forbidden.find((re) => rows.some((t) => re.test(t)));
  ok(name, !hit, hit ? `matched ${hit} in ${JSON.stringify(rows)}` : "");
}

ok(
  "a participial tail folds back and keeps its connective",
  (() => {
    const segs = segmentAction("Beeju climbs the stem, then sliding back down the leaf.");
    return segs.length === 1 && segs[0].includes("then") && segs[0].includes("sliding");
  })(),
  JSON.stringify(segmentAction("Beeju climbs the stem, then sliding back down the leaf."))
);
ok(
  "a two-word complete clause is a beat, not a continuation",
  segmentAction("Rain drums on the glass, then eases off.").length === 2
);
ok(
  "a short but complete clause keeps its own row",
  segmentAction("Beeju climbs, then Motu shoves.").length === 2
);
ok(
  "a carried subject is never added to a two-word tail",
  !buildBeatClock(
    { sceneNumber: 1, charactersPresent: ["Beeju"], characterActions: "Rain drums on the glass, then eases off.", dialogueTurns: [] },
    LANG
  ).rows.some((r) => /^Beeju eases/.test(r.text))
);
ok(
  "'before' is treated as a preposition, not a split marker",
  segmentAction("He bows his head before Kaddu Dada.").length === 1
);
ok("no output carries a NUL sentinel", (() => {
  const t = buildBeatClock(
    { sceneNumber: 1, charactersPresent: ["Aloo Mian"], characterActions: "Aloo taps the blade—Tunn! Tunn!—and nods.", dialogueTurns: [] },
    LANG
  ).rows.map((r) => r.text).join(" ");
  return !t.includes(" ") && !/@@\d+@@/.test(t);
})());

console.log("\nevery row names who is acting");

const carried = buildBeatClock(
  {
    sceneNumber: 10,
    charactersPresent: ["Beeju", "Kadoo Bi"],
    characterActions: "Kadoo Bi's big hand sweeps along the shelf, lifts the packet off the board and carries it to the work table.",
    dialogueTurns: [],
  },
  LANG
);
ok("the subject is carried into subject-less beats", carried.rows.every((r) => /Kadoo Bi/.test(r.text)));
ok(
  "a subject is not invented when nobody is named",
  buildBeatClock({ sceneNumber: 2, charactersPresent: ["Beeju"], characterActions: "Rain drums on the glass, then eases off.", dialogueTurns: [] }, LANG)
    .rows.every((r) => !/^Beeju/.test(r.text))
);
ok(
  "beats that already name someone are untouched",
  buildBeatClock({ sceneNumber: 3, charactersPresent: ["Beeju", "Motu"], characterActions: "Beeju climbs the stem, then Motu shoves the pot.", dialogueTurns: [] }, LANG)
    .rows.some((r) => /Motu/.test(r.text))
);

console.log("\nrendering");

const text = renderBeatClock(convClock);
ok("the shot length is stated", new RegExp(`over its ${SECONDS_PER_SCENE} seconds`).test(text));

// The clock USED to render as a timestamped list, one row per line. A real
// generation then came back as a four-panel comic page with the dialogue in
// speech balloons: a numbered list of framings is the shape of a storyboard,
// and the model laid out one panel per row. These assert the new shape.
ok("it is one paragraph, not a list", !text.includes("\n"));
ok("no row begins with a timestamp", !/(?:^|\n)\s*\d+\.\d+-\d+\.\d+s/.test(text));
ok("time reads as direction, not as a stamp", /for the first /.test(text) && /through the last /.test(text));
ok("clauses are joined as prose", text.includes("; "));
ok(
  "at most one mid-shot time anchor, so it does not read as a schedule",
  (text.match(/\bin,\s/g) || []).length <= 1,
  `${(text.match(/\bin,\s/g) || []).length} anchors`
);
ok("every spoken line is still present, in order", (() => {
  const lines = convClock.rows.filter((r) => r.kind === "speech").map((r) => r.text);
  let at = -1;
  return lines.every((l) => {
    const next = text.indexOf(l, at + 1);
    if (next <= at) return false;
    at = next;
    return true;
  });
})());
ok("a line ending in '!' gets no trailing full stop", !/!"\./.test(renderBeatClock(buildBeatClock({ sceneNumber: 1, dialogueTurns: [{ speaker: "Motu", line: "Hatt!" }] }, LANG))));
ok("an accompanying action is rendered when the scene planned one",
  /while|,\s/.test(renderBeatClock(buildBeatClock({ sceneNumber: 1, dialogueTurns: [{ speaker: "A", line: "Haan", accompanyingAction: "nodding slowly" }] }, LANG))) &&
  renderBeatClock(buildBeatClock({ sceneNumber: 1, dialogueTurns: [{ speaker: "A", line: "Haan", accompanyingAction: "nodding slowly" }] }, LANG)).includes("nodding slowly"));

console.log("\nthe clock sits between the body and the closing frame");

const assembled = applyFrameBookends("Cute 3D animation. Beeju runs.", {
  opening: "Beeju crouches at frame left",
  closing: "Beeju stands at frame right",
  clock: renderBeatClock(convClock),
});
const CLOCK_LEAD = "The shot plays out over its";
ok("the single-shot declaration comes first", assembled.startsWith(SHOT_DECLARATION));
ok("the opening frame follows it", assembled.includes(`${OPENING_LEAD}Beeju crouches at frame left.`));
ok("the closing frame is still last", assembled.endsWith(`${CLOSING_LEAD}Beeju stands at frame right.`));
ok("the clock is present", assembled.includes(CLOCK_LEAD));
ok("the clock comes after the body", assembled.indexOf("Beeju runs") < assembled.indexOf(CLOCK_LEAD));
ok("the clock comes before the closing frame", assembled.indexOf(CLOCK_LEAD) < assembled.indexOf(CLOSING_LEAD));
ok("no part of the prompt is a timestamped row", !/\n\s*\d+\.\d+-\d+\.\d+s/.test(assembled));

console.log("\nother scene lengths");

const sixSecond = buildBeatClock(conversation, LANG, 6);
ok("a 6-second shot is filled to 6 seconds", sixSecond.rows[sixSecond.rows.length - 1].endSeconds === 6);
ok("a 6-second shot states 6 seconds", /over its 6 seconds/.test(renderBeatClock(sixSecond)));
ok("no row of a 6-second shot exceeds it", sixSecond.rows.every((r) => r.endSeconds <= 6.001));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
