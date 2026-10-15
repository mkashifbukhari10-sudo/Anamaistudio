import type { FrameHandoff, ShotTransitionType } from "../../types.js";

/**
 * Continuity rules for prompts that are pasted into Google Flow / Veo by hand.
 *
 * The governing fact: Flow generates every clip in isolation. It has no memory
 * of the other scenes and cannot see the previous shot. So a prompt that says
 * "continue directly from the previous shot" is pointing at something that does
 * not exist for the model - it burns prompt budget and delivers no continuity.
 *
 * Continuity therefore splits in two:
 *   - CONTENT continuity comes from restating the opening frame absolutely, so
 *     the prompt stands alone. That is what this module enforces.
 *   - PIXEL continuity (same face, same palette, same light) cannot come from
 *     text at all. It needs the previous clip's last frame uploaded as this
 *     clip's first-frame reference, which happens in Flow. This module marks
 *     which joins need that step.
 */

/**
 * Goes in Flow / Veo's dedicated NEGATIVE prompt field, never in the positive
 * prompt.
 *
 * Only visual artifacts belong here. The previous list named continuity faults
 * ("character teleportation", "pose resets", "vanishing props") which describe
 * relationships BETWEEN shots - invisible to a model rendering one clip alone,
 * and naming a thing in a positive prompt tends to surface it rather than
 * suppress it.
 */
export const VIDEO_NEGATIVE_PROMPT =
  "extra limbs, duplicated characters, warped face, morphing features, melting geometry, " +
  "flickering textures, inconsistent proportions, blurry motion, low resolution, " +
  "text overlay, watermark, subtitles, logo, distorted hands, dead eyes, uncanny expression, " +
  // Rendered lettering is the least stable thing Veo produces. In a finished
  // film a banner reading "جو کریلے کو ہرائے گا..." became meaningless
  // Devanagari one clip later, and a money bag's "پانچ لاکھ" became "پورچ کرٹس"
  // across half a second. Naming the failure in the negative field is the only
  // lever available here; restating the text verbatim in the positive prompt
  // does the rest.
  "misspelled text, garbled lettering, distorted script, nonsense writing, malformed numerals, " +
  // A real generation came back as a COMIC PAGE: four panels in a grid with the
  // dialogue drawn in speech balloons. The prompt was carrying a timestamped
  // list of framings, which reads as a storyboard spec, so the model laid out
  // one panel per row. The list is now prose, and these name the failure.
  "comic panel, comic strip, storyboard, multiple panels, panel grid, split screen, " +
  "collage, contact sheet, film strip, speech bubble, speech balloon, caption box, " +
  "subtitle bar, montage grid, before and after layout, side by side frames";

/**
 * Phrases that point at a shot the model cannot see.
 *
 * Ordered longest-first so the fuller phrase is consumed before a shorter
 * pattern can strand part of it - "CONTINUE DIRECTLY FROM PREVIOUS SHOT
 * [Scene 4]:" has to go as one unit, bracket and colon included.
 */
const CROSS_SCENE_REFERENCE_PATTERNS: RegExp[] = [
  /CONTINUE\s+DIRECTLY\s+FROM\s+(?:THE\s+)?PREVIOUS\s+SHOT\s*(?:\[[^\]]*\])?\s*[:,-]?\s*/gi,
  /CONTINU(?:E|ING)\s+FROM\s+(?:THE\s+)?PREVIOUS\s+(?:SHOT|SCENE)\s*(?:\[[^\]]*\])?\s*[:,-]?\s*/gi,
  /(?:AS\s+)?(?:SEEN\s+|ESTABLISHED\s+)?IN\s+(?:THE\s+)?PREVIOUS\s+(?:SHOT|SCENE)\s*[:,-]?\s*/gi,
  /\bSAME\s+AS\s+(?:THE\s+)?(?:PREVIOUS|LAST|PRIOR)\s+(?:SHOT|SCENE|FRAME)\b\s*[:,-]?\s*/gi,
  /\bINHERIT(?:ING|S)?\s+(?:THE\s+)?(?:PREVIOUS|PRIOR|LAST)\b[^.]*\.\s*/gi,
  /\bINHERIT(?:ING|S)?\s+[^.]*\bFROM\s+SCENE\s*#?\d+[^.]*\.\s*/gi,
  /\bFROM\s+SCENE\s*#?\d+\s*[:,-]?\s*/gi,
  /\b(?:UNCHANGED|AS\s+BEFORE|AS\s+ESTABLISHED)\b\s*[:,-]?\s*/gi,
];

