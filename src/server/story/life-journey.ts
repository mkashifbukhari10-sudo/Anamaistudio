import { Type } from "../ai/schema.js";
import type {
  Aspiration,
  CharacterLifeState,
  HouseholdLifeState,
  LifeJourney,
  LifeJourneyIssue,
  LifeJourneyReport,
  LifePhase,
  Milestone,
  Routine,
  SocialGraph,
  StoryScope,
  StoryTimeMarker,
  TimeJump,
  TimeJumpMagnitude,
} from "../../types.js";

/**
 * THE LIFE JOURNEY DIRECTOR
 *
 * Lets a story span TIME rather than a situation: several phases of life,
 * separated by deliberate time jumps, where who someone is at scene 60 is
 * legitimately different from who they were at scene 1.
 *
 * The governing definition:
 *
 *   LIFE STATE is what is true of a character or household for the span of one
 *   LIFE PHASE. Immutable WITHIN a phase; changes ONLY at a declared jump, by
 *   a change planned at blueprint time.
 *
 * That is what makes this safe to add to a system built on frozen facts.
 * Inside a phase, life state behaves exactly like a fact, so every existing
 * validator keeps working untouched. All the new logic lives at phase
 * boundaries, which are explicit, few, and planned rather than improvised.
 *
 * TWO INVARIANTS THIS MODULE ENFORCES STRUCTURALLY, NOT BY PROMPT WORDING:
 *
 *   1. SINGLE SOURCE OF TRUTH FOR SCENE RANGES. A phase never authors a scene
 *      range. It names CHAPTERS, and the range is derived from the beats in
 *      those chapters - the beat sheet stays the only thing that says which
 *      scenes exist where. `timeJumps` is likewise rebuilt from the phases'
 *      entry jumps rather than trusted as a parallel list.
 *
 *   2. NOTHING IS EARNED BY THE FUTURE. A milestone's proving scenes are the
 *      scenes that already showed the work; any reference to a later scene is
 *      dropped here rather than argued with in a prompt.
 *
 * DORMANT BY DEFAULT. Every function returns an empty or single-phase result
 * when no journey was planned, so a story without one behaves exactly as it
 * did before this module existed.
 *
 * Nothing here names an occupation, a setting, a family structure or an
 * outcome. It is structure only.
 */

// ---------------------------------------------------------------------------
// Scale gating
// ---------------------------------------------------------------------------

/**
 * Whether a life journey is even available at this runtime.
 *
 * A six-scene story cannot establish one life, let alone three. The gate is
 * structural rather than advisory: below the threshold the doctrine is never
 * emitted and the schema field is never requested, so the model is not offered
 * a shape it has no room to execute.
 */
export function journeyAllowedAtScale(sceneCount: number, scope: StoryScope = "Auto"): boolean {
  if (scope === "Single Episode") return false;
  if (scope === "Life Journey") return sceneCount >= 12;
  // Auto: offered only where there is genuinely room for a second life.
  return sceneCount >= 24;
}

/**
 * Phase ceiling by runtime.
 *
 * More than five phases across sixty scenes leaves about twelve scenes each -
 * too little to establish a life before jumping away from it. A ceiling, never
 * a quota: one phase is a valid answer at every length.
 */
export function maxPhasesFor(sceneCount: number): number {
  if (sceneCount < 12) return 1;
  if (sceneCount < 24) return 2;
  if (sceneCount < 48) return 3;
  return 5;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(clean).filter(Boolean);
}

function intList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n));
}

function key(name: unknown): string {
  return clean(name).toLowerCase();
}

function issue(
  kind: LifeJourneyIssue["kind"],
  title: string,
  detail: string,
  suggestedFix: string,
  severity: LifeJourneyIssue["severity"],
  extra: { phaseNumber?: number; sceneNumber?: number } = {}
): LifeJourneyIssue {
  return { kind, title, detail, suggestedFix, severity, ...extra };
}

const MAGNITUDES: TimeJumpMagnitude[] = [
  "within-day",
  "overnight",
  "days",
  "weeks",
  "months",
  "seasons",
  "years",
];

function normalizeMagnitude(raw: unknown): TimeJumpMagnitude {
  const lowered = key(raw).replace(/\s+/g, "-");
  const exact = MAGNITUDES.find((m) => m === lowered);
  if (exact) return exact;
  // Tolerant matching: models write "a few years" or "several months".
  const found = MAGNITUDES.find((m) => lowered.includes(m.replace("-", " ")) || lowered.includes(m));
  if (found) return found;
  if (/year|decade/.test(lowered)) return "years";
  if (/season|monsoon|winter|summer|harvest/.test(lowered)) return "seasons";
  if (/month/.test(lowered)) return "months";
  if (/week/.test(lowered)) return "weeks";
  if (/day/.test(lowered)) return "days";
  if (/night|morning|next day/.test(lowered)) return "overnight";
  // An unrecognised span is treated as the SMALLEST meaningful jump, because
  // over-stating a jump clears more state than it should.
  return "days";
}

/**
 * Rough ordering of common life stages, for spotting a character getting
 * YOUNGER across a jump.
 *
 * Deliberately partial. Life stages are invented per story and may be phrased
 * any number of ways, so an unrecognised stage produces no finding at all
 * rather than a guess - a false "you aged backwards" would be worse than a
 * missed one.
 */
