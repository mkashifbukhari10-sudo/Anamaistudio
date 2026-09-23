import { textSimilarity, tokenize, normalise, isUsableRepetitionIntent } from "./scene-distinctiveness.js";

export { isUsableRepetitionIntent };
import {
  NARRATIVE_CHANGE_KINDS,
  PERFORMANCE_TYPES,
  REPETITION_INTENT_KINDS,
  SCENE_OUTCOMES,
  type ContractIssue,
  type SceneContractReport,
} from "../../types.js";

/**
 * SCENE CONTRACT VALIDATION
 *
 * A scene's contract is a CLAIM about what the scene does. This checks the
 * claim rather than believing it.
 *
 * The governing problem: a model told "state the change this scene produces"
 * will always state something. `storyFunction` was already that field, and it
 * passed a `length >= 12` check while twelve scenes said the same thing. Typed
 * fields only help if something verifies them, so:
 *
 *   - before === after is caught exactly,
 *   - before ≈ after is caught by similarity,
 *   - a generic non-answer is caught lexically,
 *   - and ACTIVITY presented as progression is caught by comparing the claimed
 *     value change against what the scene physically shows.
 *
 * That last one is the interesting case. "Golu enters the room -> Golu talks
 * to Mooli" passes an equality check and a similarity check: the two strings
 * really are different. But they describe two ACTIONS, not one value at two
 * states, and the scene has changed nothing. Two independent signals catch it.
 *
 * REPORT ONLY. Nothing here mutates a scene, rewrites a contract or rejects a
 * story. Every entry point is pure and returns findings.
 *
 * Reuses the P0 similarity utilities deliberately - a second notion of "these
 * two things are the same" would drift from the first and produce
 * contradictory findings about one story.
 */

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Above this, `before` and `after` are the same state reworded.
 *
 * CALIBRATED - see `tests/calibrate-contract.ts` and the record in
 * plan-story-quality.md §27. Deliberately not inherited from the P0 or P1
 * thresholds: these are very short value-state phrases ("guarded" vs "slightly
 * restored"), a different distribution again from scene signatures or beat
 * descriptions.
 */
export const BEFORE_AFTER_THRESHOLD = 0.62;

/**
 * Above this, a claimed value change is really a restatement of the scene's
 * physical action - activity wearing the costume of progression.
 */
export const ACTIVITY_THRESHOLD = 0.5;

/** Shorter than this and a value state carries no information. */
const MIN_STATE_LENGTH = 3;

/**
 * Non-answers that satisfy a length check while saying nothing.
 *
 * Matched as WHOLE normalised values, never as substrings, so "the same crate
 * as before" is untouched while a bare "same" is caught.
 */
const GENERIC_STATES = new Set([
  "same", "unchanged", "normal", "none", "nothing", "n a", "na", "null",
  "neutral", "stable", "fine", "okay", "ok", "good", "bad", "as before",
  "no change", "the same", "status quo", "unaffected", "steady",
]);

/**
 * Verb stems that describe DOING rather than BEING.
 *
 * Stems, because `tokenize` stems: "enters" and "entering" both reduce to
 * "enter". Used only as one half of a two-signal test - a value state may
 * legitimately mention an action ("hope that the cart will arrive"), so this
 * alone never raises a finding.
 */
const ACTIVITY_VERB_STEMS = new Set([
  "enter", "exit", "leav", "arriv", "walk", "run", "jog", "sit", "stand",
  "pick", "put", "open", "close", "take", "give", "hold", "look", "talk",
  "say", "tell", "ask", "go", "come", "move", "turn", "lift", "drop",
  "carri", "carry", "push", "pull", "reach", "point", "wave", "nod", "shake",
  "watch", "listen", "step", "climb", "cross", "hand", "throw", "catch",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function issue(
  sceneNumber: number,
  code: ContractIssue["code"],
  severity: ContractIssue["severity"],
  title: string,
  detail: string,
  suggestedFix: string
): ContractIssue {
  return { sceneNumber, code, severity, title, detail, suggestedFix };
}

function isGeneric(state: string): boolean {
  const key = normalise(state);
  if (!key || key.length < MIN_STATE_LENGTH) return true;
  return GENERIC_STATES.has(key);
}

/**
 * True when a phrase reads as something HAPPENING rather than something BEING.
 *
 * Used only in combination with other evidence. On its own it would flag
 * legitimate states that happen to mention an action.
 */
export function looksLikeActivity(text: string, castNames: string[] = []): boolean {
  const tokens = tokenize(text);
  if (tokens.length === 0) return false;

  const hasActionVerb = tokens.some((t) => ACTIVITY_VERB_STEMS.has(t));
  if (!hasActionVerb) return false;

  // A named character DOING something is the classic shape of the mistake.
  const castTokens = new Set(castNames.flatMap((n) => tokenize(n)));
  const namesSomeone = tokens.some((t) => castTokens.has(t));

  return namesSomeone;
}

// ---------------------------------------------------------------------------
// Single-scene validation
// ---------------------------------------------------------------------------

export interface ContractValidation {
  sceneNumber: number;
  hasContract: boolean;
  valid: boolean;
  issues: ContractIssue[];
}

/**
 * Validate one scene's contract.
 *
 * `scene` is read, never written. `castNames` and the story's scene numbers
 * are supplied by the caller so this stays pure.
 */
export function validateSceneContract(
  scene: any,
  options: { castNames?: string[]; knownSceneNumbers?: Set<number> } = {}
): ContractValidation {
  const sceneNumber = Number(scene?.sceneNumber) || 0;
  const castNames = options.castNames ?? [];
  const known = options.knownSceneNumbers;
  const issues: ContractIssue[] = [];

  const contract = scene?.contract;
  if (!contract || typeof contract !== "object") {
    return {
      sceneNumber,
      hasContract: false,
      valid: false,
      issues: [
        issue(
          sceneNumber,
          "missing-contract",
          "info",
          `Scene ${sceneNumber} has no dramatic contract`,
          "Nothing states what this scene is trying to do or what it changes.",
          "Contract-dependent checks are skipped for this scene rather than assumed to pass."
        ),
      ],
    };
  }

  // --- goal / obstacle / outcome -----------------------------------------
  const goal = clean(contract.goal);
  if (!goal || goal.length < 4) {
    issues.push(
      issue(
        sceneNumber,
        "missing-goal",
        "warning",
        `Scene ${sceneNumber} states no scene goal`,
        "A scene needs something the focal character is trying to accomplish in it.",
        "State what they want DURING this scene - not the whole-story goal."
      )
    );
  }

  const obstacle = clean(contract.obstacle);
  if (!obstacle || obstacle.length < 4) {
    issues.push(
      issue(
        sceneNumber,
        "missing-obstacle",
        "info",
        `Scene ${sceneNumber} states no obstacle`,
        "Nothing is recorded as making the scene goal difficult.",
        "An obstacle may be internal, interpersonal or situational - a quiet scene does not need invented danger."
      )
    );
  }

  const outcome = clean(contract.outcome).toLowerCase();
  if (!SCENE_OUTCOMES.includes(outcome as any)) {
    issues.push(
      issue(
        sceneNumber,
        "invalid-outcome",
        "warning",
        `Scene ${sceneNumber} has an unusable outcome ("${contract.outcome ?? ""}")`,
        `Outcome must be one of: ${SCENE_OUTCOMES.join(", ")}.`,
        "Say what happened to the scene's own goal."
      )
    );
  }

  const performanceType = clean(contract.performanceType).toLowerCase();
  if (performanceType && !PERFORMANCE_TYPES.includes(performanceType as any)) {
    issues.push(
      issue(
        sceneNumber,
        "invalid-performance-type",
        "info",
        `Scene ${sceneNumber} has an unknown performance type ("${contract.performanceType}")`,
        `Expected one of: ${PERFORMANCE_TYPES.join(", ")}.`,
        "Classification only at this stage - an unknown value is recorded but not counted."
      )
    );
  }

  // --- progression: the part that actually matters ------------------------
  const progression = contract.progression;
  if (!progression || typeof progression !== "object") {
    issues.push(
      issue(
        sceneNumber,
        "missing-progression",
        "warning",
        `Scene ${sceneNumber} records no value change`,
        "Without a progression there is nothing to verify: the scene claims no change at all.",
        "Name the value at stake and where it stands before and after."
      )
    );
  } else {
    const kind = clean(progression.kind).toLowerCase();
    if (!NARRATIVE_CHANGE_KINDS.includes(kind as any)) {
      issues.push(
        issue(
          sceneNumber,
          "invalid-kind",
          "warning",
          `Scene ${sceneNumber} has an unknown change kind ("${progression.kind ?? ""}")`,
          `Expected one of: ${NARRATIVE_CHANGE_KINDS.join(", ")}.`,
          "Pick the kind of change this scene actually produces."
        )
      );
    }

    const before = clean(progression.before);
    const after = clean(progression.after);

    if (isGeneric(before) || isGeneric(after)) {
      issues.push(
        issue(
          sceneNumber,
          "generic-progression",
          "warning",
          `Scene ${sceneNumber} states a value change that says nothing`,
          `before: "${before}" -> after: "${after}". One or both are empty or a non-answer.`,
          "Describe the same value at two genuinely different states."
        )
      );
    } else if (normalise(before) === normalise(after)) {
      issues.push(
        issue(
          sceneNumber,
          "identical-before-after",
          "warning",
          `Scene ${sceneNumber} ends where it started`,
          `The value "${clean(progression.value)}" is "${before}" before and after. Nothing turned.`,
          "If the value is unchanged, the scene has activity but no event. Give it a real change or cut it."
        )
      );
    } else {
      const similarity = textSimilarity(before, after);
      if (similarity >= BEFORE_AFTER_THRESHOLD) {
        issues.push(
          issue(
            sceneNumber,
            "near-identical-before-after",
            "warning",
            `Scene ${sceneNumber} restates its starting state as its ending state`,
            `before: "${before}" -> after: "${after}" (similarity ${Math.round(similarity * 100) / 100}).`,
            "The two states are the same words rearranged. Say what genuinely moved."
          )
        );
      }
    }

    // Activity masquerading as progression. Two independent signals, because
    // either alone produces false positives on legitimate states that mention
    // an action.
    const actionText = clean(scene?.characterActions);

    // A staging verb inside a value state is not automatically activity.
    //
    // "who holds the packet's top spot" legitimately moves from "Beeju holds
    // it" to "Motu holds it" - the verb IS the tracked state. Flagging that
    // taught a writer to avoid the clearest possible wording. So when the
    // declared VALUE itself names the verb or the relationship being tracked,
    // the lexical activity signal is withdrawn.
    const valueText = clean(progression.value);
    const valueTokens = new Set(tokenize(valueText));
    const stateVerbIsTheValue = (state: string) =>
      tokenize(state).some((t) => valueTokens.has(t));

    const valueExplainsBoth = stateVerbIsTheValue(before) && stateVerbIsTheValue(after);

    const bothLookLikeActivity =
      !valueExplainsBoth &&
      looksLikeActivity(before, castNames) &&
      looksLikeActivity(after, castNames);
    const mirrorsAction =
      actionText.length > 0 &&
      (textSimilarity(before, actionText) >= ACTIVITY_THRESHOLD ||
        textSimilarity(after, actionText) >= ACTIVITY_THRESHOLD);

    // Two INDEPENDENT detectors, reported separately because they are
    // different mistakes with different fixes - and because one is
    // threshold-free while the other is calibrated, which a combined code
    // would hide from the calibration harness.
    if (!isGeneric(before) && !isGeneric(after)) {
      if (bothLookLikeActivity) {
        issues.push(
          issue(
            sceneNumber,
            "activity-as-progression",
            "warning",
            `Scene ${sceneNumber} lists two actions instead of one value changing`,
            `before: "${before}" -> after: "${after}". Both name a character doing something; neither names a state.`,
            'A progression names a VALUE and moves it: "trust: guarded -> slightly restored". It is not a list of events.'
          )
        );
      }

      if (mirrorsAction) {
        issues.push(
          issue(
            sceneNumber,
            "progression-restates-action",
            "warning",
            `Scene ${sceneNumber} restates its own action line as its value change`,
            `The claimed change repeats "${actionText}".`,
            "What the scene SHOWS is already recorded in the action line. Say what it CHANGES."
          )
        );
      }
    }
  }

  // --- repetition intent --------------------------------------------------
  const intent = contract.repetitionIntent;
  if (intent && typeof intent === "object") {
    const kind = clean(intent.kind).toLowerCase();
    const echoes = Number(intent.echoesScene);
    const variation = clean(intent.variation);

    if (!REPETITION_INTENT_KINDS.includes(kind as any)) {
      issues.push(
        issue(
          sceneNumber,
          "repetition-intent-invalid-kind",
          "warning",
          `Scene ${sceneNumber} declares an unknown repetition kind ("${intent.kind ?? ""}")`,
          `Expected one of: ${REPETITION_INTENT_KINDS.join(", ")}.`,
          "An unrecognised declaration does not exempt the scene from repetition findings."
        )
      );
    }

    if (!Number.isFinite(echoes) || echoes >= sceneNumber) {
      issues.push(
        issue(
          sceneNumber,
          "repetition-intent-forward-reference",
          "warning",
          `Scene ${sceneNumber} echoes a scene that has not happened yet`,
          `It points at scene ${intent.echoesScene}. A callback can only echo something the audience has already seen.`,
          "Point at an earlier scene, or drop the declaration."
        )
      );
    } else if (known && !known.has(echoes)) {
      issues.push(
        issue(
          sceneNumber,
          "repetition-intent-unknown-scene",
          "warning",
          `Scene ${sceneNumber} echoes a scene that does not exist`,
          `It points at scene ${echoes}, which is not in this story.`,
          "Point at a real earlier scene, or drop the declaration."
        )
      );
    }

    if (!variation || variation.length < 8 || isGeneric(variation)) {
      issues.push(
        issue(
          sceneNumber,
          "repetition-intent-no-variation",
          "warning",
          `Scene ${sceneNumber} declares an echo but not what differs`,
          `variation: "${variation}". Recurrence works through variation; an unchanged repeat is the same scene twice.`,
          "Say what is materially different this time, or the declaration does not exempt anything."
        )
      );
    }
  }

  const valid = issues.every((i) => i.severity !== "warning");
  return { sceneNumber, hasContract: true, valid, issues };
}

// ---------------------------------------------------------------------------
// Story-level report
// ---------------------------------------------------------------------------

function distribution<T extends string>(
  values: T[],
  total: number
): Array<{ value: string; scenes: number; sharePercent: number }> {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()]
    .map(([value, scenes]) => ({
      value,
      scenes,
      sharePercent: total > 0 ? Math.round((scenes / total) * 100) : 0,
    }))
    .sort((a, b) => b.scenes - a.scenes);
}

/**
 * Validate every contract in a story.
 *
 * Never throws and never mutates. A story with no contracts returns
 * `degraded: true` rather than a clean report it cannot vouch for.
 */
export function buildSceneContractReport(params: {
  scenes: any[];
  characters?: any[];
}): SceneContractReport {
  const empty: SceneContractReport = {
    sceneCount: 0,
    scenesWithValidContract: [],
    scenesMissingContract: [],
    scenesWithInvalidContract: [],
    progressionKinds: [],
    performanceTypes: [],
    unchangedProgressions: [],
    invalidRepetitionIntents: [],
    issues: [],
    degraded: true,
    warnings: 0,
    infos: 0,
  };

  try {
    const list = (Array.isArray(params.scenes) ? params.scenes : [])
      .filter((s) => s !== null && typeof s === "object")
      .sort((a, b) => (Number(a?.sceneNumber) || 0) - (Number(b?.sceneNumber) || 0));

    if (list.length === 0) return empty;

    const castNames = (Array.isArray(params.characters) ? params.characters : [])
      .map((c: any) => clean(c?.name))
      .filter(Boolean);

    const knownSceneNumbers = new Set(list.map((s) => Number(s?.sceneNumber) || 0));

    const validations = list.map((scene) =>
      validateSceneContract(scene, { castNames, knownSceneNumbers })
    );

    const issues = validations.flatMap((v) => v.issues);

    const withContract = validations.filter((v) => v.hasContract);
    const degraded = withContract.length === 0;

    // Duplicate contracts: the same claim copied across several scenes. This
    // is the contract-layer echo of the distinctiveness engine's job, and it
    // is cheap to detect here because the fields are typed.
    const duplicateScenes = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      const a = list[i]?.contract?.progression;
      if (!a) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]?.contract?.progression;
        if (!b) continue;
        const sameKind = clean(a.kind).toLowerCase() === clean(b.kind).toLowerCase();
        if (!sameKind) continue;
        const sameValue = textSimilarity(clean(a.value), clean(b.value)) >= BEFORE_AFTER_THRESHOLD;
        const sameBefore = textSimilarity(clean(a.before), clean(b.before)) >= BEFORE_AFTER_THRESHOLD;
        const sameAfter = textSimilarity(clean(a.after), clean(b.after)) >= BEFORE_AFTER_THRESHOLD;
        if (sameValue && sameBefore && sameAfter) {
          const sa = Number(list[i]?.sceneNumber) || 0;
          const sb = Number(list[j]?.sceneNumber) || 0;
          duplicateScenes.add(sa);
          duplicateScenes.add(sb);
          issues.push(
            issue(
              sb,
              "duplicate-contract",
              "warning",
              `Scenes ${sa} and ${sb} claim the same change`,
              `Both move "${clean(a.value)}" from "${clean(a.before)}" to "${clean(a.after)}".`,
              "Two scenes producing one change means one of them is not earning its ten seconds."
            )
          );
        }
      }
    }

    const kinds = list
      .map((s) => clean(s?.contract?.progression?.kind).toLowerCase())
      .filter((k) => NARRATIVE_CHANGE_KINDS.includes(k as any));

    const types = list
      .map((s) => clean(s?.contract?.performanceType).toLowerCase())
      .filter((t) => PERFORMANCE_TYPES.includes(t as any));

    const unchangedCodes = new Set([
      "identical-before-after",
      "near-identical-before-after",
      "generic-progression",
      "activity-as-progression",
      "progression-restates-action",
    ]);
    const intentCodes = new Set([
      "repetition-intent-forward-reference",
      "repetition-intent-unknown-scene",
      "repetition-intent-no-variation",
      "repetition-intent-invalid-kind",
    ]);

    const scenesWithWarnings = new Set(
      issues.filter((i) => i.severity === "warning").map((i) => i.sceneNumber)
    );

    return {
      sceneCount: list.length,
      scenesWithValidContract: validations
        .filter((v) => v.hasContract && !scenesWithWarnings.has(v.sceneNumber))
        .map((v) => v.sceneNumber),
      scenesMissingContract: validations.filter((v) => !v.hasContract).map((v) => v.sceneNumber),
      scenesWithInvalidContract: validations
        .filter((v) => v.hasContract && scenesWithWarnings.has(v.sceneNumber))
        .map((v) => v.sceneNumber),
      progressionKinds: distribution(kinds, list.length).map((d) => ({
        kind: d.value,
        scenes: d.scenes,
        sharePercent: d.sharePercent,
      })),
      performanceTypes: distribution(types, list.length).map((d) => ({
        type: d.value,
        scenes: d.scenes,
        sharePercent: d.sharePercent,
      })),
      unchangedProgressions: [
        ...new Set(issues.filter((i) => unchangedCodes.has(i.code)).map((i) => i.sceneNumber)),
      ].sort((a, b) => a - b),
      invalidRepetitionIntents: [
        ...new Set(issues.filter((i) => intentCodes.has(i.code)).map((i) => i.sceneNumber)),
      ].sort((a, b) => a - b),
      issues,
      degraded,
      warnings: issues.filter((i) => i.severity === "warning").length,
      infos: issues.filter((i) => i.severity === "info").length,
    };
  } catch {
    return empty;
  }
}

/** One-line summary for the generation log. */
export function summariseContracts(report: SceneContractReport): string {
  if (report.degraded) return "no scene contracts (older story shape)";
  return (
    `${report.scenesWithValidContract.length}/${report.sceneCount} valid, ` +
    `${report.scenesWithInvalidContract.length} with findings, ` +
    `${report.scenesMissingContract.length} missing, ` +
    `${report.warnings} warning(s)`
  );
}
