import { textSimilarity, normalise } from "./scene-distinctiveness.js";

/**
 * BEAT DENSITY — catching a stretched film before a single scene is written.
 *
 * The root cause behind the observed repetition is upstream of scene
 * generation. The blueprint must tile beats across scenes 1..N with no gaps,
 * so if a story's material is worth twenty scenes and the runtime demands
 * sixty, some beat is handed eight scenes — and the scene department then
 * CORRECTLY fills eight scenes with that beat. Every anti-filler rule in the
 * system points at the scene department, but the stretch was decided in the
 * beat sheet and merely executed downstream.
 *
 * So the beat sheet is asked two questions:
 *
 *   1. How many scenes does this beat occupy?
 *   2. What materially different thing does each of those scenes DO?
 *
 * And then the second answer is CHECKED rather than believed. A model asked
 * "how many distinct scenes do you need?" will answer with the number it was
 * allocated; a model asked "what does each scene do?" has to write the moves
 * down, and paraphrases of one move are detectable.
 *
 * THE GOVERNING RULE: a beat allocated N scenes must describe N materially
 * different dramatic moves. Different wording for the same change does not
 * count.
 *
 * REPORT ONLY. Nothing here rewrites a beat, reallocates a scene range or
 * invents material — reallocating scenes is a creative decision and inventing
 * story is the one thing this system must never do. It measures and reports.
 *
 * Reuses the P0 similarity primitives deliberately: a second, unrelated
 * notion of "these two things are the same" would drift away from the first
 * and produce contradictory findings about the same story.
 */

// ---------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------

/**
 * Similarity above which two scene descriptions are the SAME dramatic move
 * said differently.
 *
 * CALIBRATED, NOT CHOSEN — `tests/calibrate-beat-density.ts` sweeps this over
 * two fixture populations (planned stretches that must be caught, legitimate
 * multi-scene beats that must not be) and prints the separation. See the
 * calibration record in plan-story-quality.md §26.
 *
 * Deliberately NOT reused from `NEAR_THRESHOLD`: that value was calibrated on
 * multi-dimension scene signatures, while these are single short strings with
 * a different similarity distribution. Sharing the utilities is right; sharing
 * the number would be a coincidence dressed as a decision.
 */
export const MOVE_SIMILARITY_THRESHOLD = 0.45;

/**
 * Story-level padding that stops being noise and becomes a planning problem.
 *
 * A couple of soft scenes across a film is ordinary. A sixth of the runtime
 * with nothing distinct to do is a premise too small for the length that was
 * requested — and the fix for that is more story, never a longer beat.
 */
const PREMISE_STRETCH_FRACTION = 0.15;
const PREMISE_STRETCH_FLOOR = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BeatDensityCode =
  | "unverifiable"
  | "declared-distinctness-unsupported"
  | "beat-stretched"
  | "resolution-stretched"
  | "description-count-mismatch"
  | "premise-too-small";

export interface BeatDensityFinding {
  beatNumber?: number;
  code: BeatDensityCode;
  severity: "warning" | "info";
  title: string;
  detail: string;
  suggestedFix: string;
}

/** A set of scene descriptions inside one beat that say the same thing. */
export interface RepeatedMoveGroup {
  /** Indices into `whatEachSceneDoes`. */
  indices: number[];
  /** The scene numbers those indices land on, where derivable. */
  sceneNumbers: number[];
  representative: string;
  averageSimilarity: number;
}

export interface BeatDensity {
  beatNumber: number;
  name: string;
  sceneStart: number;
  sceneEnd: number;
  allocatedScenes: number;
  /** What the blueprint CLAIMED. Never trusted on its own. */
  declaredDistinctScenes?: number;
  /** How many per-scene descriptions were supplied. */
  describedMoves: number;
  /** Independently verified: clusters of materially different moves. */
  verifiedDistinctMoves: number;
  repeatedGroups: RepeatedMoveGroup[];
  /** Allocated scenes with no distinct move to fill them. */
  stretchScenes: number;
  isFinalBeat: boolean;
  /** False when the beat carried no density fields, so nothing could be checked. */
  verifiable: boolean;
}

