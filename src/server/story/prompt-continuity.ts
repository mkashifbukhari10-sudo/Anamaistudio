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
  "text overlay, watermark, subtitles, logo, distorted hands, dead eyes, uncanny expression";

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
 * Cross-scene references are stripped, any trailing "Avoid: ..." block is
 * removed (negatives travel in their own field), and when the previous scene
 * recorded an endState the prompt is opened with that state spelled out as
 * fresh description - the same information the reference was gesturing at, in
 * the only form the model can actually use.
 */
export function makeSelfContained(
  prompt: string,
  prevScene?: { endState?: string } | null
): string {
  let cleaned = prompt;

  for (const pattern of CROSS_SCENE_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }

  TRAILING_NEGATIVE_BLOCK.lastIndex = 0;
  cleaned = cleaned.replace(TRAILING_NEGATIVE_BLOCK, "");

  cleaned = cleaned
    .replace(ORPHANED_LEADING_PUNCTUATION, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const priorEndState = prevScene?.endState?.trim();
  if (priorEndState && !openingFrameIsDescribed(cleaned, priorEndState)) {
    const stated = priorEndState.replace(/[\s.]+$/, "");
    cleaned = `Opening frame: ${stated}. ${cleaned}`;
  }

  return cleaned;
}

/**
 * True when the prompt already restates the inherited opening frame, so the
 * prefix would only duplicate it.
 *
 * Compared on distinctive words rather than exact text, because the model
 * paraphrases rather than echoing the endState verbatim.
 */
function openingFrameIsDescribed(prompt: string, priorEndState: string): boolean {
  const opening = prompt.slice(0, 400).toLowerCase();
  const keywords = priorEndState
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4);

  if (keywords.length === 0) return false;

  const hits = keywords.filter((word) => opening.includes(word)).length;
  return hits / keywords.length >= 0.5;
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
 * The operator's step in Flow / Higgsfield before this scene's prompt is pasted.
 *
 * Only CHAIN joins need the last-frame upload. Frame-chaining an ordinary cut
 * wastes time and fights the edit, since a cut is meant to read as a break.
 */
export function buildFrameHandoff(
  transitionType: ShotTransitionType,
  prevSceneNumber?: number
): FrameHandoff {
  if (transitionType === "CHAIN" && prevSceneNumber) {
    return {
      type: "CHAIN",
      instruction:
        `CHAIN — seamless join. Export the LAST FRAME of Scene ${prevSceneNumber} and upload it ` +
        `as this clip's first-frame / reference image in Flow before pasting the prompt. ` +
        `Without that upload the face and palette will drift across the join.`,
      sourceSceneNumber: prevSceneNumber,
    };
  }

  return {
    type: "CUT",
    instruction:
      "CUT — ordinary edit. Generate from the prompt alone; no frame upload needed. " +
      "Keep the character reference image attached so identity holds.",
  };
}
