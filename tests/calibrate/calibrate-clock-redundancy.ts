/**
 * CALIBRATION — does one beat clock ever say the same thing twice?
 *
 * Observed in a real 36-scene generation:
 *   Scene 13  "... then Kaka Karela pulls the heavy wooden door shut;
 *              ... as Kaka Karela forcefully pulls the heavy timber door shut"
 *   Scene 14  "... then shoves them into his pocket and pivots to run;
 *              ... Tipu shoves them back and sprints down the lane"
 *
 * The clock is assembled from two independently written fields -
 * 'characterActions' and each turn's 'accompanyingAction' - and nothing stops
 * the model from putting the same beat in both. Rendered, the shot is told to
 * perform the action twice inside ten seconds.
 *
 * This measures, across every rendered clock in the saved reports, how similar
 * the action content of two clauses in the SAME clock gets. A threshold is only
 * worth shipping if the genuine duplicates separate from the ordinary case.
 *
 * Reads test-output/ only. No API call.
 */
import fs from "fs";
import path from "path";
import { textSimilarity } from "../../src/server/story/scene-distinctiveness.js";

const DIR = "test-output";

/** The director-voice time prefixes renderBeatClock() puts in front of a clause. */
const TIME_PREFIX =
  /^(?:for the first [^,]+,\s*|and through the last [^,]+,\s*|around [^,]+ in,\s*|then\s+|it opens on a brief moment where\s+|and it closes as\s+)/i;

/** A spoken clause: 'Name says, "line", accompanying action'. */
const SPEECH = /^(.+?)\s+says,\s*"([\s\S]*?)"\s*(?:,\s*([\s\S]*))?$/;

interface Clause { raw: string; action: string; }

function clockParagraphs(md: string): string[] {
  const out: string[] = [];
  const re = /The shot plays out over its [^\n]*\n?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[0].trim());
  return out;
}

/** The ACTION content of each clause - the spoken words themselves are excluded. */
function clausesOf(paragraph: string): Clause[] {
  const body = paragraph.replace(/^The shot plays out over its [^:]*:\s*/i, "");
  return body
    .split(/;\s+/)
    .map((raw) => {
      const stripped = raw.replace(TIME_PREFIX, "").trim();
      const speech = SPEECH.exec(stripped);
      // A spoken clause contributes only its accompanying action; two characters
      // saying different lines is not repetition, and comparing the lines would
      // drown the signal.
      const action = speech ? String(speech[3] || "").trim() : stripped;
      return { raw: stripped, action };
    })
    .filter((c) => c.action.length > 12);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
const scores: number[] = [];
const examples: Array<{ file: string; score: number; a: string; b: string }> = [];

for (const file of files) {
  const md = fs.readFileSync(path.join(DIR, file), "utf8");
  for (const para of clockParagraphs(md)) {
    const clauses = clausesOf(para);
    for (let i = 0; i < clauses.length; i++) {
      for (let j = i + 1; j < clauses.length; j++) {
        const score = textSimilarity(clauses[i].action, clauses[j].action);
        scores.push(score);
        examples.push({ file: file.slice(0, 40), score, a: clauses[i].action, b: clauses[j].action });
      }
    }
  }
}

scores.sort((a, b) => a - b);
const pct = (p: number) => scores[Math.min(scores.length - 1, Math.floor(scores.length * p))];

console.log(`\nIntra-clock clause pairs measured: ${scores.length}\n`);
console.log("  p50  " + pct(0.5).toFixed(3));
console.log("  p75  " + pct(0.75).toFixed(3));
console.log("  p90  " + pct(0.9).toFixed(3));
console.log("  p95  " + pct(0.95).toFixed(3));
console.log("  p98  " + pct(0.98).toFixed(3));
console.log("  max  " + pct(1).toFixed(3));

console.log("\nTop 18 most similar pairs inside one clock:\n");
examples
  .sort((a, b) => b.score - a.score)
  .slice(0, 18)
  .forEach((e, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${e.score.toFixed(3)}  [${e.file}]`);
    console.log(`      A: ${e.a.slice(0, 110)}`);
    console.log(`      B: ${e.b.slice(0, 110)}\n`);
  });

/* ---------------------------------------------------------------------------
 * VERDICT (81 rendered clocks, 270 intra-clock clause pairs, 2 real films)
 *
 *   p50 0.130   p75 0.196   p90 0.281   p95 0.353   p98 0.433   max 0.501
 *
 * NOT SEPARABLE. There is no gap. Reading the ranked list by hand, genuine
 * duplicates appear continuously from 0.501 down to at least 0.342, and a
 * legitimate pair sits at 0.348 - two characters described doing different
 * things in the same instant, which is exactly what a clock SHOULD say:
 *
 *   0.353  DUPLICATE  "Meenu sets her salt pot beside a clay bowl of thin broth"
 *                  vs "Places the wooden salt pot neatly beside the broth bowl"
 *   0.348  LEGITIMATE "Ammi crouches by the mud hearth blowing through a blowpipe,
 *                      while Meenu huddles beside her clutching a salt pot"
 *                  vs "Meenu hugs the salt pot closer while Ammi exhales through
 *                      the blowpipe"
 *
 * Any threshold that catches the first deletes the second. Bag-of-words
 * similarity cannot tell "the same beat written twice" from "one instant
 * described from two points of view", because they share the same nouns by
 * definition.
 *
 * SO NO AUTO-STRIP SHIPS. What the measurement DID establish is more useful:
 * the duplication is not occasional noise, it is STRUCTURAL. Roughly a third
 * of all spoken turns restate a beat that 'characterActions' already carries,
 * in both films, because the pipeline asks for the same moment in two separate
 * fields and never tells the model the fields must not overlap.
 *
 * The fix therefore went upstream, into what 'accompanyingAction' is asked for
 * (app.ts, section 5) - not into a detector here. This file stays as the
 * record of why.
 * ------------------------------------------------------------------------- */