export interface BeatDensityReport {
  beats: BeatDensity[];
  findings: BeatDensityFinding[];
  totalScenes: number;
  totalVerifiedDistinctMoves: number;
  totalStretchScenes: number;
  /** True when NO beat carried density fields - old blueprints land here. */
  degraded: boolean;
  /** Beats that could not be checked, by number. */
  unverifiableBeats: number[];
  warnings: number;
  infos: number;
  threshold: number;
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

/**
 * Group descriptions that are the same move worded differently.
 *
 * Single-linkage: a description joins a group when it resembles ANY member.
 * That is the correct linkage here because a stretched beat drifts - scene 3
 * resembles scene 2, scene 4 resembles scene 3, and transitively all three are
 * one move. Complete linkage would break that chain and under-report exactly
 * the failure being hunted.
 */
export function clusterMoves(
  descriptions: string[],
  threshold: number = MOVE_SIMILARITY_THRESHOLD
): number[][] {
  const clusters: number[][] = [];

  descriptions.forEach((text, index) => {
    if (!normalise(text)) {
      // An empty description is its own (empty) move. It cannot match anything
      // - two blanks are not evidence of repetition, they are absence of data.
      clusters.push([index]);
      return;
    }

    const matching: number[] = [];
    clusters.forEach((cluster, clusterIndex) => {
      const hit = cluster.some((member) => {
        const other = descriptions[member];
        if (!normalise(other)) return false;
        return textSimilarity(text, other) >= threshold;
      });
      if (hit) matching.push(clusterIndex);
    });

    if (matching.length === 0) {
      clusters.push([index]);
      return;
    }

    // Joining several clusters at once merges them - transitive sameness.
    const merged = [index, ...matching.flatMap((i) => clusters[i])].sort((a, b) => a - b);
    for (const i of [...matching].sort((a, b) => b - a)) clusters.splice(i, 1);
    clusters.push(merged);
  });

  return clusters.sort((a, b) => a[0] - b[0]);
}

function averageSimilarity(descriptions: string[], indices: number[]): number {
  if (indices.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      total += textSimilarity(descriptions[indices[i]], descriptions[indices[j]]);
      pairs++;
    }
  }
  return pairs > 0 ? Math.round((total / pairs) * 1000) / 1000 : 0;
}

// ---------------------------------------------------------------------------
// Per-beat analysis
// ---------------------------------------------------------------------------

