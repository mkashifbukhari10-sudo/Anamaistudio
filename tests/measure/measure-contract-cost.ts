import { SCENE_SCHEMA_FOR_MEASUREMENT } from "../helpers/schema-probe.js";

/**
 * Schema / payload overhead introduced by SceneContract.
 *
 * Evidence for the earlier Q4 decision ("measure first; if material, compact
 * the contract before touching batch size"). No optimisation is performed here
 * and batch size is not changed - this only produces numbers.
 *
 * Token estimates use the standard ~4 characters per token rule of thumb. That
 * is approximate for English JSON and approximate is enough to decide whether
 * the cost is material.
 */

const CHARS_PER_TOKEN = 4;
const est = (chars: number) => Math.round(chars / CHARS_PER_TOKEN);

const { withContract, withoutContract, contractOnly } = SCENE_SCHEMA_FOR_MEASUREMENT;

const schemaWith = withContract.length;
const schemaWithout = withoutContract.length;
const schemaDelta = schemaWith - schemaWithout;

/** A representative filled contract, taken from the legitimate fixtures. */
const SAMPLE_CONTRACT = {
  goal: "Golu wants Mooli to let him carry the tin",
  obstacle: "She has not let anyone carry it since the spill",
  outcome: "partial",
  performanceType: "dialogue-scene",
  progression: {
    kind: "relationship",
    value: "trust between Mooli and Golu",
    before: "guarded, everything done herself",
    after: "slightly restored, she lets him take one handle",
  },
};

const SAMPLE_WITH_INTENT = {
  ...SAMPLE_CONTRACT,
  repetitionIntent: {
    kind: "callback",
    echoesScene: 1,
    variation: "Identical attempt, opposite outcome, and this time nobody is watching",
  },
};

const payload = JSON.stringify(SAMPLE_CONTRACT).length;
const payloadIntent = JSON.stringify(SAMPLE_WITH_INTENT).length;

console.log("\n" + "=".repeat(78));
console.log("SCENE CONTRACT — SCHEMA / PAYLOAD OVERHEAD");
console.log("=".repeat(78));

console.log("\nSCHEMA (sent once per batch, inside the system prompt)");
console.log("-".repeat(78));
console.log(`  scene schema without contract : ${schemaWithout.toLocaleString()} chars  (~${est(schemaWithout).toLocaleString()} tokens)`);
console.log(`  scene schema with contract    : ${schemaWith.toLocaleString()} chars  (~${est(schemaWith).toLocaleString()} tokens)`);
console.log(`  ADDED                         : ${schemaDelta.toLocaleString()} chars  (~${est(schemaDelta).toLocaleString()} tokens)  ` +
  `[+${Math.round((schemaDelta / schemaWithout) * 100)}%]`);
console.log(`  contract fragment alone       : ${contractOnly.length.toLocaleString()} chars  (~${est(contractOnly.length).toLocaleString()} tokens)`);

console.log("\nPAYLOAD (returned once per scene, inside the completion)");
console.log("-".repeat(78));
console.log(`  contract, no repetitionIntent : ${payload} chars  (~${est(payload)} tokens)`);
console.log(`  contract with repetitionIntent: ${payloadIntent} chars  (~${est(payloadIntent)} tokens)`);

console.log("\n12-SCENE BATCH OVERHEAD");
console.log("-".repeat(78));
const batchPayload = payload * 12;
console.log(`  schema (once)                 : ~${est(schemaDelta).toLocaleString()} tokens`);
console.log(`  payload (12 scenes)           : ~${est(batchPayload).toLocaleString()} tokens`);
console.log(`  TOTAL per batch               : ~${est(schemaDelta + batchPayload).toLocaleString()} tokens`);

console.log("\nAGAINST MEASURED REAL USAGE");
console.log("-".repeat(78));
console.log("  Reference: the 36-scene Mystery run used 174,889 prompt + 301,213 completion tokens");
console.log("  across 7 calls, i.e. roughly 25,000 prompt + 43,000 completion per call.");
const promptPct = (est(schemaDelta) / 25000) * 100;
const completionPct = (est(batchPayload) / 43000) * 100;
console.log(`  schema delta vs typical prompt      : +${promptPct.toFixed(1)}%`);
console.log(`  payload delta vs typical completion : +${completionPct.toFixed(1)}%`);
console.log("");
console.log(`  Model output ceiling is 120,000 tokens per call (384,000 available),`);
console.log(`  so a ~${est(batchPayload).toLocaleString()}-token completion increase is well inside headroom.`);
console.log("");
