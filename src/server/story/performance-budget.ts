import { SECONDS_PER_SCENE } from "../../shared/duration.js";

/**
 * THE TEN-SECOND PERFORMANCE BUDGET
 *
 * A scene is not a paragraph, it is a fixed span of screen performance. Speech
 * takes real time, and so do breath, reaction and physical action. Nothing in
 * the pipeline modelled that, so the dialogue rules could only oscillate
 * between too little and too much:
 *
 *   - an early real story averaged 2.2 spoken turns per scene with a narrator
 *     carrying the film, which read flat;
 *   - the correction asked for four to six turns of eight to fourteen words,
 *     i.e. 32-84 words, which is 11-28 seconds of continuous speech inside a
 *     ten-second clip. A 36-scene generation then returned EXACTLY six turns in
 *     33 of its 36 scenes - the model filling a quota it could not perform.
 *
 * Both failures have one cause: no budget. This module supplies it.
 *
 * SPEAKABILITY, NOT A CREATIVE LIMIT. The numbers describe what can be
 * performed in the shot, never what a scene ought to contain. A scene that is
 * stronger on one line, or silent, is correct and must never be reported as a
 * fault. Report-only: nothing here truncates, rewrites or rejects anything.
 */

/**
 * Conversational delivery rate, words per second.
 *
 * Natural conversational speech across the supported languages sits in a
 * 2.5-3.0 w/s band. 2.8 is used as the working centre; the exact value matters
 * far less than having one at all, and the verdict bands below are wide enough
 * that a 0.2 w/s difference does not move a scene between them.
 *
 * Per-language entries exist so the model can be corrected later with evidence
 * rather than guessed at now. They are deliberately identical until there is a
 * reason to separate them.
 */
const WORDS_PER_SECOND: Record<string, number> = {
  "roman urdu": 2.8,
  urdu: 2.8,
  hindi: 2.8,
};

const DEFAULT_WORDS_PER_SECOND = 2.8;

export function speechRateFor(language: string | undefined): number {
  const key = String(language || "").trim().toLowerCase();
  return WORDS_PER_SECOND[key] ?? DEFAULT_WORDS_PER_SECOND;
}

/**
 * How much of a shot can be speech.
 *
 * A clip is never 100% talking: it opens on something, the listener reacts,
 * somebody moves. Past roughly two thirds the shot has no room left for
 * anything but mouths moving, and the video model starts rushing or clipping
 * lines. These are the boundaries of the verdict bands, and each is a
 * statement about performance rather than about writing.
 */
const COMFORTABLE_CEILING = 0.65;
const TIGHT_CEILING = 0.85;

/**
 * Below this, a scene that HAS dialogue is mostly dead air.
 *
 * Only applied to scenes that chose to speak. A silent scene is a different
 * thing entirely and is never measured against this.
 *
 * Raised from 0.2, which was set against a ten-second shot and had become
 * almost inert: at eight seconds it meant "under four spoken words", so it
 * caught only near-silent scenes and let a two-line exchange pass as healthy.
 * Measured across 175 speaking scenes it fired on 10; at 0.3 it fires on 18.
 *
 * 0.3 is roughly HALF the comfortable envelope - the point where a scene that
 * declared itself a dialogue scene is not actually holding a conversation. It
 * is expressed as a fraction, like the two ceilings above, so it moves with the
 * shot length rather than being a word count that silently goes stale.
 */
const UNDERFILLED_FLOOR = 0.3;

export type FeasibilityVerdict =
  | "silent"
  | "underfilled"
  | "comfortable"
  | "tight"
  | "overruns";

export interface DialogueFeasibility {
  sceneNumber: number;
  turns: number;
  words: number;
  estimatedSpeechSeconds: number;
  /** Share of the shot consumed by speech alone. */
  speechFraction: number;
  verdict: FeasibilityVerdict;
}