/** Negation in a positive prompt tends to summon what it names. */
const TRAILING_NEGATIVE_BLOCK = /\b(?:AVOID|NO|WITHOUT|DO\s+NOT\s+INCLUDE)\s*:[^.]*\.?\s*$/gi;

/** Left-over punctuation once a leading reference has been cut away. */
const ORPHANED_LEADING_PUNCTUATION = /^[\s,:;.\-–—]+/;

/**
 * Rewrites a prompt so it stands on its own.
 *
 * Cross-scene references are stripped and any trailing "Avoid: ..." block is
 * removed, because negatives travel in their own field.
 *
 * This no longer prepends the previous endState. It used to, and section 6 of
 * the batch prompt separately ordered the model to restate that same endState at
 * the head of the prompt - so both ran, and 12 of 36 prompts came out carrying
 * two different descriptions of frame one. The prefix was also pasted in ENDING
 * grammar, which is why 24 of 36 prompts opened by telling Veo that the first
 * frame occurs at the ten-second mark.
 *
 * Both frames are now owned by 'seam.ts', which renders one shared description
 * per join and uses it as this scene's closing frame AND the next scene's
 * opening frame. See applyFrameBookends().
 */
export function makeSelfContained(prompt: string): string {
  let cleaned = prompt;

  for (const pattern of CROSS_SCENE_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }

  TRAILING_NEGATIVE_BLOCK.lastIndex = 0;
  cleaned = cleaned.replace(TRAILING_NEGATIVE_BLOCK, "");

  return cleaned
    .replace(ORPHANED_LEADING_PUNCTUATION, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * CUT unless the model explicitly asked for an unbroken join.
 *
 * Defaulting to CUT is deliberate: a wrong CUT costs nothing (it is an ordinary
 * edit), while a wrong CHAIN sends the operator off to export and upload a
 * frame for a join that was never meant to be seamless.
 */
export function normalizeTransitionType(
  raw: unknown,
  isFirstScene: boolean
): ShotTransitionType {
  if (isFirstScene) return "CUT";
  return String(raw ?? "").trim().toUpperCase() === "CHAIN" ? "CHAIN" : "CUT";
}

/**
 * The frame handoff moved to './frame-handoff.js'.
 *
 * It used to live here and was binary: CHAIN uploads a frame, CUT does not. A
 * frame-level look at a finished film showed that policy was the cause of the
 * worst drift - most joins are cuts, many cuts stay in the same room with the
 * same people, and those are exactly the joins where faces, in-frame text and
 * background crowds were being re-invented. Classifying a join needs the
 * continuity state of both scenes, which does not belong in this module.
 */

/**
 * Guarantees every spoken line actually reaches the Flow / Veo prompt.
 *
 * Flow generates speech from the prompt text and nothing else. A scene can
 * therefore carry six lively turns in 'dialogueTurns', show them correctly in
 * the app, and still produce a silent clip - because the only thing pasted into
 * Flow is 'finalVideoPrompt', and the model frequently summarises the
 * conversation ("they talk excitedly") instead of quoting it.
 *
 * So this checks whether the lines are really in the prompt and appends the
 * ones that are missing as an explicit, ordered, attributed block. It is a
 * safety net, not the primary mechanism: when the model has already written the
 * dialogue into the prompt, nothing is added.
 */
export function ensureDialogueInPrompt(
  prompt: string,
  turns: Array<{ speaker?: string; line?: string; accompanyingAction?: string }> | undefined,
  language: string
): string {
  const spoken = (Array.isArray(turns) ? turns : []).filter(
    (t) => String(t?.line || "").trim().length > 0
  );
  if (spoken.length === 0) return prompt;

  const haystack = normaliseForMatch(prompt);
  const missing = spoken.filter((t) => !haystack.includes(matchKey(t.line)));

  // Partial coverage still gets the full block: a prompt quoting two of six
  // lines is the exact failure being fixed, and appending only the strays would
  // scramble the order the conversation has to be spoken in.
  if (missing.length === 0) return prompt;

  const block = spoken
    .map((t) => {
      const speaker = String(t?.speaker || "").trim() || "Character";
      const line = String(t.line).trim().replace(/^["“”]+|["“”]+$/g, "");
      const action = String(t?.accompanyingAction || "").trim();
      return action
        ? `${speaker} says, "${line}" while ${action.replace(/\.$/, "")}.`
        : `${speaker} says, "${line}"`;
    })
    .join("\n");

  const base = prompt.trim().replace(/[\s]+$/, "");
  return `${base}\n\nSpoken dialogue, lip-synced in ${language}, delivered in this order:\n${block}`;
}

/**
 * Removes a speaker's name from INSIDE their own quoted line.
 *
 * The schema teaches the `<Character>: "line"` format for the flat `dialogue`
 * field, and the model carries that habit into the Flow prompt, where it lands
 * inside the quotation marks:
 *
 *   stammering earnestly: "Chhotu: Dada... main toh sirf madad?"
 *
 * Flow speaks whatever is in the quotes, so the clip says the word "Chhotu"
 * out loud before the line. ensureDialogueInPrompt cannot catch it, because the
 * line genuinely IS present - just with a label welded on.
 *
 * Only labels matching a known character are stripped, so a line that happens
 * to contain a colon keeps it.
 */
export function stripSpeakerLabelsInQuotes(
  prompt: string,
  characterNames: string[] | undefined
): string {
  const names = (Array.isArray(characterNames) ? characterNames : [])
    .map((n) => String(n || "").trim())
    .filter((n) => n.length > 1)
    // Longest first, so "Kaddu Dada" is tried before a bare "Kaddu".
    .sort((a, b) => b.length - a.length);

  if (names.length === 0) return prompt;

  const alternation = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // The label sits immediately after an opening quote; the quote itself stays.
  //
  // The name may be WRAPPED. A real 36-scene generation wrote the schema's own
  // notation straight into the prompt - `whispering: "<Gulgul>: Do ungli ooper"`
  // - in fifteen places across one batch, and the original pattern, which
  // expected the name to touch the quote, matched none of them: the '<' sits
  // between. Veo speaks what it is given, so each of those clips would have
  // said the character's name out loud before the line.
  //
  // Angle brackets are what section 5 of the instruction uses, so they are the
  // form the model reaches for; square and round brackets are included because
  // they cost nothing and are the obvious neighbouring mistakes.
  const pattern = new RegExp(
    `(["'“‘])\\s*[<\\[(]?\\s*(?:${alternation})\\s*[>\\])]?\\s*:\\s*`,
    "gi"
  );

  return prompt.replace(pattern, "$1");
}

/** Lowercased, punctuation-free text, for comparing what a prompt says. */
function normaliseForMatch(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\u0900-\u097F]+/g, " ")
    .trim();
}

/**
 * The distinctive part of a line, for presence testing.
 *
 * Long lines are matched on their opening words only - the model often quotes a
 * line with light rewording or trimmed tail, and demanding the whole string
 * back would report almost every quoted line as missing.
 */
function matchKey(line: unknown): string {
  const words = normaliseForMatch(String(line || "")).split(" ").filter(Boolean);
  return words.slice(0, 6).join(" ");
}
