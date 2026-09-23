import { plannedBystanders, idleBystanders, renderBystanders } from "../src/server/story/bystanders.js";
import { applyFrameBookends, CLOSING_LEAD } from "../src/server/story/seam.js";
import { buildSpeakabilityGuidance, wordEnvelope } from "../src/server/story/performance-budget.js";
import { SECONDS_PER_SCENE } from "../src/shared/duration.js";

/**
 * Phase 3 regression suite — the performance track.
 *
 * No API calls. Every test builds a scene object and asserts what the prompt
 * says about the people in it.
 *
 * Weighted toward the promise this phase must not break: silence is never
 * filled, solo scenes are never given imaginary company, and no behaviour is
 * invented for a character the scene did not plan one for.
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

const talkingStatue = {
  sceneNumber: 13,
  charactersPresent: ["Beeju", "Motu", "Teeli"],
  dialogueTurns: [
    { speaker: "Beeju", line: "Beeju yahan hai." },
    { speaker: "Beeju", line: "Koi sun raha hai?" },
  ],
};

const solo = {
  sceneNumber: 26,
  charactersPresent: ["Beeju"],
  dialogueTurns: [{ speaker: "Beeju", line: "Beeju ab uthta hai." }],
};

const silentScene = {
  sceneNumber: 8,
  charactersPresent: ["Beeju", "Ankuri"],
  dialogueTurns: [],
};

const everyoneSpeaks = {
  sceneNumber: 4,
  charactersPresent: ["Beeju", "Ankuri"],
  dialogueTurns: [
    { speaker: "Beeju", line: "Ankuri, dekho!" },
    { speaker: "Ankuri", line: "Dheere bolo." },
  ],
};

console.log("\nidle bystanders — the talking-statue measure");

ok(
  "a scene where one character talks at two silent ones is flagged",
  idleBystanders(talkingStatue).sort().join(",") === "Motu,Teeli"
);
ok("a solo scene is never flagged", idleBystanders(solo).length === 0);
ok("a scene where everyone speaks is never flagged", idleBystanders(everyoneSpeaks).length === 0);
ok("a fully silent scene is never flagged", idleBystanders(silentScene).length === 0);
ok(
  "planning the bystanders clears the flag",
  idleBystanders({
    ...talkingStatue,
    bystanders: [
      { character: "Motu", doing: "turns his back and pretends to sort seeds" },
      { character: "Teeli", doing: "watches Beeju without moving, one hand on her watch" },
    ],
  }).length === 0
);
ok(
  "planning only one of two still flags the other",
  idleBystanders({
    ...talkingStatue,
    bystanders: [{ character: "Motu", doing: "turns his back" }],
  }).join(",") === "Teeli"
);
ok("malformed input does not throw", (() => {
  try { idleBystanders(null); idleBystanders({ charactersPresent: "no" }); return true; } catch { return false; }
})());

console.log("\nplanned bystanders — normalisation");

ok(
  "entries missing a name or a behaviour are dropped",
  plannedBystanders({
    bystanders: [
      { character: "Motu", doing: "watches" },
      { character: "", doing: "watches" },
      { character: "Teeli", doing: "   " },
    ],
  }).length === 1
);
ok("a missing field yields nothing", plannedBystanders({}).length === 0);

console.log("\nrendering — never invents, never duplicates");

const rendered = renderBystanders({
  ...talkingStatue,
  bystanders: [
    { character: "Motu", doing: "Turns his back and pretends to sort seeds." },
    { character: "Teeli", doing: "watches Beeju without moving" },
  ],
});
ok("the silent characters are described", /Motu/.test(rendered) && /Teeli/.test(rendered));
ok("the line is marked as running throughout", /Throughout the shot/i.test(rendered));
ok("it says they are not speaking", /without speaking/i.test(rendered));
ok("a solo scene renders nothing", renderBystanders(solo) === "");
ok("a scene with no plan renders nothing", renderBystanders(talkingStatue) === "");
ok(
  "a character who SPEAKS is not listed as a bystander",
  !/Beeju/.test(
    renderBystanders({
      ...talkingStatue,
      bystanders: [
        { character: "Beeju", doing: "stands on the shelf" },
        { character: "Motu", doing: "turns his back" },
      ],
    })
  )
);
ok(
  "a plan naming only speakers renders nothing",
  renderBystanders({ ...everyoneSpeaks, bystanders: [{ character: "Beeju", doing: "waves" }] }) === ""
);

console.log("\nplacement in the prompt");

const assembled = applyFrameBookends("Cute 3D animation. Beeju calls out.", {
  opening: "Beeju at frame left",
  closing: "Beeju at frame right",
  clock: "Beat timing across the 8-second shot:\n0.0-4.0s Beeju calls out.",
  bystanders: "Throughout the shot, without speaking: Motu turns his back.",
});
ok("the closing frame is still last", assembled.endsWith(`${CLOSING_LEAD}Beeju at frame right.`));
ok("bystanders come after the clock", assembled.indexOf("Beat timing") < assembled.indexOf("Throughout the shot"));
ok("bystanders come before the closing frame", assembled.indexOf("Throughout the shot") < assembled.indexOf(CLOSING_LEAD));
ok(
  "no bystander line means no empty section",
  !/Throughout the shot/i.test(applyFrameBookends("Beeju runs.", { opening: "a", closing: "b" }))
);

console.log("\ndensity follows the performance type");

const guidance = buildSpeakabilityGuidance("Roman Urdu");
const env = wordEnvelope("Roman Urdu");
ok("the envelope numbers are stated", guidance.includes(String(env.ceiling)));
ok("the shot length is stated", guidance.includes(String(SECONDS_PER_SCENE)));
ok("a dialogue scene must be an exchange", /two or more characters SPEAK/i.test(guidance));
ok("a monologue with an audience is named as the failure", /monologue with an audience/i.test(guidance));
ok("relabelling is offered instead of forcing a second speaker", /label it honestly/i.test(guidance));
ok("silent types are told to stay near zero", /at or near zero/i.test(guidance));
ok("speech must add what the picture cannot", /Say what the picture CANNOT/i.test(guidance));

// The guardrail that matters: this must never become a style rule.
ok(
  "a character's own voice is explicitly protected",
  /own voice and way of talking is theirs to keep/i.test(guidance)
);
ok(
  "silence is still never to be filled",
  /do not push speech into an establishing shot/i.test(guidance) &&
    /Never pad a scene to reach it/i.test(guidance)
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
