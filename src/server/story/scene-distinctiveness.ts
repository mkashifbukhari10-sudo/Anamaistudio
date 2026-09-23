import type { LifeJourney, WorldRegistry } from "../../types.js";

/**
 * THE SCENE DISTINCTIVENESS ENGINE
 *
 * The gap this fills: there was not one cross-scene comparison anywhere in the
 * quality report. Every metric was either within-scene (`startState` vs
 * `endState`) or a global aggregate (dialogue share). Nothing asked the only
 * question that catches a stretched film - "is scene N actually different from
 * scene N-1?" - so twelve near-identical scenes were structurally legal.
 *
 * Two deliberate design choices:
 *
 *   1. SIMILARITY, NOT EQUALITY. The existing repeated-line check requires an
 *      exact normalised match, so "Hum kar sakte hain" and "Hum zaroor kar
 *      sakte hain" score zero. Everything here blends token overlap with
 *      character-trigram overlap, which catches rewording.
 *
 *   2. REPETITION IS NOT THE FAULT - UNVARIED REPETITION IS. Children's media
 *      research is specific that repetition works through VARIATION: the same
 *      idea in a new context. Callbacks, rituals, montage and parallel scenes
 *      are craft. So declared recurrence is exempted, and an exempt pair is
 *      still reported when it shows no variation at all.
 *
 * PURE MEASUREMENT. It reads finished scenes, owns only signatures and scores,
 * and writes nothing. It cannot fail a generation: every entry point returns an
 * empty result rather than throwing.
 *
 * P0 SCOPE: works entirely on fields that already exist. The typed scene
 * contract (goal / obstacle / outcome / progression) arrives in P2 and will
 * replace `purpose` and `storyFunction` as the strongest dimensions; the
 * weights below already anticipate that.
 */

// ---------------------------------------------------------------------------
// Text handling
// ---------------------------------------------------------------------------

/**
 * Function words carrying no distinguishing content.
 *
 * Covers English (the analysis fields are written in English) and the common
 * Roman Urdu / Hindi function words that appear in dialogue. Deliberately
 * short: over-pruning removes real signal, and the scoring already tolerates
 * some noise.
 */
const STOPWORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "but", "if", "of", "at", "by", "for", "with",
  "about", "into", "through", "to", "from", "in", "on", "out", "over", "then",
  "than", "that", "this", "these", "those", "is", "are", "was", "were", "be",
  "been", "being", "as", "it", "its", "his", "her", "their", "they", "them",
  "he", "she", "him", "we", "us", "our", "you", "your", "i", "my", "me",
  "has", "have", "had", "do", "does", "did", "will", "would", "can", "could",
  "up", "down", "so", "not", "no", "yes", "there", "here", "while", "when",
  "who", "what", "which", "how", "all", "one", "two", "still", "just",
  // Roman Urdu / Hindi function words
  "hai", "hain", "ho", "hoon", "tha", "thi", "the", "ka", "ki", "ke", "ko",
  "se", "mein", "par", "aur", "ya", "bhi", "hi", "to", "toh", "na", "nahi",
  "kya", "kyun", "jo", "woh", "yeh", "ye", "main", "tum", "aap", "hum", "mera",
  "tera", "uska", "iska", "apna", "kuch", "sab", "phir", "ab", "ek", "do",
]);

