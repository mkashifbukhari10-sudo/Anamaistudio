import { buildQualityGateReport } from "../src/server/story/quality-gate.js";
import { measureScene } from "../src/server/story/performance-budget.js";
import { SECONDS_PER_SCENE } from "../src/shared/duration.js";

/**
 * Phase 5 regression suite — the new gate findings.
 *
 * No API calls. Each test hands the gate a hand-built timeline and asserts
 * exactly which codes come back.
 *
 * Weighted toward false positives, because that is how a gate dies: every new
 * code is checked against the case it must NOT fire on as well as the case it
 * must. A silent scene, a solo scene and a genuine location change all have to
 * stay clean.
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

const codesFor = (scenes: any[]): string[] =>
  buildQualityGateReport({ scenes }).findings.map((f) => f.code);

const has = (scenes: any[], code: string) => codesFor(scenes).includes(code);

const base = (n: number, extra: any = {}) => ({
  sceneNumber: n,
  charactersPresent: ["Aloo"],
  characterActions: "Aloo walks across the yard.",
  dialogueTurns: [],
  continuityState: { placeId: "place_yard", location: "the village yard", timeOfDay: "afternoon" },
  ...extra,
});

console.log("\nspeaker-monologue");

ok(
  "a dialogue scene with one voice and a silent audience is flagged",
  has(
    [
      base(1, {
        charactersPresent: ["Aloo", "Gobhi"],
        contract: { performanceType: "dialogue-scene" },
        dialogueTurns: [
          { speaker: "Aloo", line: "Main ja raha hoon." },
          { speaker: "Aloo", line: "Tum rehna." },
        ],
      }),
    ],
    "speaker-monologue"
  )
);
ok(
  "a real exchange is not flagged",
  !has(
    [
      base(1, {
        charactersPresent: ["Aloo", "Gobhi"],
        contract: { performanceType: "dialogue-scene" },
        dialogueTurns: [
          { speaker: "Aloo", line: "Main ja raha hoon." },
          { speaker: "Gobhi", line: "Kyun?" },
        ],
      }),
    ],
    "speaker-monologue"
  )
);
ok(
  "a character alone on screen is never flagged",
  !has(
    [
      base(1, {
        contract: { performanceType: "dialogue-scene" },
        dialogueTurns: [{ speaker: "Aloo", line: "Aloo akela hai." }],
      }),
    ],
    "speaker-monologue"
  )
);
ok(
  "a non-dialogue type is not flagged",
  !has(
    [
      base(1, {
        charactersPresent: ["Aloo", "Gobhi"],
        contract: { performanceType: "reaction" },
        dialogueTurns: [{ speaker: "Aloo", line: "Nahi." }],
      }),
    ],
    "speaker-monologue"
  )
);

console.log("\nbystander-idle");

const crowded = (extra: any = {}) =>
  base(1, {
    charactersPresent: ["Aloo", "Gobhi", "Karela"],
    characterActions: "Aloo steps forward.",
    dialogueTurns: [{ speaker: "Aloo", line: "Main taiyar hoon." }],
    ...extra,
  });

ok("characters with nothing planned are flagged", has([crowded()], "bystander-idle"));
ok(
  "planning them clears it",
  !has(
    [crowded({ bystanders: [{ character: "Gobhi", doing: "watches" }, { character: "Karela", doing: "folds his arms" }] })],
    "bystander-idle"
  )
);
ok(
  "a character the ACTION already choreographs is not idle",
  !has(
    [
      crowded({
        characterActions: "Aloo steps forward while Gobhi watches and Karela folds his arms.",
      }),
    ],
    "bystander-idle"
  )
);
ok("a solo scene is never flagged", !has([base(1, { dialogueTurns: [{ speaker: "Aloo", line: "Haan." }] })], "bystander-idle"));
ok(
  "a fully silent scene is never flagged",
  !has([base(1, { charactersPresent: ["Aloo", "Gobhi", "Karela"] })], "bystander-idle")
);

console.log("\nframe-handoff-missing");

const yard = (n: number, extra: any = {}) =>
  base(n, { charactersPresent: ["Aloo", "Gobhi"], ...extra });

ok(
  "a same-place cut told it needs no frame is flagged",
  has(
    [
      yard(1),
      yard(2, { frameHandoff: { type: "CUT", mode: "FRESH", requiresFrameUpload: false, instruction: "" } }),
    ],
    "frame-handoff-missing"
  )
);
ok(
  "a cut to a new place is not flagged",
  !has(
    [
      yard(1),
      yard(2, {
        continuityState: { placeId: "place_field", location: "an open field", timeOfDay: "afternoon" },
        frameHandoff: { type: "CUT", mode: "FRESH", requiresFrameUpload: false, instruction: "" },
      }),
    ],
    "frame-handoff-missing"
  )
);
ok(
  "a cut with no shared cast is not flagged",
  !has(
    [
      yard(1),
      yard(2, {
        charactersPresent: ["Tamatar"],
        frameHandoff: { type: "CUT", mode: "FRESH", requiresFrameUpload: false, instruction: "" },
      }),
    ],
    "frame-handoff-missing"
  )
);
ok(
  "a join already classified IDENTITY is not flagged",
  !has(
    [
      yard(1),
      yard(2, { frameHandoff: { type: "CUT", mode: "IDENTITY", requiresFrameUpload: true, instruction: "" } }),
    ],
    "frame-handoff-missing"
  )
);
ok(
  "a story with no frameHandoff data produces no finding",
  !has([yard(1), yard(2)], "frame-handoff-missing")
);

console.log("\nworld-text-unstable");

ok(
  "the same sign worded two ways is flagged",
  has(
    [
      base(1, { worldText: "Jo Karele ko harayega use 5 lakh rupay inaam diya jayega" }),
      base(2, { worldText: "Jo Karele ko harayega, usay paanch lakh rupay inaam milega" }),
    ],
    "world-text-unstable"
  )
);
ok(
  "identical wording is not flagged",
  !has([base(1, { worldText: "Sabzi Mandi" }), base(2, { worldText: "Sabzi Mandi" })], "world-text-unstable")
);
ok(
  "two genuinely different signs are not flagged",
  !has([base(1, { worldText: "Sabzi Mandi" }), base(2, { worldText: "Gaon ka Dangal 2026" })], "world-text-unstable")
);
ok(
  "'None' is not a sign",
  !has([base(1, { worldText: "None" }), base(2, { worldText: "None" })], "world-text-unstable")
);

console.log("\nbeat-clock-overflows");

ok(
  "an overflowing clock is reported",
  has([base(1, { beatClock: { overflows: true } })], "beat-clock-overflows")
);
ok(
  "a clock that fits is not",
  !has([base(1, { beatClock: { overflows: false } })], "beat-clock-overflows")
);
ok("no clock data means no finding", !has([base(1)], "beat-clock-overflows"));

console.log("\ndialogue-underfilled — floor raised and promoted");

const thin = {
  sceneNumber: 1,
  contract: { performanceType: "dialogue-scene" },
  dialogueTurns: [{ speaker: "Aloo", line: "Haan theek hai bhai" }],
};
const m = measureScene(thin, "Roman Urdu");
ok(
  `a 5-word dialogue scene now reads as underfilled at ${SECONDS_PER_SCENE}s`,
  m.verdict === "underfilled",
  `${m.words}w fraction ${m.speechFraction} verdict ${m.verdict}`
);
ok(
  "a healthy dialogue scene does not",
  measureScene(
    {
      sceneNumber: 1,
      dialogueTurns: [
        { speaker: "Aloo", line: "Main kal wapas aaunga, wada hai" },
        { speaker: "Gobhi", line: "Main yahin rahungi, intezar karungi" },
      ],
    },
    "Roman Urdu"
  ).verdict !== "underfilled"
);
ok(
  "a silent scene is never underfilled",
  measureScene({ sceneNumber: 1, dialogueTurns: [] }, "Roman Urdu").verdict === "silent"
);
ok(
  "the finding is a warning, not an info",
  (() => {
    const f = buildQualityGateReport({
      scenes: [thin],
      feasibility: { scenes: [m], overruns: [], tight: [], underfilled: [1], silent: [], averageWords: m.words, turnsStdDev: 0, dominantTurnCount: null, envelope: { comfortable: 15, ceiling: 19 } } as any,
    }).findings.find((x) => x.code === "dialogue-underfilled");
    return f?.severity === "warn";
  })()
);

console.log("\nthe gate still owns nothing");

ok("malformed input does not throw", (() => {
  try { buildQualityGateReport({ scenes: null as any }); buildQualityGateReport({ scenes: [null, 3] as any }); return true; } catch { return false; }
})());
ok(
  "a scene object is never mutated",
  (() => {
    const s = base(1, { charactersPresent: ["Aloo", "Gobhi"], dialogueTurns: [{ speaker: "Aloo", line: "Haan." }] });
    const before = JSON.stringify(s);
    buildQualityGateReport({ scenes: [s] });
    return JSON.stringify(s) === before;
  })()
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
