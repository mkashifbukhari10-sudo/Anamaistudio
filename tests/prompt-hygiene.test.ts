import { stripSpeakerLabelsInQuotes } from "../src/server/story/prompt-continuity.js";
import { stripStylePreamble } from "../src/server/story/seam.js";
import { buildBeatClock, renderBeatClock } from "../src/server/story/beat-clock.js";
import { buildQualityGateReport } from "../src/server/story/quality-gate.js";

/**
 * PROMPT HYGIENE regression suite.
 *
 * Four defects read out of a real 36-scene generation
 * (test-output/2026-09-28, "Bas Usne Dekha Tha"). Every string below is taken
 * from that package, not invented:
 *
 *   1. Fifteen prompts across one batch carried the schema's own speaker
 *      notation inside the spoken line - `"<Gulgul>: Do ungli ooper"` - which
 *      Flow would have read aloud. The existing stripper expected the name to
 *      touch the quote and matched none of them.
 *   2. Two prompts opened on a bare place label, a side effect of the style
 *      preamble cut landing on "of".
 *   3. One beat clock scheduled an action with nobody performing it, because a
 *      name after a preposition was read as the subject.
 *   4. Eight prompts named places and objects by their story names, which the
 *      video model has no description of.
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

const CAST = ["Gulgul", "Mian Kaddu", "Chachi Arbi", "Lal Baigan", "Hari Mirch", "Dadu Pyaaz"];

// ---------------------------------------------------------------------------
console.log("\nspeaker labels — the bracketed form that slipped through");
// ---------------------------------------------------------------------------

const s13 = stripSpeakerLabelsInQuotes(
  `Gulgul stares in mounting horror, whispering: "<Gulgul>: Do ungli ooper... itni jaldi?"`,
  CAST
);
ok("the bracketed label is removed", !/<Gulgul>/.test(s13) && !/Gulgul\s*>?\s*:/.test(s13), s13);
ok("the spoken line is untouched", /"Do ungli ooper\.\.\. itni jaldi\?"/.test(s13), s13);

const s21 = stripSpeakerLabelsInQuotes(
  `booming with resonant authority: "<Mian Kaddu>: Hum sab jante hain! Tameer saaf hai!" ` +
    `chanting crisply: "<Lal Baigan>: Darwaza theek, taale band!"`,
  CAST
);
ok("two labels in one prompt both go", !/<[A-Za-z ]+>\s*:/.test(s21), s21);

// The form the original pattern already handled must keep working.
ok(
  "the plain 'Name:' form still strips",
  stripSpeakerLabelsInQuotes(`Ammi says: "Ammi: Chalo beta."`, ["Ammi"]) === `Ammi says: "Chalo beta."`
);

// A character ADDRESSED inside the line is content, not a label.
ok(
  "a name spoken inside the line is kept",
  /"Chachi Arbi, dekho!"/.test(stripSpeakerLabelsInQuotes(`Gulgul cries: "Chachi Arbi, dekho!"`, CAST))
);

// Square and round brackets are the neighbouring mistakes.
ok(
  "square brackets are handled too",
  stripSpeakerLabelsInQuotes(`says: "[Gulgul]: Ruko!"`, CAST) === `says: "Ruko!"`
);

// ---------------------------------------------------------------------------
console.log("\nstyle preamble — the bare place label it used to leave behind");
// ---------------------------------------------------------------------------

const sc8 = stripStylePreamble(
  "Children's 3D cartoon animation of Dhobi Chabootra, a cute 3D warm round taro root mother in a dusty teal shawl kneels gently beside a water trough."
);
ok("a place label is given a preposition", /^At Dhobi Chabootra, a cute/.test(sc8), sc8.slice(0, 70));

const sc1 = stripStylePreamble(
  "Stylized 3D cartoon animation of an anthropomorphic deep-purple Baigan mother wearing a faded mustard dupatta, crouched beside a hearth."
);
ok("a character opening is NOT given one", /^An anthropomorphic/.test(sc1), sc1.slice(0, 50));

ok(
  "a lowercase setting is left alone",
  /^A warm, humble kitchen corner/.test(
    stripStylePreamble("Stylized 3D cartoon animation of a warm, humble kitchen corner. An eggplant mother kneels.")
  )
);

// ---------------------------------------------------------------------------
console.log("\nbeat clock — an action must name who performs it");
// ---------------------------------------------------------------------------

const scene21 = {
  sceneNumber: 21,
  charactersPresent: ["Mian Kaddu", "Lal Baigan", "Chachi Arbi", "Gulgul"],
  characterActions:
    "Mian Kaddu gestures with a sweeping, furious arm command to Chachi Arbi, then turns authoritatively to Lal Baigan who plants his hands firmly on the iron winch spokes.",
  dialogueTurns: [
    { speaker: "Mian Kaddu", line: "Isay le jao, wheel ghumaao!", accompanyingAction: "Kaddu points a thick finger toward Gulgul." },
    { speaker: "Lal Baigan", line: "Darwaza theek, taale band!", accompanyingAction: "Lal Baigan grips the cold iron spoke." },
  ],
};
const clock21 = renderBeatClock(buildBeatClock(scene21, "Roman Urdu"));
ok("the handed-over action names Mian Kaddu", /Mian Kaddu turns authoritatively to Lal Baigan/.test(clock21), clock21);
ok("no beat is left with a bare verb", !/(?:^|[;,] )turns authoritatively/.test(clock21), clock21);

// A name that genuinely OPENS a beat must still be read as the subject.
const subjectOpens = renderBeatClock(
  buildBeatClock(
    {
      sceneNumber: 1,
      charactersPresent: ["Gulgul", "Dadu Pyaaz"],
      characterActions: "Dadu Pyaaz slides the peg across the stones. Gulgul kneels and scoops it up.",
      dialogueTurns: [],
    },
    "Roman Urdu"
  )
);
ok("a real opening subject is still recognised", /Gulgul kneels and scoops it up/.test(subjectOpens), subjectOpens);

const clock5 = renderBeatClock(
  buildBeatClock(
    {
      sceneNumber: 5,
      charactersPresent: ["Gulgul", "Lal Baigan"],
      characterActions: "Gulgul runs up and tugs at the harness.",
      dialogueTurns: [
        { speaker: "Gulgul", line: "Neeche darz hai!", accompanyingAction: "Gulgul points down the stairs." },
        { speaker: "Lal Baigan", line: "Arrey hat! Pavitra farsh par keechad!", accompanyingAction: "Lal Baigan wipes his harness." },
      ],
    },
    "Roman Urdu"
  )
);
ok("'around under a second in' never renders", !/around under a second in/.test(clock5), clock5.slice(0, 180));

// ---------------------------------------------------------------------------
console.log("\ngate — names the video model cannot picture");
// ---------------------------------------------------------------------------

const registry = {
  places: [{ name: "Dhobi Chabootra" }, { name: "Nehar ki Deewar aur Morcha" }],
  entities: [{ name: "Pital Ka Ghanta" }, { name: "Bada Lohe Ka Chabi Paana" }],
};

const report = buildQualityGateReport({
  scenes: [
    { sceneNumber: 5, finalVideoPrompt: "Distant behind them on Dhobi Chabootra, Pital Ka Ghanta rests silently under an old tree." },
    { sceneNumber: 6, finalVideoPrompt: "A large hanging bronze gong rests silently under an old tree." },
  ],
  worldRegistry: registry,
});
const flagged = report.findings.filter((f) => f.code === "unrenderable-proper-noun");

ok("the leaking scene is flagged", flagged.length === 1 && flagged[0].sceneNumbers[0] === 5);
ok(
  "the finding names both offenders",
  /Dhobi Chabootra/.test(flagged[0]?.detail ?? "") && /Pital Ka Ghanta/.test(flagged[0]?.detail ?? ""),
  flagged[0]?.detail
);
ok("a described prompt is not flagged", !flagged.some((f) => f.sceneNumbers.includes(6)));
ok(
  "no registry means no finding — the gate never invents evidence",
  buildQualityGateReport({ scenes: [{ sceneNumber: 1, finalVideoPrompt: "Dhobi Chabootra" }] }).findings.filter(
    (f) => f.code === "unrenderable-proper-noun"
  ).length === 0
);
ok("malformed registry input does not throw", (() => {
  try {
    buildQualityGateReport({ scenes: [{ sceneNumber: 1, finalVideoPrompt: "x" }], worldRegistry: { places: undefined } as any });
    return true;
  } catch {
    return false;
  }
})());

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