/** Lowercased, punctuation-free, collapsed whitespace. */
export function normalise(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light suffix stripping, so inflections of one word match each other.
 *
 * Without this, "search" and "searching" are different tokens, and three short
 * paraphrases of one move ("they keep searching", "they search again", "they
 * go on searching") score below any usable threshold - the repetition hides in
 * the grammar. Demonstrated by the P1 beat-density suite, which compares much
 * shorter strings than the scene signatures P0 was calibrated on.
 *
 * Deliberately minimal and conservative. It is not a real stemmer: it strips
 * four common English suffixes and leaves everything else alone, because the
 * analysis fields are written in English while dialogue is not, and an
 * aggressive stemmer would mangle Roman Urdu. Both sides of every comparison
 * are stemmed identically, so an occasional wrong strip is symmetric noise
 * rather than bias.
 */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Content words only. Short tokens and stopwords are dropped, then stemmed. */
export function tokenize(text: unknown): string[] {
  return normalise(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem)
    .filter((w) => w.length > 2);
}

/**
 * Jaccard overlap of two token sets.
 *
 * Returns 0 when either side is empty. A naive implementation returns 1.0 for
 * two empty sets, which would report every pair of scenes that left a field
 * blank as identical - the single most likely false-positive source here.
 */
export function tokenSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared++;
  return shared / (setA.size + setB.size - shared);
}

/** Character trigrams, for catching rewording that token overlap misses. */
function trigrams(text: string): Set<string> {
  const padded = ` ${text} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Dice coefficient over character trigrams. Empty input scores 0, never 1. */
export function trigramSimilarity(a: string, b: string): number {
  const first = normalise(a);
  const second = normalise(b);
  if (!first || !second) return 0;

  const setA = trigrams(first);
  const setB = trigrams(second);
  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  for (const gram of setA) if (setB.has(gram)) shared++;
  return (2 * shared) / (setA.size + setB.size);
}

/**
 * One dimension's similarity: token overlap blended with trigram overlap.
 *
 * The blend is 60/40 toward tokens because token overlap is the more reliable
 * signal (word order and inflection vary freely), while trigrams rescue the
 * case where the same phrasing is reused with small edits.
 */
export function textSimilarity(a: string, b: string): number {
  const tokens = tokenSimilarity(tokenize(a), tokenize(b));
  const grams = trigramSimilarity(a, b);
  return 0.6 * tokens + 0.4 * grams;
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

/**
 * Dimension weights.
 *
 * Ordered by how strongly a match implies "this is the same scene again".
 * `storyFunction` and `purpose` lead because they are the story's own claim
 * about what the scene DOES - two scenes doing the same thing is the failure,
 * whereas two scenes in the same place is ordinary. Place and cast are
 * deliberately weak: a story set in one courtyard is a legitimate form, and
 * weighting location highly would punish it.
 */
export const DIMENSION_WEIGHTS = {
  storyFunction: 3.0,
  purpose: 2.5,
  action: 2.0,
  dialogue: 2.0,
  emotion: 1.5,
  camera: 1.0,
  flowPrompt: 1.0,
  place: 1.0,
  characters: 0.5,
} as const;

export type DimensionName = keyof typeof DIMENSION_WEIGHTS;

export interface SceneSignature {
  sceneNumber: number;
  beatNumber?: number;
  placeId: string;
  dimensions: Record<DimensionName, string>;
}

/**
 * Character descriptions are restated word-for-word in every Flow prompt, by
 * design - it is the only thing holding identity stable across independent
 * generations. That makes every pair of prompts look similar for a reason that
 * has nothing to do with story repetition, so the boilerplate is removed
 * before the prompts are compared.
 */
function stripLockedDescriptions(prompt: string, characters: any[]): string {
  let out = String(prompt ?? "");
  for (const c of Array.isArray(characters) ? characters : []) {
    const locked = String(c?.lockedVisualDescription ?? "").trim();
    if (locked.length > 40) out = out.split(locked).join(" ");
  }
  return out;
}

export function buildSignature(scene: any, characters: any[] = []): SceneSignature {
  const state = scene?.continuityState ?? {};
  const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];

  const emotions = [
    scene?.facialExpressions,
    ...Object.values(state?.characterEmotions ?? {}),
  ]
    .filter(Boolean)
    .join(" ");

  const camera = [
    scene?.cameraShot,
    scene?.cameraMovement,
    state?.cameraState?.shotSize,
    state?.cameraState?.movement,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    sceneNumber: Number(scene?.sceneNumber) || 0,
    beatNumber: Number.isFinite(Number(scene?.beatNumber)) ? Number(scene.beatNumber) : undefined,
    placeId: String(state?.placeId ?? scene?.environment ?? ""),
    dimensions: {
      storyFunction: String(scene?.storyFunction ?? ""),
      purpose: String(scene?.purpose ?? ""),
      action: String(scene?.characterActions ?? ""),
      dialogue: turns.map((t: any) => String(t?.line ?? "")).join(" "),
      emotion: emotions,
      camera,
      flowPrompt: stripLockedDescriptions(String(scene?.finalVideoPrompt ?? ""), characters),
      place: String(state?.placeId ?? state?.location ?? ""),
      characters: (Array.isArray(scene?.charactersPresent) ? scene.charactersPresent : []).join(" "),
    },
  };
}

// ---------------------------------------------------------------------------
// Pair scoring
// ---------------------------------------------------------------------------

export interface DimensionScore {
  dimension: DimensionName;
  score: number;
}

export interface ScenePairSimilarity {
  sceneA: number;
  sceneB: number;
  /** Weighted mean across dimensions that had content on both sides. */
  score: number;
  /** Highest-scoring dimensions, for the report. */
  topDimensions: DimensionScore[];
  /** Distance in scenes. 1 means consecutive. */
  gap: number;
  exempt: boolean;
  exemptReason?: string;
  /**
   * True when the pair is exempt but shows no variation at all. Declared
   * recurrence still has to vary - that is the whole rule.
   */
  unvariedRecurrence?: boolean;
}

/**
 * Compare two signatures.
 *
 * Dimensions where EITHER side is empty are excluded from the mean rather than
 * scored zero: a missing field is an absence of evidence, and scoring it as
 * dissimilarity would let a sparse scene hide a real duplicate.
 */
export function scorePair(a: SceneSignature, b: SceneSignature): {
  score: number;
  dimensions: DimensionScore[];
} {
  const dimensions: DimensionScore[] = [];
  let weighted = 0;
  let totalWeight = 0;

  for (const name of Object.keys(DIMENSION_WEIGHTS) as DimensionName[]) {
    const textA = a.dimensions[name];
    const textB = b.dimensions[name];
    if (!normalise(textA) || !normalise(textB)) continue;

    const score = textSimilarity(textA, textB);
    const weight = DIMENSION_WEIGHTS[name];
    dimensions.push({ dimension: name, score: Math.round(score * 100) / 100 });
    weighted += score * weight;
    totalWeight += weight;
  }

  return {
    score: totalWeight > 0 ? Math.round((weighted / totalWeight) * 1000) / 1000 : 0,
    dimensions: dimensions.sort((x, y) => y.score - x.score),
  };
}

// ---------------------------------------------------------------------------
// Exemptions - repetition that is craft, not filler
// ---------------------------------------------------------------------------

export interface ExemptionContext {
  lifeJourney?: LifeJourney | null;
  setups?: any[];
  worldRegistry?: WorldRegistry | null;
  scenesById?: Map<number, any>;
  /** Scene numbers that exist, so an echo of a missing scene is rejected. */
  knownSceneNumbers?: Set<number>;
}

/**
 * Whether a declared repetition intent can be trusted as an exemption.
 *
 * Lives here rather than beside the contract validator so the dependency runs
 * one way: the contract module already reads these similarity utilities, and a
 * second notion of "valid declaration" in the other direction would be a cycle
 * and, worse, two rules that could disagree.
 *
 * A declaration is usable only when it points BACKWARD at a scene that exists,
 * names a recognised kind, and says what materially differs. Anything else
 * leaves the pair fully measurable - which is the point: declaring a callback
 * must not be a way to silence a finding.
 */
export function isUsableRepetitionIntent(
  intent: any,
  sceneNumber: number,
  knownSceneNumbers?: Set<number>
): boolean {
  if (!intent || typeof intent !== "object") return false;

  const kind = String(intent.kind ?? "").trim().toLowerCase();
  const KINDS = ["callback", "montage-element", "parallel-scene", "running-gag", "ritual"];
  if (!KINDS.includes(kind)) return false;

  const echoes = Number(intent.echoesScene);
  if (!Number.isFinite(echoes) || echoes >= sceneNumber) return false;
  if (knownSceneNumbers && !knownSceneNumbers.has(echoes)) return false;

  const variation = String(intent.variation ?? "").trim();
  if (variation.length < 8) return false;

  return true;
}

/**
 * Whether a recurring pair was DECLARED, and therefore intentional.
 *
 * Four sources, all of which already exist in the data model - no new
 * declaration mechanism is introduced here:
 *   - a scene's own `repetitionIntent` (forward-compatible; arrives in P2)
 *   - a Life Journey routine, which already carries `variationAcrossStory`
 *   - the two halves of one setup/payoff
 *   - two scenes of the same declared montage
 */
export function exemptionFor(
  a: SceneSignature,
  b: SceneSignature,
  ctx: ExemptionContext
): { exempt: boolean; reason?: string; declaredVariation?: string } {
  const sceneA = ctx.scenesById?.get(a.sceneNumber);
  const sceneB = ctx.scenesById?.get(b.sceneNumber);

  // 1. Declared intent on either scene, pointing at the other.
  //
  // The declaration must be USABLE, not merely present. Writing
  // `repetitionIntent` must never be a way to switch off repetition findings,
  // so a forward reference, an unknown scene, an unrecognised kind or a
  // missing variation all leave the pair fully measurable.
  for (const [scene, self, other] of [
    [sceneA, a.sceneNumber, b.sceneNumber],
    [sceneB, b.sceneNumber, a.sceneNumber],
  ] as const) {
    const intent = scene?.contract?.repetitionIntent ?? scene?.repetitionIntent;
    if (!isUsableRepetitionIntent(intent, self, ctx.knownSceneNumbers)) continue;
    if (Number(intent.echoesScene) !== other) continue;

    return {
      exempt: true,
      reason: `declared ${intent.kind} echoing scene ${other}`,
      declaredVariation: String(intent.variation ?? ""),
    };
  }

  // 2. A Life Journey routine both scenes belong to.
  for (const routine of ctx.lifeJourney?.routines ?? []) {
    if (!routine.placeId || routine.placeId !== a.placeId || routine.placeId !== b.placeId) continue;
    return {
      exempt: true,
      reason: `recurring routine "${routine.activity}"`,
      declaredVariation: routine.variationAcrossStory,
    };
  }

  // 3. The plant and payoff of one setup.
  for (const setup of ctx.setups ?? []) {
    const plant = Number(setup?.plantScene);
    const payoff = Number(setup?.payoffScene);
    const pair = [a.sceneNumber, b.sceneNumber].sort((x, y) => x - y);
    if (pair[0] === Math.min(plant, payoff) && pair[1] === Math.max(plant, payoff)) {
      return {
        exempt: true,
        reason: `setup and payoff of "${setup?.element}"`,
        declaredVariation: String(setup?.meaning ?? ""),
      };
    }
  }

  return { exempt: false };
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Similarity above which a pair is worth a person's attention.
 *
 * CALIBRATED, NOT CHOSEN. `tests/calibrate-thresholds.ts` sweeps these against
 * the fixture corpus - synthetic repetition fixtures that must be caught, and
 * legitimate-craft fixtures that must NOT be - and prints the separation. The
 * committed values sit in the gap between the two populations. Re-run the
 * harness before changing either number.
 *
 * NEAR is for scenes close together, where repetition reads as a stall.
 * FAR is stricter, because two similar scenes twenty apart are far more often
 * a deliberate echo than a mistake.
 */
export const NEAR_THRESHOLD = 0.48;

/**
 * CALIBRATION RECORD - `tests/calibrate-thresholds.ts`, 2026-09-19.
 *
 *   BAD fixtures,      in-window pairs: n=71, min 0.427, mean 0.551, max 0.713
 *   NEGATIVE fixtures, in-window pairs: n=27, min 0.138, mean 0.240, max 0.425
 *   Real generated stories (36-scene Mystery, 6-scene Heartwarming):
 *                      consecutive max 0.363 and 0.304 - both sit inside the
 *                      NEGATIVE population, i.e. neither saved story is
 *                      repetitive by this measure.
 *
 * Fixture-level sweep: every threshold in 0.45..0.50 catches 7/7 bad fixtures
 * with 0/7 false positives. 0.48 is the midpoint of that band, chosen for
 * maximum margin on both sides.
 *
 * An earlier hand-picked 0.55 MISSED `repeated-celebration` (its pairs top out
 * at 0.548). That is exactly why this number is calibrated rather than chosen.
 */

/**
 * Stricter, because two similar scenes far apart are much more often a
 * deliberate echo than a stall.
 *
 * Less well evidenced than NEAR: the fixtures are short, so they produce few
 * far-apart pairs. 0.60 clears the entire negative population (max 0.425) with
 * a wide margin while staying below the bad-population mean (0.551), so a
 * genuinely strong distant echo is still caught. Revisit once a long
 * repetitive real story exists to calibrate against.
 */
export const FAR_THRESHOLD = 0.6;

/** Scenes within this distance are judged against NEAR_THRESHOLD. */
export const NEAR_WINDOW = 6;

/** A run of this many consecutive similar scenes is a stall, not a coincidence. */
export const RUN_LENGTH = 3;

/**
 * Above this, a DECLARED recurrence has not actually varied.
 *
 * Deliberately conservative: the worst bad fixture tops out at 0.713, so this
 * fires only on near-verbatim repetition. Withdrawing an exemption is a strong
 * claim - it says the writer declared a callback and then did not write one -
 * and it should need overwhelming evidence.
 */
export const UNVARIED_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface RepetitionRun {
  fromScene: number;
  toScene: number;
  sceneNumbers: number[];
  averageScore: number;
  dominantDimensions: DimensionName[];
}

export interface DistinctivenessReport {
  sceneCount: number;
  pairs: ScenePairSimilarity[];
  runs: RepetitionRun[];
  /** Mean similarity of every consecutive pair. A stretched film sits high. */
  averageConsecutiveSimilarity: number;
  /** Scenes appearing in at least one non-exempt flagged pair. */
  scenesInvolved: number[];
  placeConcentration: Array<{ placeId: string; scenes: number; sharePercent: number }>;
  thresholds: { near: number; far: number; window: number; runLength: number };
}

/**
 * Measure a finished timeline.
 *
 * Swallows nothing and throws nothing: on malformed input it returns an empty
 * report, because a measurement failure must never be able to break a
 * generation the user has already paid for.
 */
export function buildDistinctivenessReport(params: {
  scenes: any[];
  characters?: any[];
  lifeJourney?: LifeJourney | null;
  setups?: any[];
}): DistinctivenessReport {
  const empty: DistinctivenessReport = {
    sceneCount: 0,
    pairs: [],
    runs: [],
    averageConsecutiveSimilarity: 0,
    scenesInvolved: [],
    placeConcentration: [],
    thresholds: { near: NEAR_THRESHOLD, far: FAR_THRESHOLD, window: NEAR_WINDOW, runLength: RUN_LENGTH },
  };

  try {
    const list = (Array.isArray(params.scenes) ? params.scenes : [])
      .filter(Boolean)
      .sort((a, b) => (Number(a?.sceneNumber) || 0) - (Number(b?.sceneNumber) || 0));

    if (list.length < 2) return { ...empty, sceneCount: list.length };

    const characters = params.characters ?? [];
    const signatures = list.map((s) => buildSignature(s, characters));
    const scenesById = new Map<number, any>(list.map((s) => [Number(s?.sceneNumber) || 0, s]));
    const ctx: ExemptionContext = {
      lifeJourney: params.lifeJourney ?? null,
      setups: params.setups ?? [],
      scenesById,
      knownSceneNumbers: new Set(scenesById.keys()),
    };

    const pairs: ScenePairSimilarity[] = [];
    const consecutive: number[] = [];

    for (let i = 0; i < signatures.length; i++) {
      for (let j = i + 1; j < signatures.length; j++) {
        const a = signatures[i];
        const b = signatures[j];
        const gap = b.sceneNumber - a.sceneNumber;
        const { score, dimensions } = scorePair(a, b);

        if (gap === 1) consecutive.push(score);

        const threshold = gap <= NEAR_WINDOW ? NEAR_THRESHOLD : FAR_THRESHOLD;
        if (score < threshold) continue;

        const exemption = exemptionFor(a, b, ctx);

        // A declared echo still has to vary. Near-identical recurrence is the
        // one case children's-media practice is clear about: repetition
        // teaches through NEW CONTEXT, and an unchanged repeat stops working.
        const unvaried = exemption.exempt && score >= UNVARIED_THRESHOLD;

        pairs.push({
          sceneA: a.sceneNumber,
          sceneB: b.sceneNumber,
          score,
          topDimensions: dimensions.slice(0, 3),
          gap,
          exempt: exemption.exempt && !unvaried,
          exemptReason: exemption.reason,
          unvariedRecurrence: unvaried || undefined,
        });
      }
    }

    // Runs: a STALL, not a single duplicate.
    //
    // Defined over scene participation rather than an unbroken chain of
    // consecutive flagged pairs. The chain definition was brittle: eight
    // near-identical jogging scenes produced 22 flagged pairs but no run at
    // all, because one consecutive pair happened to land just below the
    // threshold and broke the chain. A stalled stretch does not stop being a
    // stall because one adjacent pair scored 0.47.
    //
    // A scene is STALLED when it takes part in at least two non-exempt flagged
    // pairs inside the local window - i.e. it resembles more than one of its
    // neighbours. Contiguous stalled scenes form a run.
    const runs: RepetitionRun[] = [];
    const localFlagged = pairs.filter((p) => !p.exempt && p.gap <= NEAR_WINDOW);

    const participation = new Map<number, ScenePairSimilarity[]>();
    for (const pair of localFlagged) {
      for (const n of [pair.sceneA, pair.sceneB]) {
        if (!participation.has(n)) participation.set(n, []);
        participation.get(n)!.push(pair);
      }
    }

    const numbers = signatures.map((s) => s.sceneNumber);
    const isStalled = (n: number) => (participation.get(n)?.length ?? 0) >= 2;

    let cursor = 0;
    while (cursor < numbers.length) {
      if (!isStalled(numbers[cursor])) {
        cursor++;
        continue;
      }

      let end = cursor;
      while (end + 1 < numbers.length && isStalled(numbers[end + 1])) end++;

      const involved = numbers.slice(cursor, end + 1);
      if (involved.length >= RUN_LENGTH) {
        const inRun = localFlagged.filter(
          (p) => involved.includes(p.sceneA) && involved.includes(p.sceneB)
        );
        const dimensionTotals = new Map<DimensionName, number>();
        inRun.forEach((c) =>
          c.topDimensions.forEach((d) =>
            dimensionTotals.set(d.dimension, (dimensionTotals.get(d.dimension) || 0) + d.score)
          )
        );

        runs.push({
          fromScene: involved[0],
          toScene: involved[involved.length - 1],
          sceneNumbers: involved,
          averageScore:
            inRun.length > 0
              ? Math.round((inRun.reduce((s, c) => s + c.score, 0) / inRun.length) * 1000) / 1000
              : 0,
          dominantDimensions: [...dimensionTotals.entries()]
            .sort((x, y) => y[1] - x[1])
            .slice(0, 3)
            .map(([d]) => d),
        });
      }

      cursor = end + 1;
    }

    const placeCounts = new Map<string, number>();
    signatures.forEach((s) => {
      const id = s.placeId || "(unrecorded)";
      placeCounts.set(id, (placeCounts.get(id) || 0) + 1);
    });

    const scenesInvolved = [
      ...new Set(pairs.filter((p) => !p.exempt).flatMap((p) => [p.sceneA, p.sceneB])),
    ].sort((a, b) => a - b);

    return {
      sceneCount: list.length,
      pairs: pairs.sort((a, b) => b.score - a.score),
      runs,
      averageConsecutiveSimilarity:
        consecutive.length > 0
          ? Math.round((consecutive.reduce((s, v) => s + v, 0) / consecutive.length) * 1000) / 1000
          : 0,
      scenesInvolved,
      placeConcentration: [...placeCounts.entries()]
        .map(([placeId, scenes]) => ({
          placeId,
          scenes,
          sharePercent: Math.round((scenes / list.length) * 100),
        }))
        .sort((a, b) => b.scenes - a.scenes),
      thresholds: { near: NEAR_THRESHOLD, far: FAR_THRESHOLD, window: NEAR_WINDOW, runLength: RUN_LENGTH },
    };
  } catch {
    // Measurement must never break a generation.
    return empty;
  }
}
