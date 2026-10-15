import { readFileSync } from "node:fs";
import {
  openThreadOf,
  hasOpenThread,
  buildThreadBlock,
  flattenStateMap,
  countThreadedJoins,
} from "../src/server/story/seam-thread.js";

/**
 * Phase 4 regression suite — the cross-scene thread.
 *
 * No API calls. Every test builds the brief that WOULD be sent and asserts what
 * it does and does not say.
 *
 * Weighted toward the failure mode this phase could introduce: turning every
 * join into a cliffhanger. A clean act break must transmit nothing, and "None"
 * has to stay a first-class answer.
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

console.log("\nreading the thread");

ok("a real thread survives", openThreadOf({ openThread: "Motu has not answered the question" }) === "Motu has not answered the question");
ok("'None' means no thread", openThreadOf({ openThread: "None" }) === "");
ok("'nothing' means no thread", openThreadOf({ openThread: "nothing" }) === "");
ok("'resolved' means no thread", openThreadOf({ openThread: "resolved" }) === "");
ok("a missing field means no thread", openThreadOf({}) === "");
ok("a trailing full stop is trimmed", openThreadOf({ openThread: "He never answered." }) === "He never answered");
ok("hasOpenThread agrees", hasOpenThread({ openThread: "a held look" }) && !hasOpenThread({ openThread: "None" }));

console.log("\nthe brief a clean break transmits");

ok(
  "a closed beat with no emotion transmits nothing at all",
  buildThreadBlock({ sceneNumber: 12, openThread: "None", characterEmotions: "" }) === ""
);
ok(
  "a missing context transmits nothing",
  buildThreadBlock({ sceneNumber: 1 }) === ""
);
ok(
  "a closed beat still carries the feeling",
  (() => {
    const b = buildThreadBlock({ sceneNumber: 5, openThread: "None", characterEmotions: "Ankuri: quietly hopeful" });
    return b.includes("WHAT THE AUDIENCE IS HOLDING") && !b.includes("STILL OPEN");
  })()
);

console.log("\nthe brief an open thread transmits");

const block = buildThreadBlock({
  sceneNumber: 12,
  openThread: "Motu has asked whether Beeju will still be here tomorrow, and Beeju has not answered",
  characterEmotions: "Beeju: shaken; Motu: smug but uncertain",
});
ok("it names the scene it came from", block.includes("SCENE #12"));
ok("it states the thread", block.includes("has not answered"));
ok("it offers refusal and interruption, not only an answer", /refuse it, interrupt it/.test(block));
ok("changing the subject on purpose is allowed", /change the subject on purpose/.test(block));
ok("it forbids silently dropping it", /do not quietly drop it/i.test(block));
ok("it forbids restating it as new", /Do not restate it as if it were new/i.test(block));
ok("the emotional half is present", block.includes("WHAT THE AUDIENCE IS HOLDING"));
ok("emotions are not to be reset without reason", /without a reason the audience can see/i.test(block));

console.log("\nflattening the per-character maps that were never populated");

ok(
  "a map becomes readable prose",
  flattenStateMap({ Beeju: "frame left, crouched", Motu: "frame right" }) === "Beeju: frame left, crouched; Motu: frame right"
);
ok("a plain string passes through", flattenStateMap("Beeju at frame left") === "Beeju at frame left");
ok("an array of entries flattens", flattenStateMap([{ character: "Beeju", value: "frame left" }]).includes("Beeju"));
ok("empty values yield empty text", flattenStateMap(null) === "" && flattenStateMap(undefined) === "" && flattenStateMap({}) === "");
ok(
  "entries with no state are dropped rather than left dangling",
  flattenStateMap({ Beeju: "frame left", Motu: "" }) === "Beeju: frame left"
);

console.log("\ncounting threaded joins");

const scenes = [
  { sceneNumber: 1, openThread: "a question hangs" },
  { sceneNumber: 2, openThread: "None" },
  { sceneNumber: 3, openThread: "an offer not taken" },
  { sceneNumber: 4, openThread: "None" },
];
const counted = countThreadedJoins(scenes);
ok("joins are counted between scenes, not per scene", counted.joins === 3);
ok("only open threads count", counted.threaded === 2);
ok("an empty timeline is safe", countThreadedJoins([]).joins === 0);
ok("malformed input does not throw", (() => {
  try { countThreadedJoins(null as any); return true; } catch { return false; }
})());

console.log("\nthe guardrail: a hook at every join is not the goal");

// The schema and section 6 are the contract with the model, so the wording that
// keeps act breaks from becoming cliffhangers is asserted against the source
// rather than assumed.
const serverSource = readFileSync(new URL("../src/server/app.ts", import.meta.url), "utf8");
ok(
  "the schema says 'None' is correct at an act break or time jump",
  /Write 'None' when the scene closes its beat cleanly[\s\S]{0,200}act break, a time jump/.test(serverSource)
);
ok(
  "the schema warns against a hook at every join",
  /a hook at every join is its own kind of mechanical writing/i.test(serverSource)
);
ok(
  "section 6 tells the next scene to engage the inherited thread",
  /The NEXT scene inherits it and must engage it/.test(serverSource)
);
ok(
  "section 6 also allows 'None'",
  /A hook at EVERY join is as mechanical as none at all/.test(serverSource)
);
ok(
  "a thread block never fabricates a thread from emotions alone",
  !buildThreadBlock({ sceneNumber: 3, characterEmotions: "Beeju: tired" }).includes("STILL OPEN")
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