const LIFE_STAGE_ORDER: Array<{ match: RegExp; rank: number }> = [
  { match: /\b(infant|baby|toddler)\b/i, rank: 0 },
  { match: /\b(small child|young child|little)\b/i, rank: 1 },
  { match: /\b(child|schoolchild|school-age)\b/i, rank: 2 },
  { match: /\b(teen|teenager|adolescent|youth)\b/i, rank: 3 },
  { match: /\b(young adult|student)\b/i, rank: 4 },
  { match: /\b(adult|grown|parent|working age)\b/i, rank: 5 },
  { match: /\b(middle-aged|middle aged)\b/i, rank: 6 },
  { match: /\b(elder|elderly|old|grandparent|aged)\b/i, rank: 7 },
];

export function lifeStageRank(stage: unknown): number {
  const text = clean(stage);
  if (!text) return -1;
  let best = -1;
  for (const entry of LIFE_STAGE_ORDER) {
    if (entry.match.test(text)) best = Math.max(best, entry.rank);
  }
  return best;
}

// ---------------------------------------------------------------------------
// Chapter -> scene range derivation
//
// The beat sheet is the ONLY thing that says which scenes exist where. A phase
// names chapters; the range is computed. This is what keeps phases from
// becoming a competing source of truth alongside beats and chapters.
// ---------------------------------------------------------------------------

export interface ChapterRange {
  chapterNumber: number;
  sceneStart: number;
  sceneEnd: number;
}

function parseSceneRange(raw: unknown): { start: number; end: number } | null {
  const text = clean(raw);
  const match = text.match(/(\d+)\s*[-–—to]+\s*(\d+)/);
  if (match) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return { start, end };
  }
  const single = text.match(/^\s*(\d+)\s*$/);
  if (single) {
    const n = Number(single[1]);
    if (Number.isFinite(n)) return { start: n, end: n };
  }
  return null;
}

/**
 * Scene span of every chapter, taken from the beats it contains.
 *
 * Falls back to the chapter's own 'sceneRange' string only where no beat
 * claims that chapter, because a beat range is authoritative and a chapter
 * range is a human-readable label that has been observed to disagree with it.
 */
export function deriveChapterRanges(beats: any[], chapters: any[]): ChapterRange[] {
  const spans = new Map<number, { start: number; end: number }>();

  for (const beat of Array.isArray(beats) ? beats : []) {
    const chapterNumber = Number(beat?.chapterNumber);
    const start = Number(beat?.sceneStart);
    const end = Number(beat?.sceneEnd);
    if (!Number.isFinite(chapterNumber) || !Number.isFinite(start) || !Number.isFinite(end)) continue;

    const existing = spans.get(chapterNumber);
    spans.set(chapterNumber, {
      start: existing ? Math.min(existing.start, start) : start,
      end: existing ? Math.max(existing.end, end) : end,
    });
  }

  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    const chapterNumber = Number(chapter?.chapterNumber);
    if (!Number.isFinite(chapterNumber) || spans.has(chapterNumber)) continue;
    const parsed = parseSceneRange(chapter?.sceneRange);
    if (parsed) spans.set(chapterNumber, parsed);
  }

  return [...spans.entries()]
    .map(([chapterNumber, span]) => ({ chapterNumber, sceneStart: span.start, sceneEnd: span.end }))
    .sort((a, b) => a.sceneStart - b.sceneStart);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export interface NormalizedJourney {
  /** undefined when no usable journey was planned - the normal case. */
  journey?: LifeJourney;
  issues: LifeJourneyIssue[];
}

function normalizeTimeJump(raw: any, fallbackAfterScene: number): TimeJump {
  return {
    afterScene: fallbackAfterScene,
    span: clean(raw?.span) || "later",
    magnitude: normalizeMagnitude(raw?.magnitude ?? raw?.span),
    screenTreatment: clean(raw?.screenTreatment),
    whatChanged: cleanList(raw?.whatChanged),
  };
}

function normalizeCharacterLifeState(raw: any): CharacterLifeState | null {
  const characterId = clean(raw?.characterId);
  const lifeStage = clean(raw?.lifeStage);
  if (!characterId || !lifeStage) return null;

  return {
    characterId,
    lifeStage,
    occupation: clean(raw?.occupation) || undefined,
    education: clean(raw?.education) || undefined,
    skills: cleanList(raw?.skills).length > 0 ? cleanList(raw?.skills) : undefined,
    responsibilities:
      cleanList(raw?.responsibilities).length > 0 ? cleanList(raw?.responsibilities) : undefined,
    physicalMaturity: clean(raw?.physicalMaturity) || undefined,
  };
}

function normalizeHouseholdLifeState(raw: any): HouseholdLifeState | null {
  const householdId = clean(raw?.householdId);
  if (!householdId) return null;

  return {
    householdId,
    livelihood: clean(raw?.livelihood) || undefined,
    circumstances: clean(raw?.circumstances) || undefined,
    dwellingPlaceId: clean(raw?.dwellingPlaceId) || undefined,
    possessions: cleanList(raw?.possessions).length > 0 ? cleanList(raw?.possessions) : undefined,
    pressures: cleanList(raw?.pressures).length > 0 ? cleanList(raw?.pressures) : undefined,
  };
}

