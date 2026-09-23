import type { FrameHandoff, ShotTransitionType } from "../../types.js";
import { crossesIntoNewDay } from "./continuity-director.js";
import { textSimilarity } from "./scene-distinctiveness.js";

/**
 * FRAME HANDOFF — the operator's step in Flow before a prompt is pasted.
 *
 * This exists because of what a real generated film actually looks like. Across
 * ONE clip boundary in the sample video - half a second of screen time - the
 * money bag's text changed from "5,00,0000 / پانچ لاکھ" to a garbled
 * "5,00,00,000 / پورچ کرٹس", the potato's face and proportions changed, the man
 * handing over the bag vanished, and the crowd and background were replaced. At
 * another join an Urdu banner became meaningless Devanagari.
 *
 * None of that is fixable in prompt text. Veo renders every clip independently,
 * so a perfectly worded opening frame still gets a freshly invented face. The
 * only things that hold identity across two clips are the previous clip's last
 * frame uploaded as a reference, and the character reference images attached as
 * Ingredients.
 *
 * The previous policy was binary: CHAIN uploads a frame, CUT does not. That is
 * editorially reasonable - a cut is a break - and it is why the drift happens,
 * because most joins are cuts and many of those cuts stay in the same room with
 * the same people. A new ANGLE on the same scene is not a new world, and it is
 * exactly where a reference frame pays for itself.
 *
 * So a cut is now split in two, by what the join actually does.
 */

/**
 * What the operator does at this join.
 *
 * CHAIN    - one unbroken take spans the boundary. The last frame becomes the
 *            next clip's FIRST frame. Mandatory; without it the join is visible.
 * IDENTITY - a cut that stays in the same place with the same people. The last
 *            frame goes in as a style-and-identity reference, not as frame one.
 * FRESH    - a cut to a new place or a new day. A genuine break, and a reference
 *            frame from the old place would fight the new one.
 */
export type FrameHandoffMode = "CHAIN" | "IDENTITY" | "FRESH";

/**
 * Two location descriptions this close are the same place described twice.
 *
 * Calibrated against the same problem the continuity validator hit: scenes
 * sharing a placeId routinely word the room differently ("the corner of the
 * workroom" vs "the workroom corner"), and comparing prose alone reported those
 * as relocations. placeId is preferred wherever both scenes carry one; this is
 * the fallback.
 */
const SAME_PLACE_SIMILARITY = 0.55;

/** The people on screen, lowercased, for overlap testing. */
function castOf(scene: any): Set<string> {
  const list = Array.isArray(scene?.charactersPresent) ? scene.charactersPresent : [];
  return new Set(list.map((c: any) => String(c || "").trim().toLowerCase()).filter(Boolean));
}

/** True when the two scenes are staged in the same place. */
export function samePlace(prevScene: any, scene: any): boolean {
  const prevId = String(prevScene?.continuityState?.placeId || "").trim();
  const currId = String(scene?.continuityState?.placeId || "").trim();

  // Place IDENTITY beats place prose wherever the registry gave us both.
  if (prevId && currId) return prevId === currId;

  const prevWhere = String(prevScene?.continuityState?.location || prevScene?.environment || "").trim();
  const currWhere = String(scene?.continuityState?.location || scene?.environment || "").trim();
  if (!prevWhere || !currWhere) return false;

  return textSimilarity(prevWhere, currWhere) >= SAME_PLACE_SIMILARITY;
}

/** True when at least one character carries over the join. */
export function castOverlaps(prevScene: any, scene: any): boolean {
  const before = castOf(prevScene);
  const after = castOf(scene);
  if (before.size === 0 || after.size === 0) return false;
  for (const name of after) if (before.has(name)) return true;
  return false;
}

/**
 * Which of the three handoffs this join needs.
 *
 * A cut earns IDENTITY only when the world genuinely continues: same place, at
 * least one character carried over, and no crossing into a new day. Anything
 * else is FRESH, so a reference frame is never forced on a scene that has moved
 * somewhere new.
 */
export function classifyJoin(
  transitionType: ShotTransitionType,
  scene: any,
  prevScene: any | null | undefined
): FrameHandoffMode {
  if (!prevScene) return "FRESH";
  if (transitionType === "CHAIN") return "CHAIN";

  if (crossesIntoNewDay(prevScene, scene)) return "FRESH";
  if (!samePlace(prevScene, scene)) return "FRESH";
  if (!castOverlaps(prevScene, scene)) return "FRESH";

  return "IDENTITY";
}

/**
 * The operator's instruction for this join.
 *
 * Written so the reason travels with the step. An instruction that says only
 * "upload a frame" gets skipped on a long shoot; one that says what breaks
 * without it does not.
 */
