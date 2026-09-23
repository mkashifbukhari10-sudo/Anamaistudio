import { SECONDS_PER_SCENE } from "../../shared/duration.js";
import { countWords, speechRateFor } from "./performance-budget.js";


/**
 * BEAT CLOCK — what occupies which second of the shot.
 *
 * Measured over a real 36-scene generation, NOT ONE prompt carried any internal
 * time cue. Ten seconds were handed to Veo as an undifferentiated paragraph
 * holding an opening frame, a character bible, an action, three dialogue lines,
 * camera notes and Foley, with no statement of what happens when. Veo paced it
 * arbitrarily, which is the direct mechanical cause of both complaints: dead
 * time (one line stretched across the clip) and rushed conversation (three turns
 * compressed into two seconds while the camera move eats the rest).
 *
 * So this allocates the shot. Speech rows are sized from the real word count at
 * the language's speaking rate; action rows take what is left. It is a
 * director's pacing proposal, which is exactly what was missing - not a claim
 * to know the single correct interleaving.
 *
 * It does NOT push words into silent scenes. A scene with no dialogueTurns
 * produces a clock of pure action rows, which is a real improvement for
 * establishing, action, montage and silent-emotional shots: those suffer from
 * unallocated time too.
 */

/** A conversational gap between turns. Speech is not gapless. */
const BREATH_SECONDS = 0.3;

/** Even a one-word line needs time to land. */
const MIN_SPEECH_SECONDS = 0.6;

/** An action beat below this cannot read on screen. */
const MIN_ACTION_SECONDS = 0.5;

export type BeatKind = "action" | "speech";

export interface BeatRow {
  startSeconds: number;
  endSeconds: number;
  kind: BeatKind;
  text: string;
  /** Present on speech rows only. */
  speaker?: string;
  /** What the speaker is doing while they say it, when the scene planned it. */
  accompanyingAction?: string;
}