/**
 * Fold the model's raw life-journey output into a validated LifeJourney.
 *
 * Returns `undefined` for anything unusable rather than a partial structure:
 * a story falling back to single-phase is a normal, correct outcome, while a
 * half-built journey would corrupt every phase-aware check downstream.
 *
 * Report-only in spirit, but structurally corrective where the correction is
 * mechanical and unambiguous - deriving ranges, renumbering phases, aligning
 * jumps, dropping forward references. Anything requiring judgement is
 * reported and left alone.
 */
export function buildLifeJourney(params: {
  raw: any;
  beats: any[];
  chapters: any[];
  targetSceneCount: number;
  scope?: StoryScope;
}): NormalizedJourney {
  const { raw, beats, chapters, targetSceneCount, scope = "Auto" } = params;
  const issues: LifeJourneyIssue[] = [];

  if (!raw || typeof raw !== "object") return { issues };

  const rawPhases: any[] = Array.isArray(raw.phases) ? raw.phases : [];
  if (rawPhases.length === 0) return { issues };

  if (!journeyAllowedAtScale(targetSceneCount, scope)) {
    issues.push(
      issue(
        "scope",
        "Life journey planned at a runtime too short to carry it",
        `${targetSceneCount} scenes cannot establish more than one phase of life.`,
        "The journey was discarded and the story runs as a single continuous episode.",
        "info"
      )
    );
    return { issues };
  }

  // A single planned phase is not a journey. Treat it as the ordinary case
  // rather than carrying a degenerate structure through the whole pipeline.
  if (rawPhases.length === 1) {
    issues.push(
      issue(
        "phase",
        "Only one life phase was planned",
        "A single phase is an ordinary continuous story, not a journey.",
        "The journey layer stays dormant for this story.",
        "info"
      )
    );
    return { issues };
  }

  const chapterRanges = deriveChapterRanges(beats, chapters);
  const rangeByChapter = new Map(chapterRanges.map((c) => [c.chapterNumber, c]));

  // --- Phases -------------------------------------------------------------
  const claimedChapters = new Set<number>();
  const phases: LifePhase[] = [];

  const ordered = [...rawPhases].sort(
    (a, b) => (Number(a?.phaseNumber) || 0) - (Number(b?.phaseNumber) || 0)
  );

  ordered.forEach((rawPhase, index) => {
    const phaseNumber = index + 1;
    const title = clean(rawPhase?.title) || `Phase ${phaseNumber}`;
    const chapterNumbers = intList(rawPhase?.chapterNumbers).filter((n) => {
      if (claimedChapters.has(n)) {
        issues.push(
          issue(
            "phase",
            `Chapter ${n} claimed by more than one phase`,
            `Chapter ${n} appears in phase ${phaseNumber} and in an earlier phase.`,
            "A chapter belongs to exactly one phase; the later claim was dropped.",
            "warning",
            { phaseNumber }
          )
        );
        return false;
      }
      claimedChapters.add(n);
      return true;
    });

    if (chapterNumbers.length === 0) {
      issues.push(
        issue(
          "phase",
          `Phase ${phaseNumber} names no chapters`,
          `"${title}" cannot be given a scene range because it groups no chapters.`,
          "Every phase must be a contiguous run of chapters.",
          "warning",
          { phaseNumber }
        )
      );
      return;
    }

    const spans = chapterNumbers.map((n) => rangeByChapter.get(n)).filter(Boolean) as ChapterRange[];
    if (spans.length === 0) {
      issues.push(
        issue(
          "phase",
          `Phase ${phaseNumber} names chapters that have no scenes`,
          `Chapters ${chapterNumbers.join(", ")} are not covered by any beat.`,
          "Phase scene ranges are derived from beats; these chapters carry none.",
          "warning",
          { phaseNumber }
        )
      );
      return;
    }

    phases.push({
      phaseNumber,
      title,
      chapterNumbers,
      sceneStart: Math.min(...spans.map((s) => s.sceneStart)),
      sceneEnd: Math.max(...spans.map((s) => s.sceneEnd)),
      entryJump: undefined,
      characterStates: (Array.isArray(rawPhase?.characterStates) ? rawPhase.characterStates : [])
        .map(normalizeCharacterLifeState)
        .filter(Boolean) as CharacterLifeState[],
      householdStates: (Array.isArray(rawPhase?.householdStates) ? rawPhase.householdStates : [])
        .map(normalizeHouseholdLifeState)
        .filter(Boolean) as HouseholdLifeState[],
      activePlaceIds: cleanList(rawPhase?.activePlaceIds),
      worldConditions: cleanList(rawPhase?.worldConditions).length > 0
        ? cleanList(rawPhase?.worldConditions)
        : undefined,
    });
  });

  if (phases.length < 2) {
    issues.push(
      issue(
        "phase",
        "Fewer than two usable phases survived validation",
        `${rawPhases.length} phase(s) were planned; ${phases.length} could be given a scene range.`,
        "The journey layer stays dormant and the story runs as a single episode.",
        "warning"
      )
    );
    return { issues };
  }

  phases.sort((a, b) => a.sceneStart - b.sceneStart);
  phases.forEach((p, i) => {
    p.phaseNumber = i + 1;
  });

  const ceiling = maxPhasesFor(targetSceneCount);
  if (phases.length > ceiling) {
    issues.push(
      issue(
        "phase",
        `More phases than this runtime can carry (${phases.length} > ${ceiling})`,
        `${targetSceneCount} scenes across ${phases.length} phases leaves too little room to establish each life.`,
        "Reported only - the phases were kept. Consider fewer, longer phases.",
        "warning"
      )
    );
  }

  // --- Coverage -----------------------------------------------------------
  if (phases[0].sceneStart !== 1) {
    issues.push(
      issue(
        "phase",
        "Phases do not begin at scene 1",
        `The first phase starts at scene ${phases[0].sceneStart}.`,
        "Scenes before the first phase have no life state; the range was extended to cover them.",
        "warning",
        { phaseNumber: 1 }
      )
    );
    phases[0].sceneStart = 1;
  }

  const lastPhase = phases[phases.length - 1];
  if (lastPhase.sceneEnd !== targetSceneCount) {
    issues.push(
      issue(
        "phase",
        "Phases do not reach the final scene",
        `The last phase ends at scene ${lastPhase.sceneEnd} of ${targetSceneCount}.`,
        "The final phase was extended so every scene belongs to one.",
        "warning",
        { phaseNumber: lastPhase.phaseNumber }
      )
    );
    lastPhase.sceneEnd = targetSceneCount;
  }

  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const curr = phases[i];
    if (curr.sceneStart !== prev.sceneEnd + 1) {
      issues.push(
        issue(
          "phase",
          `Gap or overlap between phase ${prev.phaseNumber} and ${curr.phaseNumber}`,
          `Phase ${prev.phaseNumber} ends at scene ${prev.sceneEnd}; phase ${curr.phaseNumber} starts at ${curr.sceneStart}.`,
          "Phases were made contiguous so every scene belongs to exactly one.",
          "warning",
          { phaseNumber: curr.phaseNumber }
        )
      );
      curr.sceneStart = prev.sceneEnd + 1;
      if (curr.sceneEnd < curr.sceneStart) curr.sceneEnd = curr.sceneStart;
    }
  }

  // --- Time jumps ---------------------------------------------------------
  //
  // Rebuilt from the phase boundaries rather than trusted as a parallel list.
  // Two lists of jumps would be two sources of truth, and the boundary is the
  // thing that actually exists - a jump is the seam between two phases.
  const rawJumps: any[] = Array.isArray(raw.timeJumps) ? raw.timeJumps : [];
  const timeJumps: TimeJump[] = [];

  for (let i = 1; i < phases.length; i++) {
    const phase = phases[i];
    const boundary = phase.sceneStart - 1;

    // Prefer the phase's own entry jump, then any listed jump near the seam.
    const declared =
      phase && (phase as any).entryJumpRaw
        ? (phase as any).entryJumpRaw
        : (ordered[i] as any)?.entryJump ??
          rawJumps.find((j) => Math.abs(Number(j?.afterScene) - boundary) <= 2);

    const jump = normalizeTimeJump(declared, boundary);

    if (!jump.screenTreatment) {
      issues.push(
        issue(
          "time-jump",
          `Time jump into phase ${phase.phaseNumber} is not shown on screen`,
          `The jump after scene ${boundary} has no screen treatment.`,
          "A jump the audience cannot see is a continuity break with a label on it.",
          "warning",
          { phaseNumber: phase.phaseNumber, sceneNumber: boundary }
        )
      );
    }

    if (jump.whatChanged.length === 0) {
      issues.push(
        issue(
          "time-jump",
          `Time jump into phase ${phase.phaseNumber} states no changes`,
          `The jump after scene ${boundary} does not say what is different afterwards.`,
          "A jump that changes nothing is a cut, not a jump.",
          "info",
          { phaseNumber: phase.phaseNumber, sceneNumber: boundary }
        )
      );
    }

    phase.entryJump = jump;
    timeJumps.push(jump);
  }

  phases[0].entryJump = undefined;

  // --- Life-stage monotonicity -------------------------------------------
  const lastStage = new Map<string, { stage: string; phaseNumber: number }>();
  for (const phase of phases) {
    for (const state of phase.characterStates) {
      const id = key(state.characterId);
      const previous = lastStage.get(id);
      if (previous) {
        const before = lifeStageRank(previous.stage);
        const after = lifeStageRank(state.lifeStage);
        // Only when BOTH stages are recognised. An unknown phrasing produces
        // no finding at all rather than a guess.
        if (before >= 0 && after >= 0 && after < before) {
          issues.push(
            issue(
              "life-state",
              `${state.characterId} gets younger across a time jump`,
              `Phase ${previous.phaseNumber}: "${previous.stage}". Phase ${phase.phaseNumber}: "${state.lifeStage}".`,
              "Life stage may advance across a jump, never regress.",
              "warning",
              { phaseNumber: phase.phaseNumber }
            )
          );
        }
      }
      lastStage.set(id, { stage: state.lifeStage, phaseNumber: phase.phaseNumber });
    }
  }

  // --- Aspirations --------------------------------------------------------
  const aspirations: Aspiration[] = (Array.isArray(raw.aspirations) ? raw.aspirations : [])
    .map((a: any): Aspiration | null => {
      const characterId = clean(a?.characterId);
      const goal = clean(a?.goal);
      if (!characterId || !goal) return null;

      let resolvesAtPhase = Number(a?.resolvesAtPhase);
      if (!Number.isFinite(resolvesAtPhase) || resolvesAtPhase < 1 || resolvesAtPhase > phases.length) {
        issues.push(
          issue(
            "aspiration",
            `Aspiration for ${characterId} resolves outside the story`,
            `"${goal}" resolves at phase ${a?.resolvesAtPhase}, but the story has ${phases.length}.`,
            "Clamped to the final phase.",
            "info"
          )
        );
        resolvesAtPhase = phases.length;
      }

      const outcomeRaw = key(a?.outcome);
      const outcome = (["achieved", "redirected", "relinquished", "denied"] as const).find(
        (o) => outcomeRaw === o
      );

      return {
        characterId,
        goal,
        whyItMatters: clean(a?.whyItMatters),
        costToOthers: clean(a?.costToOthers),
        obstacles: cleanList(a?.obstacles),
        resolvesAtPhase: Math.round(resolvesAtPhase),
        outcome: outcome ?? "achieved",
      };
    })
    .filter(Boolean) as Aspiration[];

  // --- Milestones ---------------------------------------------------------
  //
  // Nothing is earned by the future. Proving scenes after the milestone are
  // dropped here rather than argued with in a prompt.
  const milestones: Milestone[] = (Array.isArray(raw.milestones) ? raw.milestones : [])
    .map((m: any): Milestone | null => {
      const atScene = Number(m?.atScene);
      const description = clean(m?.description);
      if (!Number.isFinite(atScene) || atScene < 1 || atScene > targetSceneCount || !description) {
        return null;
      }

      const phase = phases.find((p) => atScene >= p.sceneStart && atScene <= p.sceneEnd);
      const proving = intList(m?.provingSceneNumbers).filter((n) => n < atScene && n >= 1);
      const dropped = intList(m?.provingSceneNumbers).length - proving.length;

      if (dropped > 0) {
        issues.push(
          issue(
            "milestone",
            `Milestone at scene ${atScene} cites ${dropped} scene(s) that come after it`,
            `A milestone can only be earned by scenes that already happened.`,
            "Forward references were dropped.",
            "info",
            { sceneNumber: atScene }
          )
        );
      }

      return {
        phaseNumber: phase?.phaseNumber ?? 1,
        atScene: Math.round(atScene),
        kind: clean(m?.kind) || "milestone",
        description,
        provingSceneNumbers: [...new Set(proving)].sort((a, b) => a - b),
        cost: clean(m?.cost),
      };
    })
    .filter(Boolean) as Milestone[];

  // --- Routines -----------------------------------------------------------
  const routines: Routine[] = (Array.isArray(raw.routines) ? raw.routines : [])
    .map((r: any, index: number): Routine | null => {
      const activity = clean(r?.activity);
      if (!activity) return null;

      const variation = clean(r?.variationAcrossStory);
      if (!variation) {
        issues.push(
          issue(
            "routine",
            `Routine "${activity}" declares no variation`,
            "A routine repeated without variation is filler with a chore in front of it.",
            "Say how it differs each time it is shown, or drop it.",
            "warning"
          )
        );
      }

      return {
        id: clean(r?.id) || `routine_${index + 1}`,
        activity,
        characterIds: cleanList(r?.characterIds),
        placeId: clean(r?.placeId),
        householdId: clean(r?.householdId) || undefined,
        phaseNumbers: intList(r?.phaseNumbers).filter((n) => n >= 1 && n <= phases.length),
        variationAcrossStory: variation,
      };
    })
    .filter(Boolean) as Routine[];

  const journey: LifeJourney = {
    whyThisShape: clean(raw.whyThisShape),
    phases,
    timeJumps,
    aspirations,
    milestones,
    routines,
    openingLife: clean(raw.openingLife),
    closingLife: clean(raw.closingLife),
  };

  if (!journey.openingLife || !journey.closingLife) {
    issues.push(
      issue(
        "scope",
        "The journey does not state both ends of the life it covers",
        "openingLife and closingLife are what make the final state feel earned rather than arrived at.",
        "Reported only.",
        "info"
      )
    );
  }

  return { journey, issues };
}