export function buildFrameHandoff(
  transitionType: ShotTransitionType,
  scene?: any,
  prevScene?: any | null
): FrameHandoff {
  const mode = classifyJoin(transitionType, scene, prevScene);
  const from = Number(prevScene?.sceneNumber) || undefined;

  if (mode === "CHAIN" && from) {
    return {
      type: "CHAIN",
      mode,
      requiresFrameUpload: true,
      sourceSceneNumber: from,
      instruction:
        `CHAIN — seamless join. Export the LAST FRAME of Scene ${from} and upload it as this ` +
        `clip's FIRST-FRAME / reference image in Flow before pasting the prompt. The two clips ` +
        `must read as one unbroken take; without the upload the face and palette drift mid-take.`,
    };
  }

  if (mode === "IDENTITY" && from) {
    return {
      type: "CUT",
      mode,
      requiresFrameUpload: true,
      sourceSceneNumber: from,
      instruction:
        `CUT, same place — new angle. Export the LAST FRAME of Scene ${from} and upload it as ` +
        `this clip's REFERENCE image (not as the first frame — the angle changes). The shot ` +
        `changes framing, not world: without this reference Flow re-invents the faces, the ` +
        `background people and any text in frame. Keep the character reference images attached too.`,
    };
  }

  return {
    type: transitionType === "CHAIN" ? "CHAIN" : "CUT",
    mode: "FRESH",
    requiresFrameUpload: false,
    instruction:
      `CUT — new place or new moment. No frame upload: a reference from the previous location ` +
      `would fight this one. Keep the character reference images attached so identity holds.`,
  };
}

/** Values that mean "there is no writing in this shot". */
const NO_TEXT = /^(none|n\/a|-+|no text|nothing)$/i;

/**
 * Two in-frame texts this close are the same sign, worded twice.
 *
 * Calibrated in tests/calibrate-world-text.ts against reworded signs and
 * genuinely different ones. Separation only exists once conflicting numbers are
 * excluded first - see numbersConflict().
 */
const SAME_TEXT_SIMILARITY = 0.49;

/**
 * True when two texts name different numbers.
 *
 * This guard exists because the similarity measure alone is actively dangerous
 * here. "Inaam: 5 lakh rupay" and "Inaam: 10 lakh rupay" score 0.924 - almost
 * identical wording, a completely different prize - and merging them would put
 * the wrong amount on screen for the rest of the film. Digits in signage carry
 * the meaning: a price, a date, a time, a prize.
 *
 * Only a CONFLICT blocks the merge. One text having a numeral the other spells
 * out ("use 5 lakh" vs "usay paanch lakh") is a rewording, not a disagreement,
 * so a missing number on one side is not treated as a difference.
 */
export function numbersConflict(a: string, b: string): boolean {
  const digits = (s: string) =>
    new Set((s.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]/g, "")).filter(Boolean));

  const left = digits(a);
  const right = digits(b);
  if (left.size === 0 || right.size === 0) return false;

  for (const n of left) if (!right.has(n)) return true;
  for (const n of right) if (!left.has(n)) return true;
  return false;
}

/** The writing a scene shows in frame, or "" when it shows none. */
export function worldTextOf(scene: any): string {
  const raw = String(scene?.worldText ?? "").trim();
  if (!raw || NO_TEXT.test(raw)) return "";
  return raw;
}

/**
 * Forces one wording on every appearance of the same sign.
 *
 * A banner that reads one way in scene 18 and is paraphrased in scene 19 gives
 * the video model two different strings for one object, and it renders two
 * different signs - which is exactly what happened in a finished film, where an
 * Urdu banner became meaningless Devanagari one clip later.
 *
 * The model writes 'worldText' per scene and cannot see the others, so
 * agreement cannot be left to it. Near-identical texts are collapsed onto their
 * FIRST occurrence: first rather than longest, because the story establishes a
 * sign before it revisits it, and the establishing shot is the one the audience
 * reads.
 *
 * Mutates in place and returns the scenes, matching how the other normalisation
 * passes in this pipeline work.
 */
export function reconcileWorldText<T extends any[]>(scenes: T): T {
  const canonical: string[] = [];

  for (const scene of Array.isArray(scenes) ? scenes : []) {
    const text = worldTextOf(scene);
    if (!text) continue;

    const match = canonical.find(
      (c) =>
        c === text ||
        (!numbersConflict(c, text) && textSimilarity(c, text) >= SAME_TEXT_SIMILARITY)
    );
    if (match) {
      scene.worldText = match;
    } else {
      canonical.push(text);
    }
  }

  return scenes;
}

/**
 * The character reference Ingredients this clip needs.
 *
 * The operator package previously went Frame Handoff -> Positive Prompt ->
 * Negative Prompt and never named which references to attach, so holding
 * identity depended on the operator remembering the whole cast. This states it
 * per scene, for the people actually on screen.
 */
export function buildReferenceAssets(
  scene: any,
  characterReferences: any[] | undefined
): Array<{ characterId: string; characterName: string }> {
  const refs = Array.isArray(characterReferences) ? characterReferences : [];
  if (refs.length === 0) return [];

  const present = Array.isArray(scene?.charactersPresent) ? scene.charactersPresent : [];
  const assets: Array<{ characterId: string; characterName: string }> = [];
  const seen = new Set<string>();

  for (const raw of present) {
    const name = String(raw || "").trim();
    if (!name) continue;

    const match = refs.find(
      (r: any) => String(r?.characterName || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (!match) continue;

    const id = String(match.characterId || "").trim() || name;
    if (seen.has(id)) continue;
    seen.add(id);
    assets.push({ characterId: id, characterName: String(match.characterName || name) });
  }

  return assets;
}
