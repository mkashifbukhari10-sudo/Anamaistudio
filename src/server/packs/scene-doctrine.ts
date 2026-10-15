import type { StoryPack } from "./types.js";
import { isWordless } from "./types.js";

/**
 * The pack's override block for the SCENE instruction.
 *
 * The scene system instruction is a long, carefully tuned document that asks
 * for dialogue in about ten places - speaker prefixes, quoting every line in
 * the prompt, distributing turns between characters, a beat clock built from
 * 'dialogueTurns'. Every one of those rules is right for a dialogue pack and
 * wrong for a wordless one.
 *
 * Rather than make ten rules conditional - which would leave ten chances for a
 * poultry film to be told to write speech - a wordless pack gets ONE block
 * that is placed FIRST and says plainly that it outranks what follows. That is
 * the same precedence trick the shot declaration already uses: state what kind
 * of thing is being made before any of the parts are read.
 *
 * Returns "" for a dialogue pack, so the vegetable instruction is byte-for-byte
 * what it has always been.
 */
export function buildPackSceneDoctrine(pack: StoryPack): string {
  if (!isWordless(pack)) return "";

  return `==================================================
THIS FILM HAS NO DIALOGUE - READ THIS FIRST
==================================================
This film is WORDLESS. Nobody speaks, in any scene, in any language.

This instruction OUTRANKS every rule below about dialogue, speaker prefixes,
distributing lines between characters, quoting speech inside the prompt, and
populating 'dialogueTurns'. Those rules describe a different kind of film. Where
they conflict with this block, this block wins.

Concretely, for EVERY scene:
- 'dialogueTurns' MUST be an empty array. Not one turn, not a single word.
- 'dialogue' MUST be "None".
- The Flow / Veo prompt MUST contain no quoted speech and no speaker names
  followed by a colon. Nothing in the prompt may read as a line to be said.
- Do NOT write narration, voice-over, captions, subtitles or song lyrics.

What you write INSTEAD, and what the shot is now made of:
- 'characterActions' carries the whole scene. It is an ORDERED sequence of
  physical beats separated by "then". The beat clock is built from it alone, so
  the order you write is the order the audience sees.
- 'facialExpressions' carries what the dialogue used to carry. Write the look
  and the moment it changes - the instant the eyes find the problem, and the
  instant they find the answer.
- 'bystanders' carries everyone present who is not driving the beat. In a film
  with no speech there are no "listeners", so this field is where the rest of
  the cast stops being statues.
- SOUND IS NOW HALF THE PERFORMANCE. Every scene's prompt must name its Foley
  and its score. An unspecified soundscape renders as silence, and silence with
  nothing in it is dead air, not restraint.
- 'openThread' is still required at every join that has one, but it is never a
  question somebody asked. It is something unfinished the AUDIENCE can see.

A scene whose point only lands if somebody explains it is a BROKEN scene in
this film. Restage it as something visible, or cut it.
==================================================`;
}
