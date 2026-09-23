import type { SceneBystander } from "../../types.js";

/**
 * BYSTANDERS — the people on screen who are not speaking.
 *
 * Measured on a real 36-scene generation: four scenes put two or three
 * characters in frame, gave exactly one of them every line, and planned nothing
 * at all for the others. The prompt then had nothing to say about them, so Flow
 * rendered what the prompt described - one character talking and the rest
 * standing still. The batch prompt already warned that "a prompt that lists only
 * speech produces talking statues"; it simply had no data behind it, because
 * both performance fields on a dialogue turn were optional and the model
 * omitted them in 100% of turns.
 *
 * This module turns the scene's cast into an explicit account of everyone who is
 * present and silent. It never invents behaviour: where the scene did not plan
 * any, the gap is reported rather than filled with a guess.
 */

/** Everyone the scene says is on screen. */
function presentCast(scene: any): string[] {
  const list = Array.isArray(scene?.charactersPresent) ? scene.charactersPresent : [];
  return list.map((c: any) => String(c || "").trim()).filter(Boolean);
}

/** Speaker values that are not a character: placeholders for "nobody speaks". */
const NOT_A_SPEAKER = /^(none|n\/a|-+|silent|no dialogue|visual action)\b/i;

/**
 * Everyone who actually says something.
 *
 * Restricted to characters the scene says are PRESENT. A turn attributed to
 * someone off-screen, or to a placeholder like "None / Visual Action", tells us
 * nothing about who is standing there with nothing to do - and counting it would
 * make a wordless scene look like it had speech in it, which then reports its
 * silent cast as idle.
 */
function speakingCast(scene: any): Set<string> {
  const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
  const present = new Set(presentCast(scene).map((n) => n.toLowerCase()));

  return new Set(
    turns
      .filter((t: any) => String(t?.line || "").trim().length > 0)
      .map((t: any) => String(t?.speaker || "").trim().toLowerCase())
      .filter((name: string) => name.length > 0 && !NOT_A_SPEAKER.test(name) && present.has(name))
  );
}

/** The scene's planned bystanders, normalised. */
export function plannedBystanders(scene: any): SceneBystander[] {
  const raw = Array.isArray(scene?.bystanders) ? scene.bystanders : [];
  return raw
    .map((b: any) => ({
      character: String(b?.character || "").trim(),
      doing: String(b?.doing || "").trim(),
    }))
    .filter((b: SceneBystander) => b.character.length > 0 && b.doing.length > 0);
}

/**
 * Characters who are present, silent, and have nothing planned.
 *
 * This is the talking-statue measure. A scene with one character on screen can
 * never appear here, and neither can a scene where everyone speaks - so silence
 * itself is never reported as a fault.
 */
export function idleBystanders(scene: any): string[] {
  const present = presentCast(scene);
  if (present.length < 2) return [];

  const speaking = speakingCast(scene);
  // Nobody speaks at all: this is a silent scene, which is a legitimate choice
  // and is the business of the performance type, not of this check.
  if (speaking.size === 0) return [];

  const planned = new Set(plannedBystanders(scene).map((b) => b.character.toLowerCase()));

  return present.filter(
    (name) =>
      !speaking.has(name.toLowerCase()) &&
      !planned.has(name.toLowerCase()) &&
      !appearsInAction(name, scene)
  );
}

/**
 * True when the scene's action already says what this character is doing.
 *
 * Without this the check fires on characters who are fully choreographed, just
 * not in the bystanders field - "Kadoo Bi's hand sweeps along the shelf, leaving
 * Beeju standing alone" accounts for both of them. Flagging that would push the
 * model to write a second, competing account of the same behaviour, which is the
 * duplicate-description failure this pipeline has already been bitten by once.
 */
function appearsInAction(name: string, scene: any): boolean {
  const text = [scene?.characterActions, scene?.visualDescription]
    .map((v) => String(v || ""))
    .join(" ");
  if (!text.trim()) return false;

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu").test(text);
}

/**
 * The bystander line for the prompt.
 *
 * Returns "" when there is nothing to say - a solo scene, a scene where everyone
 * speaks, or one where nothing was planned. An empty string keeps the section
 * out of the prompt entirely rather than emitting a hollow heading.
 */
export function renderBystanders(scene: any): string {
  const planned = plannedBystanders(scene);
  if (planned.length === 0) return "";

  const speaking = speakingCast(scene);
  // Someone who speaks is choreographed by the beat clock already; listing them
  // again here would give Flow two accounts of the same character.
  const silent = planned.filter((b) => !speaking.has(b.character.toLowerCase()));
  if (silent.length === 0) return "";

  const lines = silent.map((b) => `${b.character} ${b.doing.replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/[.\s]+$/, "")}`);
  return `Throughout the shot, without speaking: ${lines.join("; ")}.`;
}
