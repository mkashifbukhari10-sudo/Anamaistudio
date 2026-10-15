/**
 * REJECTED APPROACH — kept as the record of why dialogue redundancy is NOT
 * detected automatically.
 *
 * 37% of spoken turns in a real generation restated the visible action, and the
 * plan called for a detector: measure a line against the scene's action text
 * with the existing textSimilarity(), flag the ones that duplicate it.
 *
 * It does not work, for a structural reason. This pipeline writes
 * 'characterActions' in ENGLISH, because that is what the video model reads, and
 * writes dialogue in the STORY's language. textSimilarity() compares tokens and
 * trigrams, so a Roman Urdu line and an English action description share almost
 * nothing even when they say the same thing:
 *
 *   EN action :: RU line   0.093    <- the real pipeline
 *   RU action :: RU line   0.278
 *   EN action :: EN line   0.310
 *
 * Run below, the populations do not separate at all: the worst real case
 * ("Beeju gir gaya. Beeju phir chadhega." over a shot of Beeju falling and
 * climbing) scores 0.086, while a genuinely informative line scores 0.103.
 * A detector built on this would be noise, and noise in a quality gate is worse
 * than no signal - it teaches the writer to dodge the measure.
 *
 * What was shipped instead: prompt guidance in buildSpeakabilityGuidance()
 * telling the model that speech must say what the picture CANNOT. No automatic
 * detection.
 *
 * A future attempt needs a cross-lingual semantic measure, which means either a
 * model call or an embedding index - neither of which is available offline. Re-run
 * this to check any new measure against the same fixtures.
 *
 * Offline. Run: npx tsx tests/calibrate-redundancy.ts
 */
import { textSimilarity } from "../../src/server/story/scene-distinctiveness.js";

interface Fixture {
  action: string;
  line: string;
  note: string;
}

/** Lines that restate what the shot already shows. Must be flagged. */
const REDUNDANT: Fixture[] = [
  {
    action: "Beeju falls off the stem and lands on the soil, then gets up and starts climbing again.",
    line: "Beeju gir gaya. Beeju phir chadhega.",
    note: "narrates the fall and the climb",
  },
  {
    action: "Beeju gets up off the wet step and walks toward the brick wall.",
    line: "Beeju ab uthta hai. Beeju deewar ki taraf jaata hai.",
    note: "narrates standing and walking",
  },
  {
    action: "Aloo lifts the heavy sack onto his shoulder and carries it across the yard.",
    line: "I am lifting the sack onto my shoulder and carrying it across the yard.",
    note: "English, full narration",
  },
  {
    action: "Gobhi opens the gate and steps through into the field.",
    line: "Gobhi gate khol rahi hai aur field mein ja rahi hai.",
    note: "narrates the gate and the step",
  },
  {
    action: "Karela flexes both arms and roars at the crowd.",
    line: "Karela apne baazu dikha raha hai aur cheekh raha hai.",
    note: "narrates the flex and the roar",
  },
  {
    action: "Beeju counts the drain bars one by one as he jumps across them.",
    line: "Beeju ek ek karke sariye gin raha hai aur kood raha hai.",
    note: "narrates counting and jumping",
  },
];

/** Lines that add information the picture cannot carry. Must stay silent. */
const INFORMATIVE: Fixture[] = [
  {
    action: "Beeju falls off the stem and lands on the soil, then gets up and starts climbing again.",
    line: "Ammi kehti thi haar mat maanna.",
    note: "memory of a person not on screen",
  },
  {
    action: "Beeju gets up off the wet step and walks toward the brick wall.",
    line: "Deewar ke us paar Ankuri hogi?",
    note: "a question about something unseen",
  },
  {
    action: "Aloo lifts the heavy sack onto his shoulder and carries it across the yard.",
    line: "Yeh aakhri baar hai. Kal main nahi aaunga.",
    note: "a decision about the future",
  },
  {
    action: "Gobhi opens the gate and steps through into the field.",
    line: "Mujhe darr lag raha hai.",
    note: "interior feeling",
  },
  {
    action: "Karela flexes both arms and roars at the crowd.",
    line: "Tumhare gaon mein koi mard nahi bacha?",
    note: "a taunt aimed at others",
  },
  {
    action: "Beeju counts the drain bars one by one as he jumps across them.",
    line: "Aath kaisa lagta hai? Beeju ko aath pasand hai.",
    note: "a thought about a number, not the jumping",
  },
  {
    action: "Beeju presses both hands flat against the glass pane.",
    line: "Hum pahunch nahi sakte.",
    note: "states an impossibility, not the pressing",
  },
  {
    action: "Beeju presses both hands flat against the glass pane.",
    line: "Toh baat karenge. Aise hi.",
    note: "a decision made in the moment",
  },
];

const score = (f: Fixture) => ({ ...f, d: textSimilarity(f.line, f.action) });

const redundant = REDUNDANT.map(score).sort((a, b) => a.d - b.d);
const informative = INFORMATIVE.map(score).sort((a, b) => b.d - a.d);

console.log("RESTATES THE PICTURE (must be flagged — similarity ABOVE the threshold)");
for (const f of redundant) console.log(`  ${f.d.toFixed(3)}  ${f.line.slice(0, 46).padEnd(48)} ${f.note}`);

console.log("\nADDS INFORMATION (must stay silent — similarity BELOW the threshold)");
for (const f of informative) console.log(`  ${f.d.toFixed(3)}  ${f.line.slice(0, 46).padEnd(48)} ${f.note}`);

const lowest = redundant[0].d;
const highest = informative[0].d;

console.log(`\nlowest  REDUNDANT   : ${lowest.toFixed(3)}`);
console.log(`highest INFORMATIVE : ${highest.toFixed(3)}`);

if (lowest > highest) {
  console.log(`\nSEPARABLE. Usable range ${highest.toFixed(3)} .. ${lowest.toFixed(3)}`);
  console.log(`RECOMMENDED REDUNDANCY_THRESHOLD = ${((lowest + highest) / 2).toFixed(2)}`);
} else {
  console.log(`\nNOT SEPARABLE — the populations overlap.`);
  for (const f of redundant) if (f.d <= highest) console.log(`  REDUNDANT scored ${f.d.toFixed(3)}: ${f.line}`);
  for (const f of informative) if (f.d >= lowest) console.log(`  INFORMATIVE scored ${f.d.toFixed(3)}: ${f.line}`);
}