// ---------------------------------------------------------------------------
// Reading life state - the SINGLE accessor
//
// Every consumer reads life state through here. That is what prevents phase
// data and socialGraph becoming two competing truths: phase 1's life state IS
// characterSocial, projected, and later phases are overrides on top of it.
// ---------------------------------------------------------------------------

export function phaseForScene(
  journey: LifeJourney | null | undefined,
  sceneNumber: number
): LifePhase | null {
  if (!journey || journey.phases.length === 0) return null;
  return (
    journey.phases.find((p) => sceneNumber >= p.sceneStart && sceneNumber <= p.sceneEnd) ?? null
  );
}

/** The jump that happens immediately before this scene, if any. */
export function timeJumpBeforeScene(
  journey: LifeJourney | null | undefined,
  sceneNumber: number
): TimeJump | null {
  if (!journey) return null;
  return journey.timeJumps.find((j) => j.afterScene === sceneNumber - 1) ?? null;
}

/** True when a jump sits between these two consecutive scenes. */
export function jumpsBetween(
  journey: LifeJourney | null | undefined,
  previousSceneNumber: number,
  sceneNumber: number
): TimeJump | null {
  if (!journey || sceneNumber !== previousSceneNumber + 1) return null;
  return timeJumpBeforeScene(journey, sceneNumber);
}