function analyseBeat(
  beat: any,
  isFinalBeat: boolean,
  threshold: number
): { density: BeatDensity; findings: BeatDensityFinding[] } {
  const findings: BeatDensityFinding[] = [];

  const beatNumber = Number(beat?.beatNumber) || 0;
  const name = String(beat?.name ?? `Beat ${beatNumber}`);
  const sceneStart = Number(beat?.sceneStart) || 0;
  const sceneEnd = Number(beat?.sceneEnd) || 0;
  const allocatedScenes = Math.max(0, sceneEnd - sceneStart + 1);

  const declaredRaw = Number(beat?.distinctScenesNeeded);
  const declaredDistinctScenes = Number.isFinite(declaredRaw) && declaredRaw > 0 ? Math.round(declaredRaw) : undefined;

  const descriptions = (Array.isArray(beat?.whatEachSceneDoes) ? beat.whatEachSceneDoes : [])
    .map((d: unknown) => String(d ?? "").trim())
    .filter((d: string) => d.length > 0);

  const verifiable = descriptions.length > 0;

  if (!verifiable) {
    findings.push({
      beatNumber,
      code: "unverifiable",
      severity: "info",
      title: `Beat ${beatNumber} density cannot be checked`,
      detail: `"${name}" spans ${allocatedScenes} scene(s) but lists no per-scene moves.`,
      suggestedFix:
        "Density is verified from 'whatEachSceneDoes'. Without it the scene count is a claim nothing can check.",
    });

    return {
      density: {
        beatNumber,
        name,
        sceneStart,
        sceneEnd,
        allocatedScenes,
        declaredDistinctScenes,
        describedMoves: 0,
        // Unverifiable beats are credited with their full allocation rather
        // than reported as stretched. Reporting "8 scenes of padding" because
        // a field was missing would be inventing a finding.
        verifiedDistinctMoves: allocatedScenes,
        repeatedGroups: [],
        stretchScenes: 0,
        isFinalBeat,
        verifiable: false,
      },
      findings,
    };
  }

  const clusters = clusterMoves(descriptions, threshold);
  const verifiedDistinctMoves = clusters.length;

  const repeatedGroups: RepeatedMoveGroup[] = clusters
    .filter((c) => c.length > 1)
    .map((indices) => ({
      indices,
      sceneNumbers: indices
        .map((i) => sceneStart + i)
        .filter((n) => n >= sceneStart && n <= sceneEnd),
      representative: descriptions[indices[0]],
      averageSimilarity: averageSimilarity(descriptions, indices),
    }));

  const stretchScenes = Math.max(0, allocatedScenes - verifiedDistinctMoves);

  // The declared number is checked against the verified one. This is the
  // specific defence against a beat sheet that answers "how many distinct
  // scenes?" with the number it was allocated.
  if (declaredDistinctScenes !== undefined && declaredDistinctScenes > verifiedDistinctMoves) {
    findings.push({
      beatNumber,
      code: "declared-distinctness-unsupported",
      severity: "warning",
      title: `Beat ${beatNumber} claims more distinct scenes than it describes`,
      detail:
        `"${name}" declares ${declaredDistinctScenes} distinct scene(s), but its ${descriptions.length} ` +
        `described move(s) reduce to ${verifiedDistinctMoves} materially different one(s). ` +
        repeatedGroups
          .map((g) => `Scenes ${g.sceneNumbers.join(", ")} repeat one move (similarity ${g.averageSimilarity}).`)
          .join(" "),
      suggestedFix:
        "Give the repeated scenes genuinely different moves, or reduce the beat's scene range and spend the runtime on new material.",
    });
  }

  if (descriptions.length !== allocatedScenes) {
    findings.push({
      beatNumber,
      code: "description-count-mismatch",
      severity: descriptions.length < allocatedScenes ? "warning" : "info",
      title: `Beat ${beatNumber} describes ${descriptions.length} move(s) for ${allocatedScenes} scene(s)`,
      detail:
        descriptions.length < allocatedScenes
          ? `"${name}" leaves ${allocatedScenes - descriptions.length} scene(s) with nothing stated to do.`
          : `"${name}" describes more moves than it has scenes to hold them.`,
      suggestedFix: "Every allocated scene needs its own stated move, and every stated move needs a scene.",
    });
  }

  if (stretchScenes > 0) {
    const isResolution = isFinalBeat;
    findings.push({
      beatNumber,
      code: isResolution ? "resolution-stretched" : "beat-stretched",
      severity: "warning",
      title: isResolution
        ? `The ending is stretched by about ${stretchScenes} scene(s)`
        : `Beat ${beatNumber} is stretched by about ${stretchScenes} scene(s)`,
      detail:
        `"${name}" holds ${allocatedScenes} scene(s) but only ${verifiedDistinctMoves} materially different move(s). ` +
        repeatedGroups
          .map((g) => `Scenes ${g.sceneNumbers.join(", ")} are one move reworded (similarity ${g.averageSimilarity}).`)
          .join(" "),
      suggestedFix: isResolution
        ? "Arrival, celebration and aftermath compress. Give each closing scene its own job, or end sooner and spend the time earlier."
        : "Either give each scene a distinct move, or shorten the beat and add new material elsewhere - never reword to fill.",
    });
  }

  return {
    density: {
      beatNumber,
      name,
      sceneStart,
      sceneEnd,
      allocatedScenes,
      declaredDistinctScenes,
      describedMoves: descriptions.length,
      verifiedDistinctMoves,
      repeatedGroups,
      stretchScenes,
      isFinalBeat,
      verifiable: true,
    },
    findings,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Measure how much real material a beat sheet contains.
 *
 * Never throws: a measurement failure must not be able to break a generation.
 * An old blueprint with no density fields returns `degraded: true` and no
 * stretch findings, rather than a clean bill of health it cannot vouch for.
 */
export function buildBeatDensityReport(params: {
  beats: any[];
  targetSceneCount?: number;
  threshold?: number;
}): BeatDensityReport {
  const threshold = params.threshold ?? MOVE_SIMILARITY_THRESHOLD;

  const empty: BeatDensityReport = {
    beats: [],
    findings: [],
    totalScenes: params.targetSceneCount ?? 0,
    totalVerifiedDistinctMoves: 0,
    totalStretchScenes: 0,
    degraded: true,
    unverifiableBeats: [],
    warnings: 0,
    infos: 0,
    threshold,
  };

  try {
    const beats = (Array.isArray(params.beats) ? params.beats : [])
      .filter((b) => b !== null && typeof b === "object")
      .sort((a, b) => (Number(a?.sceneStart) || 0) - (Number(b?.sceneStart) || 0));

    if (beats.length === 0) return empty;

    const lastBeatNumber = Number(beats[beats.length - 1]?.beatNumber) || 0;

    const densities: BeatDensity[] = [];
    const findings: BeatDensityFinding[] = [];

    for (const beat of beats) {
      const isFinalBeat = (Number(beat?.beatNumber) || 0) === lastBeatNumber;
      const result = analyseBeat(beat, isFinalBeat, threshold);
      densities.push(result.density);
      findings.push(...result.findings);
    }

    const verifiableBeats = densities.filter((d) => d.verifiable);
    const degraded = verifiableBeats.length === 0;

    const totalScenes =
      params.targetSceneCount ?? densities.reduce((s, d) => s + d.allocatedScenes, 0);
    const totalVerifiedDistinctMoves = densities.reduce((s, d) => s + d.verifiedDistinctMoves, 0);
    const totalStretchScenes = densities.reduce((s, d) => s + d.stretchScenes, 0);

    // A premise too small for the runtime that was requested. The answer is
    // more story - a complication, a consequence, a relationship that shifts,
    // a second pressure - never a longer beat.
    const stretchLimit = Math.max(PREMISE_STRETCH_FLOOR, Math.round(totalScenes * PREMISE_STRETCH_FRACTION));
    if (!degraded && totalStretchScenes >= stretchLimit) {
      findings.push({
        code: "premise-too-small",
        severity: "warning",
        title: `About ${totalStretchScenes} of ${totalScenes} scenes have no distinct move`,
        detail:
          `Across the beat sheet, ${totalVerifiedDistinctMoves} materially different move(s) are spread over ` +
          `${totalScenes} scene(s). The premise is smaller than the runtime it was given.`,
        suggestedFix:
          "Add STORY: a complication, a consequence that lands later, a relationship that shifts, a real obstacle, " +
          "a setup that pays off, or a second source of pressure. Do not lengthen an existing beat.",
      });
    }

    return {
      beats: densities,
      findings,
      totalScenes,
      totalVerifiedDistinctMoves,
      totalStretchScenes,
      degraded,
      unverifiableBeats: densities.filter((d) => !d.verifiable).map((d) => d.beatNumber),
      warnings: findings.filter((f) => f.severity === "warning").length,
      infos: findings.filter((f) => f.severity === "info").length,
      threshold,
    };
  } catch {
    return empty;
  }
}

/** One-line summary for the generation log. */
export function summariseBeatDensity(report: BeatDensityReport): string {
  if (report.degraded) return "not measured (blueprint carries no per-scene moves)";
  return (
    `${report.totalVerifiedDistinctMoves} distinct move(s) across ${report.totalScenes} scene(s), ` +
    `~${report.totalStretchScenes} stretched, ${report.warnings} warning(s)`
  );
}