/** Words in one spoken line. Counts word-like runs in any supported script. */
export function countWords(line: unknown): number {
  const text = String(line || "").trim();
  if (!text) return 0;
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

/**
 * The speakability envelope for one shot: how many words fit comfortably.
 *
 * Returned so prompts and reports can quote the same numbers rather than each
 * hard-coding their own.
 */
export function wordEnvelope(
  language: string | undefined,
  secondsPerScene: number = SECONDS_PER_SCENE
): { comfortable: number; ceiling: number } {
  const rate = speechRateFor(language);
  return {
    comfortable: Math.round(secondsPerScene * COMFORTABLE_CEILING * rate),
    ceiling: Math.round(secondsPerScene * TIGHT_CEILING * rate),
  };
}

/** Measure one scene. Pure; never throws on malformed input. */
export function measureScene(
  scene: any,
  language: string | undefined,
  secondsPerScene: number = SECONDS_PER_SCENE
): DialogueFeasibility {
  const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
  const words = turns.reduce((sum: number, t: any) => sum + countWords(t?.line), 0);
  const rate = speechRateFor(language);
  const seconds = words / rate;
  const fraction = secondsPerScene > 0 ? seconds / secondsPerScene : 0;

  let verdict: FeasibilityVerdict;
  if (words === 0) verdict = "silent";
  else if (fraction > TIGHT_CEILING) verdict = "overruns";
  else if (fraction > COMFORTABLE_CEILING) verdict = "tight";
  else if (fraction < UNDERFILLED_FLOOR) verdict = "underfilled";
  else verdict = "comfortable";

  return {
    sceneNumber: Number(scene?.sceneNumber) || 0,
    turns: turns.length,
    words,
    estimatedSpeechSeconds: Math.round(seconds * 10) / 10,
    speechFraction: Math.round(fraction * 100) / 100,
    verdict,
  };
}

export interface FeasibilityReport {
  scenes: DialogueFeasibility[];
  overruns: number[];
  tight: number[];
  underfilled: number[];
  silent: number[];
  averageWords: number;
  averageSpeechFraction: number;
  /**
   * Population standard deviation of turns per scene.
   *
   * Near-zero means every scene carries the same amount of talk, which is a
   * quota being filled rather than scenes being written. It was 0.33 across 36
   * scenes in a real generation - 33 of them had exactly six turns. This is a
   * REPETITION signal that happens to live in the dialogue layer, and it is
   * the reason the metric exists.
   */
  turnsStdDev: number;
  /** The most common turn count, and how much of the film it covers. */
  dominantTurnCount: { turns: number; scenes: number; sharePercent: number } | null;
  envelope: { comfortable: number; ceiling: number };
}

export function buildFeasibilityReport(
  scenes: any[],
  language: string | undefined,
  secondsPerScene: number = SECONDS_PER_SCENE
): FeasibilityReport {
  const list = Array.isArray(scenes) ? scenes : [];
  const measured = list.map((s) => measureScene(s, language, secondsPerScene));

  const pick = (v: FeasibilityVerdict) =>
    measured.filter((m) => m.verdict === v).map((m) => m.sceneNumber);

  const n = measured.length || 1;
  const averageWords = Math.round((measured.reduce((s, m) => s + m.words, 0) / n) * 10) / 10;
  const averageSpeechFraction =
    Math.round((measured.reduce((s, m) => s + m.speechFraction, 0) / n) * 100) / 100;

  const turnCounts = measured.map((m) => m.turns);
  const meanTurns = turnCounts.reduce((s, t) => s + t, 0) / n;
  const variance = turnCounts.reduce((s, t) => s + (t - meanTurns) ** 2, 0) / n;
  const turnsStdDev = Math.round(Math.sqrt(variance) * 100) / 100;

  const histogram = new Map<number, number>();
  turnCounts.forEach((t) => histogram.set(t, (histogram.get(t) || 0) + 1));
  const top = [...histogram.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    scenes: measured,
    overruns: pick("overruns"),
    tight: pick("tight"),
    underfilled: pick("underfilled"),
    silent: pick("silent"),
    averageWords,
    averageSpeechFraction,
    turnsStdDev,
    dominantTurnCount: top
      ? { turns: top[0], scenes: top[1], sharePercent: Math.round((top[1] / n) * 100) }
      : null,
    envelope: wordEnvelope(language, secondsPerScene),
  };
}

// ---------------------------------------------------------------------------
// Generation guidance (P3)
//
// P2 introduced `performanceType` as CLASSIFICATION. This turns it into
// direction: each type gets its own account of what ten seconds of that kind
// of scene actually contains.
//
// The rule this replaces applied one dialogue density to every scene, which is
// why a real 36-scene generation came back with exactly six turns in 33 of its
// scenes - including establishing shots and moments that should have been
// silent. A type-aware rule is the fix, and the envelope below is a CEILING on
// what can be performed, never a target to reach.
// ---------------------------------------------------------------------------

export const PERFORMANCE_TYPE_GUIDANCE: Record<string, string> = {
  "dialogue-scene":
    "Usually TWO to FOUR meaningful short turns. Speech and physical performance run together: characters gesture, handle objects, shift posture and REACT WHILE LISTENING. Never one line followed by dead air, and never two characters frozen while a third talks.",
  action:
    "Dialogue optional and usually minimal - a shout, a warning, a name. One continuous, readable physical progression carries the whole clip. What changes is visible.",
  establishing:
    "Little or no dialogue. The environment, the staging and a motivated camera move establish something the story actually needs - who lives here, what the weather is doing, what is missing. Not scenery for its own sake.",
  reaction:
    "Silence is the point. A held expression, a gesture, a realisation or a decision landing on a face. Do NOT fill a reaction beat with exposition explaining the reaction.",
  "silent-emotional":
    "ZERO dialogue is explicitly correct here. The feeling is carried by what the character does with their body, their hands and an object - and by what the camera chooses to hold on.",
  "montage-element":
    "ONE compressed visual idea. Dialogue optional, usually none. It must differ MEANINGFULLY from the other montage elements: a new season, a new cost, a new state - not the same image again.",
  "comedy-beat":
    "Protect the timing. Setup, then a gap where the audience gets there first, then the payoff. Filling every second with speech is how comedy dies. The reaction is usually funnier than the line.",
  transition:
    "Movement through place, time or situation - and it still needs a narrative reason to exist. A character crossing a yard for the whole shot with nothing changing is filler with a walk in it.",
};

/**
 * The performance-type block for the scene prompt.
 *
 * Emitted as a vocabulary the director chooses from, never as a rotation.
 * Mechanically alternating types to look varied is the same failure as
 * mechanically filling dialogue to look full.
 */
export function buildPerformanceTypeGuidance(): string {
  const rows = Object.entries(PERFORMANCE_TYPE_GUIDANCE)
    .map(([type, guidance]) => `   - ${type.toUpperCase()}: ${guidance}`)
    .join("\n");

  return `PERFORMANCE TYPE - WHAT KIND OF TEN SECONDS THIS IS:
   Set 'contract.performanceType' from what the STORY needs here, then write the scene as that kind of scene.
${rows}
   - CHOOSE FROM STORY NEED, NEVER FROM VARIETY. Do not rotate through these types to make the timeline look mixed. If three scenes in a row genuinely need dialogue, write three dialogue scenes; if the story needs four quiet beats, write four.
   - The type is not a licence either way: a 'silent-emotional' scene still has to CHANGE something, and a 'dialogue-scene' still has to fit inside what ${SECONDS_PER_SCENE} seconds can hold.`;
}

/**
 * Flexible choreography for the ten seconds.
 *
 * Deliberately phrased as a shape rather than timestamps - a strong scene may
 * use a completely different rhythm, and the objective is only to remove dead
 * air while protecting silence that is doing work.
 */
export function buildChoreographyGuidance(secondsPerScene: number = SECONDS_PER_SCENE): string {
  const orient = Math.round(secondsPerScene * 0.2);
  const main = Math.round(secondsPerScene * 0.7);

  return `PERFORMANCE CHOREOGRAPHY - THE CLIP IS CONTINUOUS ACTING, NOT A LINE READING:
   - Roughly: the first ~${orient}s continues the previous moment and orients the eye; the middle carries the primary performance; the last ~${secondsPerScene - main}s lands a reaction, a consequence, a decision, or the handoff into the next shot.
   - This is a FLEXIBLE shape, not mandatory timestamps. A strong scene can use a different rhythm entirely.
   - The objective: NO MEANINGLESS DEAD AIR, while preserving silence that is doing something.
   - Whoever is not speaking is still ACTING - listening, reacting, working, handling something, shifting weight, looking away. Characters must not freeze while another character talks.`;
}

/**
 * The speakability envelope, phrased for the prompt.
 *
 * States the numbers and then states, twice, that they are not a quota -
 * because the previous version of this rule was read as a target and produced
 * 33 scenes of exactly six turns.
 */
export function buildSpeakabilityGuidance(
  language: string,
  secondsPerScene: number = SECONDS_PER_SCENE
): string {
  const env = wordEnvelope(language, secondsPerScene);

  return `WHAT ACTUALLY FITS IN ${secondsPerScene} SECONDS:
   - Spoken ${language} runs at roughly ${speechRateFor(language)} words a second, and the shot also needs breath, reaction and physical action. A normal dialogue-driven scene therefore sits around ${env.comfortable - 4} to ${env.comfortable + 4} SPOKEN WORDS IN TOTAL - typically two to four short turns.
   - THIS IS AN ENVELOPE, NOT A QUOTA. Never pad a scene to reach it. Never cut a line that matters merely to stay under it. It describes what can be PERFORMED, not what a scene should contain.
   - Scenes that are not dialogue scenes will sit well below it, and that is correct - do not push speech into an establishing shot, an action beat, a montage image or a moment of stillness to make the numbers even.
   - Dialogue much beyond ${env.ceiling} words cannot be spoken in the clip; the video model will rush or clip it, and the shot is wasted.
   - Every scene carrying the same amount of talk is itself a form of repetition. Let the density vary with what each scene is.

DENSITY FOLLOWS THE PERFORMANCE TYPE:
   - 'dialogue-scene': the full envelope is available, and it must be spent on an EXCHANGE. Two or more characters SPEAK - someone asks and someone answers, someone cuts in, someone corrects. One character delivering every line while the others stand there is not a dialogue scene; it is a monologue with an audience, and it is the single most common way these come out flat. If only one character has anything to say, the scene is a different TYPE - label it honestly.
   - 'comedy-beat': well under the envelope. Setup, then the gap, then the payoff. Filling the pause with words is how the joke dies.
   - 'action': little or no speech. A shout, a name, a warning - not a conversation mid-chase.
   - 'transition': minimal. Movement carries it.
   - 'reaction', 'establishing', 'montage-element', 'silent-emotional': at or near zero. These are carried by the image. Do NOT add a line to explain what the picture already says.
   - SPEECH MUST EARN ITS SECONDS. A line that describes what the audience can already see spends runtime and adds nothing - "he falls" spoken over a fall. Say what the picture CANNOT: what someone wants, fears, decides, or refuses. This is about the information a line carries, not about how a character speaks: a character's own voice and way of talking is theirs to keep.`;
}