/**
 * A character's life state at a given phase.
 *
 * Phase 1 is PROJECTED from the social graph rather than duplicated, so a
 * single-phase story and the opening of a journey read from exactly the same
 * place. Later phases fall back to the nearest earlier phase that recorded
 * the character, because a phase only needs to state what CHANGED.
 */
export function lifeStateAt(params: {
  journey?: LifeJourney | null;
  socialGraph?: SocialGraph | null;
  characterId: string;
  phaseNumber: number;
}): CharacterLifeState | null {
  const { journey, socialGraph, characterId, phaseNumber } = params;
  const id = key(characterId);
  if (!id) return null;

  const fromGraph = (): CharacterLifeState | null => {
    const social = (socialGraph?.characterSocial ?? []).find((c) => key(c.characterId) === id);
    if (!social) return null;
    return {
      characterId: social.characterId,
      lifeStage: social.lifeStage || "",
      responsibilities: social.responsibilities,
    };
  };

  if (!journey || journey.phases.length === 0) return fromGraph();

  // Walk backwards from the requested phase to the most recent statement.
  for (let n = phaseNumber; n >= 1; n--) {
    const phase = journey.phases.find((p) => p.phaseNumber === n);
    const found = phase?.characterStates.find((c) => key(c.characterId) === id);
    if (found) return found;
  }

  return fromGraph();
}