export interface BeatClock {
  sceneNumber: number;
  secondsPerScene: number;
  rows: BeatRow[];
  speechSeconds: number;
  actionSeconds: number;
  /**
   * True when the scene's content cannot fit the shot at a speakable rate.
   *
   * The clock is not silently compressed to hide this - a shot that genuinely
   * holds too much should say so, and the feasibility report flags it
   * separately. Reporting beats pretending.
   */
  overflows: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The action beats of a scene, in order, with an actor named on each. */
function actionBeatsOf(scene: any): string[] {
  const whole = String(scene?.characterActions || "").trim();
  if (!whole) return [];
  return carrySubjectForward(segmentAction(whole), scene);
}

/**
 * Splits an action line into ordered beats WITHOUT losing any of it.
 *
 * The obvious move was to reuse measureActionDensity().beatTexts, which already
 * segments in English and Roman Urdu. Measured across 186 real scenes those
 * clauses cover only 48% of the action text - it samples the clauses it needs in
 * order to COUNT beats, and drops the rest. Building a schedule on it silently
 * deleted half the action from every prompt: "Beeju grips the rim and leans in,
 * then Motu shoves the pot" reduces to "leans in".
 *
 * So the clock partitions the text itself. Every word of the source lands in
 * exactly one row. measureActionDensity is left alone, doing the job it is
 * calibrated for.
 */
/**
 * 'before' is deliberately NOT a marker.
 *
 * It reads as a sequence connective ("X happens, before Y happens") but in
 * practice it is usually a preposition - "bowing his head before Kaddu Dada",
 * "clangs against the marker before settling in the ditch". Splitting there
 * consumes the word and leaves "bowing his head Kaddu Dada". A missed split
 * costs one longer row, which is harmless; a wrong split produces direction
 * that cannot be filmed.
 */
const SEQUENTIAL_SPLIT =
  /(?:[.!?]+\s+)|,?\s+(and\s+then|then|after\s+that|next|meanwhile|phir|fir|uske\s+baad|iske\s+baad)\s+/gi;

/** More rows than this stops reading as a schedule and starts reading as a list. */
const MAX_ACTION_ROWS = 5;

/**
 * Spans that must never be split, even though they contain sentence
 * punctuation.
 *
 * Sound effects and interjections are written with terminal marks inside
 * quotes or brackets - "Tunn! Tunn!", ('Tann! Tann!'), —'THAKK!'—. Splitting
 * there produced clock rows like "Aloo Mian tunn!—runs his thumb over the
 * bevel", which is direction no one can film.
 */
const PROTECTED_SPAN = /(["'«»]).*?\1|\([^)]*\)|—[^—]*—/g;

/** Masks protected spans, runs a transform, then restores them. */
function withProtectedSpans(text: string, transform: (masked: string) => string[]): string[] {
  const stash: string[] = [];
  PROTECTED_SPAN.lastIndex = 0;
  const masked = text.replace(PROTECTED_SPAN, (m) => {
    stash.push(m);
    return `@@${stash.length - 1}@@`;
  });

  // A capturing split emits `undefined` for alternation branches that did not
  // match, so every piece is coerced before use.
  return transform(masked).map((part) =>
    String(part ?? "").replace(/@@(\d+)@@/g, (_, i) => stash[Number(i)] ?? "")
  );
}

/** The first word of a fragment, stripped to letters. */
function leadingWord(part: string): string {
  const words = part.trim().split(/\s+/).filter(Boolean);
  return (words[0] || "").toLowerCase().replace(/[^a-z']/g, "");
}

/** A leading -ing word with no subject before it continues the previous clause. */
function startsWithParticiple(part: string): boolean {
  const first = leadingWord(part);
  return /ing$/.test(first) && !/^(nothing|something|everything|morning|evening)$/.test(first);
}

/**
 * True when a fragment belongs to the clause before it rather than being its
 * own beat.
 *
 * Deliberately NARROW: only a bare interjection ("Tunn") or a participial tail
 * ("settling in the dry ditch"). A short but complete clause - "Motu shoves",
 * "phir chalta hai" - is a real beat and keeps its own row.
 */
function isContinuation(part: string): boolean {
  const words = part.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  return startsWithParticiple(part);
}

/**
 * True when a carried subject can be prefixed without producing nonsense.
 *
 * Stricter than isContinuation, and asking a different question: not "is this a
 * beat?" but "would writing a name in front of it read as English?". A two-word
 * tail like "eases off" is a legitimate beat and still must not become
 * "Beeju eases off" when Beeju was never the actor.
 */
function canTakeSubject(part: string): boolean {
  const words = part.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  if (startsWithParticiple(part)) return false;
  return Boolean(leadingWord(part));
}

export function segmentAction(text: string): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];

  // Split with the connective CAPTURED, so a fragment folded back into its
  // clause keeps the word that joined them - otherwise "Rain drums on the
  // glass, then eases off" came back as "Rain drums on the glass eases off".
  const pieces = withProtectedSpans(raw, (masked) => {
    SEQUENTIAL_SPLIT.lastIndex = 0;
    return masked.split(SEQUENTIAL_SPLIT);
  });

  const clean = (s: string) =>
    String(s || "").trim().replace(/^[,;:\s]+/, "").replace(/[,;:\s]+$/, "");

  let parts: string[] = [];
  for (let i = 0; i < pieces.length; i += 2) {
    const body = clean(pieces[i]);
    // The delimiter that PRECEDED this piece, for use if it has to fold back.
    const joiner = i > 0 ? String(pieces[i - 1] || "").trim().replace(/^,\s*/, "") : "";
    if (!body) continue;

    if (parts.length > 0 && isContinuation(body)) {
      const link = joiner && /^[a-z]/i.test(joiner) ? `, ${joiner} ` : " ";
      parts[parts.length - 1] = `${parts[parts.length - 1]}${link}${body}`;
    } else {
      parts.push(body);
    }
  }

  if (parts.length === 0) parts = [raw];

  // Merge the shortest neighbour pairs until the clock is readable. Merging
  // rather than dropping keeps the partition lossless.
  while (parts.length > MAX_ACTION_ROWS) {
    let at = 0;
    let best = Infinity;
    for (let i = 0; i < parts.length - 1; i++) {
      const size = parts[i].length + parts[i + 1].length;
      if (size < best) { best = size; at = i; }
    }
    parts.splice(at, 2, `${parts[at]}, then ${parts[at + 1]}`);
  }

  return parts;
}

/**
 * Restores the actor to beats that lost it in segmentation.
 *
 * Splitting "Kadoo Bi lifts the packet off the board and carries it to the work
 * table" on its sequential marker leaves "carries it to the work table" - a row
 * with no subject. As a line of prose following the previous clause that reads
 * fine; as a timestamped instruction to a video model it is an action with
 * nobody performing it, and Veo is free to attribute it to the wrong character.
 *
 * The subject is recovered from 'charactersPresent', so this carries no
 * assumption about who any particular story's characters are.
 */
function carrySubjectForward(beats: string[], scene: any): string[] {
  const present = (Array.isArray(scene?.charactersPresent) ? scene.charactersPresent : [])
    .map((c: any) => String(c || "").trim())
    .filter(Boolean);
  if (present.length === 0) return beats;

  // The first beat often loses its actor too, because segmentation can drop a
  // leading clause: "Kadoo Bi's big hand sweeps along the shelf, lifts the
  // packet ..." segments to "lifts the packet ...". So the opening subject is
  // recovered from the action line itself - the last character named before the
  // first beat begins - rather than assumed to be the first cast member.
  let lastSubject = openingSubject(beats[0], scene, present);

  // Every word that appears in any present character's name. "Kaddu Dada dada's
  // other hand sifts..." happened because the beat said "dada's" and the full
  // name "Kaddu Dada" did not match it, so a second subject was bolted on.
  const nameTokens = new Set(
    present.flatMap((n: string) => n.toLowerCase().split(/\s+/)).filter(Boolean)
  );

  return beats.map((beat, index) => {
    // Only a CONTINUATION can be missing its subject. The first beat is the
    // head of the sentence and always carries its own, however it opens -
    // "At his outdoor log bench, Aloo Mian taps the blade" was being turned
    // into "Aloo Mian at his outdoor log bench, Aloo Mian taps the blade".
    if (index === 0) {
      // The subject that carries FORWARD is the last actor in this beat, not
      // the first. "Tipu points at the mat in front of Ammi; Ammi startles"
      // ends with Ammi acting, so the next beat - "then lifts her head with a
      // radiant smile" - belongs to Ammi. Taking the FIRST name produced
      // "Tipu lifts her head": an instruction to show the boy lifting his
      // mother's head, in the most important scene of a real film.
      const carried = lastClauseSubject(beat, present);
      if (carried) {
        lastSubject = carried;
        return beat;
      }
      const head = beat.trim().split(/\s+/).slice(0, 6);
      const named = present.find((name: string) =>
        new RegExp(`(^|[^\\p{L}])${escapeRegex(name)}`, "iu").test(head.join(" "))
      );
      if (named) lastSubject = named;
      return beat;
    }

    // A name only counts as the SUBJECT when it opens the beat. Searching the
    // whole clause treated "looks down unflinchingly at Kaddu Dada" as already
    // having a subject, when Kaddu Dada is the object and the actor is
    // whoever acted in the beat before.
    const opening = beat.trim().split(/\s+/).slice(0, 4);
    const opensWithName = opening.some((w) =>
      nameTokens.has(w.toLowerCase().replace(/['’]s$/, "").replace(/[^a-z]/gi, ""))
    );

    if (opensWithName) {
      const named = present.find((name: string) =>
        new RegExp(`(^|[^\\p{L}])${escapeRegex(name)}`, "iu").test(opening.join(" "))
      );
      if (named) lastSubject = named;
      // A single beat can hand the action over midway. Whoever acts LAST in
      // it is who the next beat continues, for the same reason as index 0.
      const handedOver = lastClauseSubject(beat, present);
      if (handedOver) lastSubject = handedOver;
      return beat;
    }

    if (!lastSubject) return beat;

    // Opens with a subject of its own.
    if (/^\s*(?:he|she|they|it|his|her|their|the|a|an|both|one|two)\b/i.test(beat)) return beat;

    // A fragment that cannot carry a subject is left as it is rather than
    // being turned into an ungrammatical instruction.
    if (!canTakeSubject(beat)) return beat;

    return `${lastSubject} ${beat.charAt(0).toLowerCase()}${beat.slice(1)}`;
  });
}


/**
 * Subordinating conjunctions. A clause they open does NOT change who is acting:
 * in "Ammi blows into the embers, while Meenu huddles beside her" the actor the
 * next beat continues is still Ammi, so Meenu must not be picked up as the new
 * subject.
 */
const SUBORDINATOR =
  /^(?:while|whilst|as|when|whenever|whereas|although|though|since|because|until|till|after|before|if|unless|so)\b/i;

/** Strong clause boundaries. A comma only splits when it hands over with and/then. */
const CLAUSE_BOUNDARY = /[;.]|,\s+(?:and\s+then|and|then)\s+/;

/** Connectives a clause may open with before naming its subject. */
const CLAUSE_LEAD = /^(?:and|then|now|finally|meanwhile|suddenly|immediately)\s+/i;

/**
 * The LAST character to act inside one beat.
 *
 * A beat is frequently a compound sentence that hands the action from one
 * character to another - "Tipu points at the bare mat in front of Ammi; Ammi
 * startles". The name that matters for carrying a subject into the NEXT beat is
 * the one acting when this beat ends, not the one it opened with.
 *
 * Returns "" when no present character opens a main clause, so the caller keeps
 * whatever subject it already had rather than guessing.
 */
function lastClauseSubject(beat: string, present: string[]): string {
  let found = "";
  for (const raw of String(beat ?? "").split(CLAUSE_BOUNDARY)) {
    if (raw === undefined) continue;
    const clause = String(raw).trim().replace(CLAUSE_LEAD, "");
    if (!clause || SUBORDINATOR.test(clause)) continue;
    const named = present.find((name: string) =>
      new RegExp(`^${escapeRegex(name)}(?![\\p{L}])`, "iu").test(clause)
    );
    if (named) found = named;
  }
  return found;
}
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Who is performing the first beat, read off the action line.
 *
 * Returns "" rather than guessing when no present character is named before the
 * beat starts - a wrongly attributed action is worse than an unattributed one.
 */
function openingSubject(firstBeat: string | undefined, scene: any, present: string[]): string {
  const actions = String(scene?.characterActions || "");
  if (!actions) return "";

  const beat = String(firstBeat || "").trim();
  const cut = beat ? actions.indexOf(beat) : -1;
  const prefix = cut > 0 ? actions.slice(0, cut) : actions;

  let subject = "";
  let bestIndex = -1;
  for (const name of present) {
    const match = new RegExp(`(^|[^\\p{L}])${escapeRegex(name)}([^\\p{L}]|$)`, "giu").exec(prefix);
    if (match && match.index > bestIndex) {
      bestIndex = match.index;
      subject = name;
    }
  }
  return subject;
}

/** Spoken turns that actually carry a line. */
function speechTurnsOf(scene: any): Array<{ speaker: string; line: string; accompanyingAction?: string }> {
  const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
  return turns
    .filter((t: any) => String(t?.line || "").trim().length > 0)
    .map((t: any) => ({
      speaker: String(t?.speaker || "").trim() || "Character",
      line: String(t.line).trim(),
      accompanyingAction: String(t?.accompanyingAction || "").trim() || undefined,
    }));
}

/**
 * Allocates the shot second by second.
 *
 * Opens on an action beat when the scene has one, because a shot establishes an
 * image before anyone speaks, then alternates speech and action so listeners get
 * time to react between lines. Leftover rows of either kind are appended in
 * order rather than dropped.
 */
export function buildBeatClock(
  scene: any,
  language: string | undefined,
  secondsPerScene: number = SECONDS_PER_SCENE
): BeatClock {
  const duration = secondsPerScene > 0 ? secondsPerScene : SECONDS_PER_SCENE;
  const rate = speechRateFor(language);

  const actions = actionBeatsOf(scene);
  const speech = speechTurnsOf(scene);

  const speechDurations = speech.map((t) =>
    Math.max(MIN_SPEECH_SECONDS, countWords(t.line) / rate) + BREATH_SECONDS
  );
  const speechSeconds = speechDurations.reduce((a, b) => a + b, 0);

  // Action gives way to speech, not the other way round. A line rendered faster
  // than it can be spoken produces a clipped or gabbled clip, whereas an action
  // beat compressed to its floor still reads. So the action rows are squeezed
  // toward MIN_ACTION_SECONDS first, and speech is only scaled when even that
  // leaves the shot over-full - which is what 'overflows' then reports.
  const actionBudget = Math.max(
    actions.length * MIN_ACTION_SECONDS,
    duration - speechSeconds
  );
  const perAction = actions.length > 0 ? actionBudget / actions.length : 0;

  // Interleave: action, speech, action, speech ... then whatever is left over.
  const ordered: Array<{ kind: BeatKind; index: number }> = [];
  let ai = 0;
  let si = 0;
  while (ai < actions.length || si < speech.length) {
    if (ai < actions.length) ordered.push({ kind: "action", index: ai++ });
    if (si < speech.length) ordered.push({ kind: "speech", index: si++ });
  }

  const rows: BeatRow[] = [];
  let cursor = 0;
  for (const slot of ordered) {
    const length =
      slot.kind === "speech"
        ? speechDurations[slot.index]
        : Math.max(MIN_ACTION_SECONDS, perAction);

    const start = cursor;
    const end = cursor + length;
    cursor = end;

    if (slot.kind === "speech") {
      const turn = speech[slot.index];
      rows.push({
        startSeconds: round1(start),
        endSeconds: round1(end),
        kind: "speech",
        text: turn.line,
        speaker: turn.speaker,
        accompanyingAction: turn.accompanyingAction,
      });
    } else {
      rows.push({
        startSeconds: round1(start),
        endSeconds: round1(end),
        kind: "action",
        text: actions[slot.index],
      });
    }
  }

  const overflows = cursor > duration + 0.05;

  // Fit the rows to the shot. Scaling preserves the proportions the speaking
  // rate produced; it does not hide an overflow, which is reported separately.
  if (rows.length > 0 && cursor > 0) {
    const scale = duration / cursor;
    let running = 0;
    for (const row of rows) {
      const length = (row.endSeconds - row.startSeconds) * scale;
      row.startSeconds = round1(running);
      running += length;
      row.endSeconds = round1(Math.min(running, duration));
    }
    if (rows.length > 0) rows[rows.length - 1].endSeconds = round1(duration);
  }

  return {
    sceneNumber: Number(scene?.sceneNumber) || 0,
    secondsPerScene: duration,
    rows,
    speechSeconds: round1(speechSeconds),
    actionSeconds: round1(Math.max(0, duration - speechSeconds)),
    overflows,
  };
}

/**
 * The clock as prompt text.
 *
 * One row per line, because a Veo prompt is read as instructions and a
 * timestamped list is the clearest form a schedule can take. Speech rows quote
 * the line in full - the prompt is the only place Flow gets speech from, so the
 * clock restates rather than referring back.
 */
export function renderBeatClock(clock: BeatClock): string {
  if (!clock?.rows?.length) return "";

  const rows = clock.rows;
  const last = rows.length - 1;

  // ONE anchor in the middle, not one per clause. Seven timings in eight
  // seconds is over-specification, and the repetition of "then around N
  // seconds in" is itself the mechanical, list-like rhythm this render exists
  // to avoid. The order carries the rest.
  const midpoint = clock.secondsPerScene / 2;
  let middleAnchor = -1;
  if (rows.length > 2) {
    let best = Infinity;
    for (let i = 1; i < last; i++) {
      const distance = Math.abs(rows[i].startSeconds - midpoint);
      if (distance < best) { best = distance; middleAnchor = i; }
    }
  }

  const clauses = rows.map((row, i) => {
    const body =
      row.kind === "speech"
        ? `${row.speaker} says, "${row.text}"` +
          (row.accompanyingAction ? `, ${strip(row.accompanyingAction)}` : "")
        : strip(row.text);

    // Time as a director gives it, not as a timestamp in front of a row. A beat
    // shorter than a second has no useful number - "for the first 0.4 seconds"
    // is false precision - so it is named as a moment instead.
    const span = row.endSeconds - row.startSeconds;
    if (i === 0) {
      return span < 1 ? `it opens on a brief moment where ${body}` : `for the first ${seconds(row.endSeconds)}, ${body}`;
    }
    if (i === last) {
      return span < 1 ? `and it closes as ${body}` : `and through the last ${seconds(span)}, ${body}`;
    }
    if (i === middleAnchor) return `around ${seconds(row.startSeconds)} in, ${body}`;
    return `then ${body}`;
  });

  const joined = clauses.join("; ");
  // A clause ending on a quoted line already carries that line's punctuation,
  // so adding a full stop renders as `"Aise hi.".`
  const tail = /["'?!.]$/.test(joined) ? "" : ".";

  return `The shot plays out over its ${clock.secondsPerScene} seconds like this: ${joined}${tail}`;
}

/** A duration as a director would say it, not as a timestamp. */
function seconds(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded < 1) return "under a second";
  if (rounded === 1) return "second";
  return `${rounded} seconds`;
}

/** Trailing punctuation removed so clauses join cleanly. */
function strip(text: string): string {
  return String(text || "").trim().replace(/[.;\s]+$/, "");
}
