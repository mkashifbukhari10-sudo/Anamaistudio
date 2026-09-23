/**
 * Gemini connectivity check.
 *
 * Answers three separate questions that fail in different ways and are
 * routinely confused with each other:
 *
 *   1. Is a key present at all?
 *   2. Is the KEY valid?            - it can list models
 *   3. Is the PROJECT allowed?      - it can actually generate
 *
 * A key can pass (2) and fail (3): the key is fine, the Google project behind it
 * has no billing or is denied access. That failure surfaces as a 403 partway
 * through a real generation, after the wait has started, which is exactly what
 * this check exists to pre-empt.
 *
 * It also lists the model names the key can really see, because the adapter's
 * fallback chain is only as good as those names - a wrong one is a 404, which
 * the adapter treats as terminal.
 *
 * Costs a few tokens: one four-word generation. Never prints the key.
 *
 * Run: npx tsx tests/check-gemini.ts
 */
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const key = process.env.GEMINI_API_KEY?.trim();

console.log("1. KEY PRESENT");
if (!key) {
  console.log("   NO. GEMINI_API_KEY is empty or missing in .env");
  console.log("   Add it at https://aistudio.google.com/apikey, then re-run this.");
  process.exit(1);
}
console.log(`   yes - ${key.length} characters, starts "${key.slice(0, 6)}..."`);

const ai = new GoogleGenAI({ apiKey: key });

console.log("\n2. KEY VALID (can it list models?)");
let usable: string[] = [];
try {
  const page = await ai.models.list();
  const all: any[] = [];
  for await (const m of page as any) all.push(m);

  usable = all
    .filter((m) => (m.supportedActions || m.supportedGenerationMethods || []).some((a: string) => /generateContent/i.test(a)))
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  console.log(`   yes - ${all.length} models visible, ${usable.length} support generateContent`);
} catch (err: any) {
  console.log(`   NO - ${err?.message || err}`);
  console.log("   The key itself is rejected. Issue a new one at https://aistudio.google.com/apikey");
  process.exit(1);
}

console.log("\n3. PROJECT ALLOWED (can it actually generate?)");
const candidates = usable.filter((n) => /flash/i.test(n)).slice(0, 6);
const tryList = candidates.length > 0 ? candidates : usable.slice(0, 6);

let working = "";
for (const model of tryList) {
  try {
    const res = await ai.models.generateContent({
      model,
      contents: "Reply with exactly: ok",
    });
    const text = String(res?.text ?? "").trim();
    console.log(`   yes - '${model}' replied ${JSON.stringify(text.slice(0, 40))}`);
    working = model;
    break;
  } catch (err: any) {
    const msg = err?.message || String(err);
    const code = err?.status || err?.code || err?.error?.code;
    if (/PERMISSION_DENIED|denied access/i.test(msg) || Number(code) === 403) {
      console.log(`   NO - 403 on '${model}'. The KEY is valid but the PROJECT is blocked.`);
      console.log("   Create a key against the project where your billing/credit lives,");
      console.log("   or enable billing on this one: https://console.cloud.google.com/billing");
      process.exit(1);
    }
    console.log(`   '${model}' failed (${code || "?"}): ${msg.slice(0, 110)}`);
  }
}

if (!working) {
  console.log("   NO - every model tried failed. See the messages above.");
  process.exit(1);
}

console.log("\n4. MODEL NAMES THIS KEY CAN SEE (flash family)");
for (const m of usable.filter((n) => /flash/i.test(n)).slice(0, 14)) console.log(`   ${m}`);

console.log("\n5. ADAPTER FALLBACK CHAIN vs REALITY");
const { GeminiProvider } = await import("../src/server/ai/gemini-provider.js");
const configured = new GeminiProvider().textModels;
let stale = 0;
for (const m of configured) {
  const exists = usable.includes(m);
  if (!exists) stale++;
  console.log(`   ${exists ? "OK  " : "MISSING"} ${m}`);
}
if (stale > 0) {
  console.log(`\n   ${stale} of ${configured.length} configured models do not exist for this key.`);
  console.log("   The adapter treats a 404 as TERMINAL, so a missing name is not retried -");
  console.log("   it fails the whole request. TEXT_MODELS_FALLBACK_ORDER needs updating.");
} else {
  console.log("\n   All configured models exist for this key.");
}

console.log(`\nREADY. Generation will use '${working}' or the first working model in the chain.`);