/** A household's life state at a given phase. Same fallback rules. */
export function householdLifeStateAt(params: {
  journey?: LifeJourney | null;
  householdId: string;
  phaseNumber: number;
}): HouseholdLifeState | null {
  const { journey, householdId, phaseNumber } = params;
  const id = key(householdId);
  if (!journey || !id) return null;

  for (let n = phaseNumber; n >= 1; n--) {
    const phase = journey.phases.find((p) => p.phaseNumber === n);
    const found = phase?.householdStates.find((h) => key(h.householdId) === id);
    if (found) return found;
  }
  return null;
}

/**
 * Story-time marker for a scene.
 *
 * Absent a journey this is always phase 1 / day 0, which is exactly what makes
 * every phase-aware check degrade to the behaviour that existed before this
 * module: same phase, same day, so nothing is treated as a jump.
 */
export function storyTimeForScene(
  journey: LifeJourney | null | undefined,
  sceneNumber: number
): StoryTimeMarker {
  const phase = phaseForScene(journey, sceneNumber);
  return { phaseNumber: phase?.phaseNumber ?? 1, dayIndex: 0 };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

/**
 * Report only. Nothing here corrects a story - it measures one.
 *
 * A story with no journey still gets a report, showing one phase and no jumps,
 * so the shape of the output does not depend on which kind of story ran.
 */
export function buildLifeJourneyReport(
  journey: LifeJourney | null | undefined,
  normalisationIssues: LifeJourneyIssue[],
  targetSceneCount: number
): LifeJourneyReport {
  const issues = [...normalisationIssues];

  if (!journey) {
    return {
      phaseCount: 1,
      scenesPerPhase: [{ phaseNumber: 1, title: "Single episode", scenes: targetSceneCount }],
      timeJumpCount: 0,
      milestoneCount: 0,
      unearnedMilestones: [],
      aspirationsResolved: 0,
      aspirationsUnresolved: 0,
      routineCount: 0,
      issues,
      warnings: issues.filter((i) => i.severity === "warning").length,
      infos: issues.filter((i) => i.severity === "info").length,
    };
  }

  // A milestone is UNEARNED when too little already showed the work, or when
  // everything that did sits inside the same phase - which is how "instant
  // success" looks structurally.
  const unearnedMilestones: number[] = [];
  for (const milestone of journey.milestones) {
    const proving = milestone.provingSceneNumbers;
    const provingPhases = new Set(
      proving.map((n) => phaseForScene(journey, n)?.phaseNumber).filter(Boolean)
    );

    const tooFew = proving.length < 2;
    const allSamePhase =
      journey.phases.length > 1 &&
      provingPhases.size <= 1 &&
      !provingPhases.has(milestone.phaseNumber - 1);

    if (tooFew || allSamePhase) {
      unearnedMilestones.push(milestone.atScene);
      issues.push(
        issue(
          "milestone",
          `Milestone at scene ${milestone.atScene} is not earned`,
          tooFew
            ? `"${milestone.description}" is supported by ${proving.length} earlier scene(s).`
            : `"${milestone.description}" is supported only by scenes inside its own phase.`,
          "Show the work across more than one phase, or make the achievement smaller.",
          "info",
          { phaseNumber: milestone.phaseNumber, sceneNumber: milestone.atScene }
        )
      );
    }
  }

  const resolved = journey.aspirations.filter(
    (a) => a.resolvesAtPhase >= 1 && a.resolvesAtPhase <= journey.phases.length
  ).length;

  return {
    phaseCount: journey.phases.length,
    scenesPerPhase: journey.phases.map((p) => ({
      phaseNumber: p.phaseNumber,
      title: p.title,
      scenes: p.sceneEnd - p.sceneStart + 1,
    })),
    timeJumpCount: journey.timeJumps.length,
    milestoneCount: journey.milestones.length,
    unearnedMilestones,
    aspirationsResolved: resolved,
    aspirationsUnresolved: journey.aspirations.length - resolved,
    routineCount: journey.routines.length,
    issues,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };
}

/** One-line summary for the generation log. */
export function summariseLifeJourney(journey: LifeJourney | null | undefined): string {
  if (!journey) return "single episode (no time jumps)";
  return (
    `${journey.phases.length} phases, ${journey.timeJumps.length} time jump(s), ` +
    `${journey.milestones.length} milestone(s), ${journey.aspirations.length} aspiration(s)`
  );
}

// ---------------------------------------------------------------------------
// Blueprint schema fragment
//
// Spread into BLUEPRINT_SCHEMA as an OPTIONAL property. Never in the required
// list: its absence is the normal case and must stay cost-free.
// ---------------------------------------------------------------------------

export const LIFE_JOURNEY_SCHEMA = {
  type: Type.OBJECT,
  description:
    "OPTIONAL. Include ONLY if this topic genuinely wants a story that spans TIME - several phases of life separated by deliberate jumps - rather than one continuous situation. Most stories do NOT. Omit this entirely for a story that happens over hours or a day, and for any story whose power comes from continuous pressure rather than elapsed time.",
  properties: {
    whyThisShape: {
      type: Type.STRING,
      description:
        "Why THIS topic needs elapsed time. If you cannot say what the time jumps give the story that a continuous version would lack, do not plan a journey at all.",
    },
    openingLife: {
      type: Type.STRING,
      description:
        "The life this story opens on, in one sentence: who these people are, how they live, what an ordinary day holds.",
    },
    closingLife: {
      type: Type.STRING,
      description:
        "The life it closes on, in one sentence. It must be MEANINGFULLY different from openingLife - and different is not the same as better. A quieter, smaller or sadder life can be the stronger ending.",
    },
    phases: {
      type: Type.ARRAY,
      description:
        "Spans of the story across which life stays constant. Each phase is a contiguous run of CHAPTERS - name the chapters, never the scenes; the scene range is derived from them. Plan the FEWEST phases the story needs.",
      items: {
        type: Type.OBJECT,
        properties: {
          phaseNumber: { type: Type.INTEGER },
          title: { type: Type.STRING, description: "Named for THIS story, never a generic label" },
          chapterNumbers: {
            type: Type.ARRAY,
            description: "Chapter numbers in this phase. Contiguous, and no chapter in two phases.",
            items: { type: Type.INTEGER },
          },
          entryJump: {
            type: Type.OBJECT,
            description:
              "The time jump that OPENS this phase. Omit for phase 1, which opens the film.",
            properties: {
              span: {
                type: Type.STRING,
                description:
                  "How much time passed, worded for this story: 'that evening', 'the next monsoon', 'four winters later'.",
              },
              magnitude: {
                type: Type.STRING,
                description:
                  "One of: within-day, overnight, days, weeks, months, seasons, years. Used to decide what may legitimately have changed.",
              },
              screenTreatment: {
                type: Type.STRING,
                description:
                  "How the audience SEES that time passed. Required. A jump they cannot see is a continuity break with a label on it. Possibilities, not a menu: a season changed in the same frame; an object visibly aged; a routine returning visibly different; a growth reveal; a match-cut across the gap.",
              },
              whatChanged: {
                type: Type.ARRAY,
                description: "One line per thing the audience must understand is now different.",
                items: { type: Type.STRING },
              },
            },
            required: ["span", "magnitude", "screenTreatment", "whatChanged"],
          },
          characterStates: {
            type: Type.ARRAY,
            description:
              "What is true of each character THIS phase. State only what CHANGED from the previous phase, plus life stage. Life stage may advance across a jump and may NEVER regress.",
            items: {
              type: Type.OBJECT,
              properties: {
                characterId: { type: Type.STRING, description: "Character name" },
                lifeStage: {
                  type: Type.STRING,
                  description:
                    "Where they are in life this phase. Informs capability and what they are trusted with - never temperament.",
                },
                occupation: {
                  type: Type.STRING,
                  description: "Only if the story establishes one. Omit rather than invent.",
                },
                education: { type: Type.STRING, description: "Only if the story establishes it" },
                skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                responsibilities: {
                  type: Type.ARRAY,
                  description:
                    "What they are counted on for this phase. Responsibilities growing across phases is one of the clearest ways to show growth without a single line about it.",
                  items: { type: Type.STRING },
                },
                physicalMaturity: {
                  type: Type.STRING,
                  description:
                    "SCALE and BEARING only - height, build, posture, wear. NEVER identity: not the vegetable type, not the face, not the eye colour, not the palette. Those are locked for the whole film.",
                },
              },
              required: ["characterId", "lifeStage"],
            },
          },
          householdStates: {
            type: Type.ARRAY,
            description:
              "What is true of each household this phase, if the story has households. How they earn, what presses on them, what they own.",
            items: {
              type: Type.OBJECT,
              properties: {
                householdId: { type: Type.STRING, description: "The 'household_' id" },
                livelihood: {
                  type: Type.STRING,
                  description:
                    "How this household earns, invented for THIS story. Households earn in many ways - cultivating, keeping animals, making by hand, repairing, selling from a shop or a cart, carrying, cooking, teaching, caring, performing, clerical work, daily-wage work, a small business, or a combination. Some households are not defined by their work at all. Never default to farming and never default to poverty.",
                },
                circumstances: {
                  type: Type.STRING,
                  description:
                    "Qualitative and story-relevant only. Never a number and never a currency.",
                },
                dwellingPlaceId: { type: Type.STRING, description: "The 'place_' id they live in" },
                possessions: {
                  type: Type.ARRAY,
                  description: "Things they own that matter to the story. These survive time jumps.",
                  items: { type: Type.STRING },
                },
                pressures: {
                  type: Type.ARRAY,
                  description:
                    "What presses on them this phase. This is the engine of ordinary drama - a pressure that produces no change is a phase where nothing happened.",
                  items: { type: Type.STRING },
                },
              },
              required: ["householdId"],
            },
          },
          activePlaceIds: {
            type: Type.ARRAY,
            description:
              "The 'place_' ids genuinely used this phase. A place may enter the story and leave it; listing only what is in use keeps later prompts from carrying locations the story has finished with.",
            items: { type: Type.STRING },
          },
          worldConditions: {
            type: Type.ARRAY,
            description:
              "Conditions outside any household this phase - a season, a drought, a road being built, a market closing. Most stories leave this empty.",
            items: { type: Type.STRING },
          },
        },
        required: ["phaseNumber", "title", "chapterNumbers", "characterStates", "activePlaceIds"],
      },
    },
    aspirations: {
      type: Type.ARRAY,
      description:
        "Long-horizon goals. These are NOT 'want' - a want is filmable and immediate, an aspiration is the thing a want serves across years. One per journey character at most, and a story may have none.",
      items: {
        type: Type.OBJECT,
        properties: {
          characterId: { type: Type.STRING },
          goal: { type: Type.STRING },
          whyItMatters: { type: Type.STRING },
          costToOthers: {
            type: Type.STRING,
            description: "What pursuing it costs the people around them. A goal that costs nobody anything carries no weight.",
          },
          obstacles: { type: Type.ARRAY, items: { type: Type.STRING } },
          resolvesAtPhase: { type: Type.INTEGER },
          outcome: {
            type: Type.STRING,
            description:
              "One of: achieved, redirected, relinquished, denied. All four are legitimate endings. Do NOT assume achievement - a goal set down deliberately, or exchanged for a different one, is frequently the stronger story.",
          },
        },
        required: ["characterId", "goal", "whyItMatters", "costToOthers", "resolvesAtPhase", "outcome"],
      },
    },
    milestones: {
      type: Type.ARRAY,
      description:
        "Concrete, visible steps on the way. This is what stops achievements arriving unearned.",
      items: {
        type: Type.OBJECT,
        properties: {
          atScene: { type: Type.INTEGER, description: "Scene where the milestone is reached" },
          kind: { type: Type.STRING, description: "Named for this story: 'first sale', 'taught to read', 'the loan repaid'" },
          description: { type: Type.STRING },
          provingSceneNumbers: {
            type: Type.ARRAY,
            description:
              "EARLIER scene numbers that already SHOWED the work making this credible. Every number must be smaller than atScene - nothing is earned by the future. A milestone supported by fewer than two earlier scenes, or only by scenes inside its own phase, reads as instant success.",
            items: { type: Type.INTEGER },
          },
          cost: { type: Type.STRING, description: "What reaching it cost. A milestone that costs nothing plays flat." },
        },
        required: ["atScene", "kind", "description", "provingSceneNumbers", "cost"],
      },
    },
    routines: {
      type: Type.ARRAY,
      description:
        "Repeated activities of ordinary life. Recorded so they can be VARIED - the same routine shown identically three times is filler with a chore in front of it.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          activity: { type: Type.STRING },
          characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          placeId: { type: Type.STRING },
          householdId: { type: Type.STRING },
          phaseNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          variationAcrossStory: {
            type: Type.STRING,
            description:
              "REQUIRED. How it differs each time it appears. The first showing establishes, the second must differ, the third must break or carry a different charge. A routine that cannot say how it varies should not be registered.",
          },
        },
        required: ["id", "activity", "placeId", "phaseNumbers", "variationAcrossStory"],
      },
    },
  },
  required: ["whyThisShape", "openingLife", "closingLife", "phases"],
};
