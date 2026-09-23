import { textSimilarity, normalise, tokenize } from "./scene-distinctiveness.js";
import type { DistinctivenessReport } from "./scene-distinctiveness.js";
import type { FeasibilityReport } from "./performance-budget.js";
import type { BeatDensityReport } from "./beat-density.js";
import type { ActionDensityReport } from "./action-density.js";
import type {
  ContinuityIssue,
  QualityFinding,
  QualityFindingCode,
  QualitySeverity,
  SceneContractReport,
  StoryQualityGateReport,
} from "../../types.js";

/**
 * THE STORY QUALITY GATE
 *
 * Answers one question per scene: is it dramatically necessary, distinct,
 * contract-honest, and actually producible as a ten-second Flow/Veo clip?
 *
 * It CONSUMES the existing analysis layers and owns nothing:
 *
 *   P0 distinctiveness  -> repetition findings
 *   P0 feasibility      -> speech overruns
 *   P1 beat density     -> planned stretching
 *   P2 contracts        -> malformed or dishonest claims
 *   P3 planned moves    -> did the scene execute what was planned
 *   P4 action density   -> can the staging happen in one clip
 *   Continuity Director -> joins that are physically unrenderable
 *
 * There is deliberately no scoring. A number would compress explainable
 * findings into something unarguable and unactionable; a person fixing a story
 * needs to know WHICH scene and WHY.
 *
 * REPORT ONLY, permanently. `block` names a severe failure; it does not stop
 * anything. Nothing here mutates a scene or repairs anything - repair is P5
 * and is not built.
 *
 * DEGRADE, NEVER INVENT. Where a layer has no data the checks that need it are
 * skipped and `degraded` says so, rather than reporting a clean bill of health
 * the evidence cannot support.
 */

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * A repetition run this long stops being a stumble and becomes a stall.
 *
 * P0 already only emits a run at 3+ scenes, so this promotes the longer ones.
 */
const RUN_BLOCK_LENGTH = 4;

/**
 * Below this similarity, a scene did not execute its planned move.
 *
 * Deliberately LOW. A scene legitimately stages its planned move with
 * different vocabulary - "the rent notice is slid under the door" may be
 * written as "an envelope appears on the threshold" - so only a near-total
 * absence of shared content is evidence of divergence. Precision over recall:
 * a false "you ignored the plan" is worse than a missed one.
 */
const PLANNED_MOVE_DIVERGENCE = 0.08;

/** Speech beyond the shot length. Matches the P0 feasibility bands. */
const OVERRUN_FRACTION = 1.0;

/** One progression kind covering this much of a film is monotony. */
const MONOTONY_SHARE = 0.55;

/** A single place covering this much of a film, with no journey to justify it. */
const PLACE_PATHOLOGICAL_SHARE = 80;

/**
 * Turn-count spread below this means the density was a quota, not a choice.
 *
 * Evidence: a real 36-scene generation returned exactly six turns in 33 of its
 * scenes (std dev 0.28) under a rule that asked for four to six. A genuinely
 * type-driven film varies far more than that.
 */
const UNIFORM_DENSITY_STDDEV = 0.6;

/**
 * Outcomes that contradict a progression kind.
 *
 * These are logical contradictions inside the model's own vocabulary, not
 * judgements about the writing - a scene cannot claim its goal was `achieved`
 * while its narrative value moved backwards.
 */
const CONTRADICTORY: Array<{ kind: string; outcomes: string[] }> = [
  { kind: "setback", outcomes: ["achieved"] },
  // 'obstacle' + 'achieved' was here and has been REMOVED. It is not a
  // contradiction: a scene can introduce or escalate an obstacle and still
  // achieve its immediate goal - that is exactly what an escalating-attempt
  // scene is. On a real story it flagged a scene where a character is knocked
  // down by a flood (obstacle appears) and still finds the wall he was looking
  // for (goal achieved). Both were true.
  { kind: "progress", outcomes: ["denied", "reversed"] },
  { kind: "payoff", outcomes: ["deferred"] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finding(
  code: QualityFindingCode,
  severity: QualitySeverity,
  sceneNumbers: number[],
  title: string,
  detail: string,
  suggestedFix: string
): QualityFinding {
  return { code, severity, sceneNumbers, title, detail, suggestedFix };
}

/** Everything the scene actually shows, for corroborating a contract claim. */
function sceneEvidence(scene: any): string {
  const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
  return [
    clean(scene?.characterActions),
    clean(scene?.storyFunction),
    clean(scene?.purpose),
    clean(scene?.endState),
    turns.map((t: any) => clean(t?.line)).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface QualityGateInput {
  scenes: any[];
  blueprint?: any;
  distinctiveness?: DistinctivenessReport | null;
  feasibility?: FeasibilityReport | null;
  actionDensity?: ActionDensityReport | null;
  contracts?: SceneContractReport | null;
  beatDensity?: BeatDensityReport | null;
  /** Existing StoryQualityReport, for setups and place concentration. */
  storyQuality?: any;
  lifeJourney?: any;
}

export function buildQualityGateReport(input: QualityGateInput): StoryQualityGateReport {
  const empty: StoryQualityGateReport = {
    findings: [],
    blocked: 0,
    repairCandidates: [],
    warnings: 0,
    infos: 0,
    degraded: true,
    evidence: {
      distinctiveness: false,
      feasibility: false,
      actionDensity: false,
      contracts: false,
      plannedMoves: false,
      beatDensity: false,
      continuity: false,
    },
    continuityNoise: 0,
  };

  try {
    const scenes = (Array.isArray(input.scenes) ? input.scenes : [])
      .filter((s) => s !== null && typeof s === "object")
      .sort((a, b) => (Number(a?.sceneNumber) || 0) - (Number(b?.sceneNumber) || 0));

    if (scenes.length === 0) return empty;

    const findings: QualityFinding[] = [];

    // Planned moves, mapped the way every other layer maps them.
    const plannedMove = new Map<number, string>();
    for (const beat of input.blueprint?.beats ?? []) {
      const moves: string[] = Array.isArray(beat?.whatEachSceneDoes) ? beat.whatEachSceneDoes : [];
      const start = Number(beat?.sceneStart);
      if (!Number.isFinite(start)) continue;
      moves.forEach((m, i) => {
        const text = clean(m);
        if (text) plannedMove.set(start + i, text);
      });
    }

    const contracts = input.contracts ?? null;
    const hasContracts = Boolean(contracts && !contracts.degraded);

    const evidence = {
      distinctiveness: Boolean(input.distinctiveness && input.distinctiveness.sceneCount > 0),
      feasibility: Boolean(input.feasibility && input.feasibility.scenes.length > 0),
      actionDensity: Boolean(input.actionDensity && input.actionDensity.scenes.some((s) => s.confident)),
      contracts: hasContracts,
      plannedMoves: plannedMove.size > 0,
      beatDensity: Boolean(input.beatDensity && !input.beatDensity.degraded),
      continuity: scenes.some((s) => Array.isArray(s?.continuityIssues) && s.continuityIssues.length > 0),
    };

    // =======================================================================
    // 1. REPETITION  (consumes P0)
    // =======================================================================
    const d = input.distinctiveness;
    if (d) {
      for (const run of d.runs) {
        const long = run.sceneNumbers.length >= RUN_BLOCK_LENGTH;
        findings.push(
          finding(
            "repetition-run",
            long ? "block" : "repair",
            run.sceneNumbers,
            `Scenes ${run.fromScene}-${run.toScene} are doing the same job`,
            `${run.sceneNumbers.length} consecutive scenes resemble their neighbours (average similarity ${run.averageScore}), driven by ${run.dominantDimensions.join(", ")}.`,
            "Give these scenes different dramatic jobs, or shorten the beat and spend the runtime on new material."
          )
        );
      }

      // Individual pairs, excluding any already covered by a run.
      const inRun = new Set(d.runs.flatMap((r) => r.sceneNumbers));
      for (const pair of d.pairs) {
        if (pair.exempt) continue;
        if (inRun.has(pair.sceneA) && inRun.has(pair.sceneB)) continue;
        findings.push(
          finding(
            "near-duplicate-scenes",
            "warn",
            [pair.sceneA, pair.sceneB],
            `Scenes ${pair.sceneA} and ${pair.sceneB} are near-duplicates`,
            `Similarity ${pair.score} (threshold ${pair.gap <= d.thresholds.window ? d.thresholds.near : d.thresholds.far}), strongest on ${pair.topDimensions.map((t) => `${t.dimension} ${t.score}`).join(", ")}.`,
            "Change what one of them DOES, or declare a deliberate echo with a real variation."
          )
        );
      }

      // A declared echo that did not vary. P0 already withdrew the exemption;
      // the gate states why it matters.
      for (const pair of d.pairs.filter((p) => p.unvariedRecurrence)) {
        findings.push(
          finding(
            "unvaried-declared-recurrence",
            "warn",
            [pair.sceneA, pair.sceneB],
            `A declared echo between scenes ${pair.sceneA} and ${pair.sceneB} did not vary`,
            `Similarity ${pair.score}. ${pair.exemptReason ?? "A repetition intent was declared."}`,
            "Recurrence works through variation. Make the second one different, or drop the declaration."
          )
        );
      }
    }

    // =======================================================================
    // 2. CONTRACT HONESTY  (consumes P2 + P3)
    // =======================================================================
    if (hasContracts) {
      // Malformed contracts, lifted from P2 rather than re-derived.
      const unusable = new Set(contracts!.scenesWithInvalidContract);
      if (unusable.size > 0) {
        findings.push(
          finding(
            "contract-unusable",
            "warn",
            [...unusable].sort((a, b) => a - b),
            `${unusable.size} scene(s) have a contract that does not hold up`,
            `Codes raised: ${[...new Set(contracts!.issues.filter((i) => i.severity === "warning").map((i) => i.code))].join(", ")}.`,
            "See the Scene contracts section for the per-scene reason."
          )
        );
      }

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const n = Number(scene?.sceneNumber) || 0;
        const c = scene?.contract;
        const p = c?.progression;
        if (!c || !p) continue;

        const kind = clean(p.kind).toLowerCase();
        const outcome = clean(c.outcome).toLowerCase();

        // -- outcome contradicts the claimed value movement -----------------
        const contradiction = CONTRADICTORY.find((x) => x.kind === kind && x.outcomes.includes(outcome));
        if (contradiction) {
          findings.push(
            finding(
              "outcome-contradicts-progression",
              "warn",
              [n],
              `Scene ${n} claims a "${outcome}" outcome for a "${kind}" change`,
              `"${clean(p.value)}" moves ${clean(p.before)} -> ${clean(p.after)}, but the scene goal is recorded as ${outcome}.`,
              "One of the two is wrong. Decide what actually happened to the goal."
            )
          );
        }

        // -- a relationship claim with no delta in the layer that owns them --
        // Uses the EXISTING social system as corroboration rather than
        // re-deriving relationship state here.
        if (kind === "relationship") {
          const deltas = Array.isArray(scene?.socialChanges) ? scene.socialChanges : [];
          if (deltas.length === 0) {
            findings.push(
              finding(
                "relationship-change-uncorroborated",
                "info",
                [n],
                `Scene ${n} claims a relationship change but emits no social change`,
                `Contract: "${clean(p.value)}" ${clean(p.before)} -> ${clean(p.after)}. No entry in 'socialChanges'.`,
                "Record the shift where relationships are actually tracked, or reclassify the change kind."
              )
            );
          }
        }

        // -- did the scene execute the move that was planned? ---------------
        const planned = plannedMove.get(n);
        if (planned) {
          // Compared against the scene's own CLAIM about its job, not against
          // everything the scene contains. Comparing against the full evidence
          // and taking the best match meant a shared character name was enough
          // to clear the bar, which made this check unable to fire at all.
          const claim = [clean(c.goal), clean(p.value), clean(p.after), clean(scene?.storyFunction)]
            .filter(Boolean)
            .join(" ");
          const similarity = textSimilarity(planned, claim);
          if (similarity < PLANNED_MOVE_DIVERGENCE && tokenize(planned).length >= 3) {
            findings.push(
              finding(
                "planned-move-not-executed",
                "repair",
                [n],
                `Scene ${n} does not appear to execute its planned move`,
                `Planned: "${planned}". The scene's own goal and value change share almost nothing with it (similarity ${Math.round(similarity * 100) / 100}).`,
                "Either stage the planned move, or preserve its dramatic purpose - the beat sheet is the plan."
              )
            );
          }
        }

        // -- consecutive scenes doing the same dramatic job ------------------
        const prev = scenes[i - 1];
        const pp = prev?.contract?.progression;
        if (pp) {
          const sameKind = clean(pp.kind).toLowerCase() === kind;
          const sameValue = textSimilarity(clean(pp.value), clean(p.value)) >= 0.6;
          const sameDirection = textSimilarity(clean(pp.after), clean(p.after)) >= 0.6;
          if (sameKind && sameValue && sameDirection) {
            findings.push(
              finding(
                "consecutive-same-dramatic-job",
                "repair",
                [Number(prev?.sceneNumber) || 0, n],
                `Scenes ${prev?.sceneNumber} and ${n} perform the same dramatic job`,
                `Both are "${kind}" changes to "${clean(p.value)}" ending at "${clean(p.after)}".`,
                "One of the two is not earning its ten seconds. Change its job or cut it."
              )
            );
          }
        }
      }
    }

    // =======================================================================
    // 3. TEN-SECOND FEASIBILITY  (consumes P0 + P4)
    // =======================================================================
    const f = input.feasibility;
    if (f) {
      for (const m of f.scenes) {
        const scene = scenes.find((s) => (Number(s?.sceneNumber) || 0) === m.sceneNumber);
        const type = clean(scene?.contract?.performanceType).toLowerCase();

        if (m.speechFraction > OVERRUN_FRACTION) {
          findings.push(
            finding(
              "dialogue-overruns-shot",
              "repair",
              [m.sceneNumber],
              `Scene ${m.sceneNumber}'s dialogue cannot be spoken in the shot`,
              `${m.words} words across ${m.turns} turns is about ${m.estimatedSpeechSeconds}s of speech - ${Math.round(m.speechFraction * 100)}% of the clip, before any action.`,
              "Cut to what can actually be performed. Flow will rush or clip the rest."
            )
          );
        } else if (m.verdict === "tight") {
          findings.push(
            finding(
              "dialogue-tight-for-shot",
              "info",
              [m.sceneNumber],
              `Scene ${m.sceneNumber} leaves little room for anything but speech`,
              `${m.words} words fills ${Math.round(m.speechFraction * 100)}% of the clip.`,
              "Fine if the scene is only talk; a problem if it also needs visible action."
            )
          );
        }

        // Under-filling is only a fault for a scene that CHOSE to be a
        // dialogue scene. Silence, reaction, establishing, action and montage
        // are supposed to be sparse and must never be reported for it.
        if (m.verdict === "underfilled" && type === "dialogue-scene") {
          findings.push(
            finding(
              "dialogue-underfilled",
              // Was 'info', which is the severity for something worth knowing
              // rather than something worth fixing. A scene that declared
              // itself a dialogue scene and then barely speaks is the exact
              // complaint this work started from, so it is a warning.
              "warn",
              [m.sceneNumber],
              `Scene ${m.sceneNumber} is a dialogue scene with almost no dialogue`,
              `${m.words} words fills only ${Math.round(m.speechFraction * 100)}% of the clip.`,
              "Either let them talk, or reclassify the scene as what it actually is."
            )
          );
        }
      }

      // The quota signature, at story level.
      if (f.scenes.length >= 8 && f.turnsStdDev <= UNIFORM_DENSITY_STDDEV && f.dominantTurnCount) {
        findings.push(
          finding(
            "uniform-dialogue-density",
            "warn",
            [],
            "Nearly every scene carries the same amount of talk",
            `Turn-count standard deviation ${f.turnsStdDev}; ${f.dominantTurnCount.scenes} of ${f.scenes.length} scenes have exactly ${f.dominantTurnCount.turns} turns (${f.dominantTurnCount.sharePercent}%).`,
            "Density should follow what each scene IS. Uniform density is a quota being filled, and reads as mechanical."
          )
        );
      }
    }

    const a = input.actionDensity;
    if (a) {
      for (const m of a.scenes.filter((x) => x.overloaded)) {
        findings.push(
          finding(
            "action-overloaded",
            "repair",
            [m.sceneNumber],
            `Scene ${m.sceneNumber} asks for more staging than one clip can hold`,
            `${m.sequentialBeats} sequential beats (limit ${m.limit} for ${m.performanceType ?? "an unclassified scene"}) and ${m.relocations} change(s) of place: ${m.beatTexts.join(" | ")}.`,
            "Flow renders one primary visual beat per clip. Keep one, or split the rest across scenes."
          )
        );
      }
    }

    // =======================================================================
    // 3b. PERFORMANCE AND PRODUCTION CONTINUITY
    // =======================================================================
    //
    // Consumes the fields the later phases added: the performance track, the
    // frame handoff, in-frame text and the beat clock. Every check here is
    // structural - it reads what the scene PLANNED, never what a line means -
    // so none of it depends on understanding the story's language.
    //
    // DEGRADE, NEVER INVENT applies as everywhere else: a story generated
    // before these fields existed simply produces no findings from them,
    // rather than a clean bill of health.
    const seenWorldText = new Map<string, number>();

    for (const scene of scenes) {
      const n = Number(scene?.sceneNumber) || 0;
      const type = String(scene?.contract?.performanceType ?? "").trim();
      const present: string[] = Array.isArray(scene?.charactersPresent) ? scene.charactersPresent : [];
      const turns: any[] = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
      // Restricted to characters the scene says are PRESENT, and excluding
      // placeholder speakers. A turn attributed to "None / Visual Action" would
      // otherwise make a wordless scene look like it had speech in it, and its
      // whole silent cast would then be reported as idle.
      const presentKeys = new Set(present.map((c: any) => clean(c).toLowerCase()).filter(Boolean));
      const speakers = new Set(
        turns
          .filter((t) => clean(t?.line))
          .map((t) => clean(t?.speaker).toLowerCase())
          .filter((name) => name && !/^(none|n\/a|-+|silent|no dialogue|visual action)\b/i.test(name))
          .filter((name) => presentKeys.has(name))
      );

      // A dialogue scene where one character says everything while others
      // stand there. Measured at 17 of 34 dialogue scenes in a real story:
      // half the "conversations" were monologues with an audience.
      if (type === "dialogue-scene" && speakers.size === 1 && present.length >= 2) {
        findings.push(
          finding(
            "speaker-monologue",
            "warn",
            [n],
            `Scene ${n} is a dialogue scene with only one voice in it`,
            `${present.length} characters present, every line spoken by the same one.`,
            "Either give someone a reply - a question, an objection, an interruption - or relabel the scene as what it actually is."
          )
        );
      }

      // Someone on screen with nothing planned. The scene's own action line
      // counts as a plan, so a character it choreographs is never reported.
      const planned = new Set(
        (Array.isArray(scene?.bystanders) ? scene.bystanders : [])
          .map((b: any) => clean(b?.character).toLowerCase())
          .filter(Boolean)
      );
      const actionText = `${clean(scene?.characterActions)} ${clean(scene?.visualDescription)}`;
      const idle = present.filter((raw) => {
        const name = clean(raw);
        if (!name) return false;
        const key = name.toLowerCase();
        if (speakers.has(key) || planned.has(key)) return false;
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return !new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu").test(actionText);
      });

      // Only when somebody IS speaking. A wholly silent scene is a legitimate
      // choice and is the performance type's business, not this check's.
      if (idle.length > 0 && speakers.size > 0) {
        findings.push(
          finding(
            "bystander-idle",
            "warn",
            [n],
            `Scene ${n} leaves ${idle.length} character(s) on screen with nothing to do`,
            `${idle.join(", ")} neither speak nor appear in the action, and no behaviour is planned for them.`,
            "Put them in 'bystanders' with what they are doing and where they are looking, or take them out of the shot."
          )
        );
      }

      // A cut that stays in the same place with the same cast and is told it
      // needs no reference frame. This is the join where faces, in-frame text
      // and background crowds were measurably drifting.
      const handoff = scene?.frameHandoff;
      if (handoff && handoff.mode === "FRESH" && handoff.requiresFrameUpload === false) {
        const prev = scenes.find((s) => (Number(s?.sceneNumber) || 0) === n - 1);
        if (prev && samePlaceByState(prev, scene) && sharesCast(prev, scene)) {
          findings.push(
            finding(
              "frame-handoff-missing",
              "warn",
              [n],
              `Scene ${n} cuts within the same place but asks for no reference frame`,
              "Same location and overlapping cast as the previous scene, yet the operator step says no frame upload.",
              "Classify this join as IDENTITY so the previous clip's last frame goes in as a reference; without it the faces and background are re-invented."
            )
          );
        }
      }

      // The same sign, worded two different ways. Rendered lettering is the
      // least stable thing the video model produces, so two spellings of one
      // banner become two different banners on screen.
      const text = clean(scene?.worldText);
      if (text && !/^(none|n\/a|-+)$/i.test(text)) {
        const key = normalise(text);
        const first = seenWorldText.get(key);
        if (first === undefined) {
          for (const [seen, firstScene] of seenWorldText) {
            const similar = textSimilarity(seen, key);
            if (similar >= 0.49 && similar < 1) {
              findings.push(
                finding(
                  "world-text-unstable",
                  "warn",
                  [firstScene, n],
                  `Scenes ${firstScene} and ${n} show the same sign worded differently`,
                  `"${text}" against the earlier wording (similarity ${similar.toFixed(2)}).`,
                  "Write in-frame text character for character the same in every scene it appears. Two spellings render as two different signs."
                )
              );
              break;
            }
          }
          seenWorldText.set(key, n);
        }
      }

      // Content that cannot be performed in the shot at a speakable rate. The
      // beat clock already computes this and nothing consumed it.
      if (scene?.beatClock?.overflows === true) {
        findings.push(
          finding(
            "beat-clock-overflows",
            "repair",
            [n],
            `Scene ${n} holds more than the shot can perform`,
            `Speech and action together exceed the shot at a speakable rate.`,
            "Cut a line or move a beat to the next scene. Compressing it makes the video model rush or clip the delivery."
          )
        );
      }
    }

    // =======================================================================
    // 4. PRODUCTION FEASIBILITY  (consumes the Continuity Director)
    // =======================================================================
    //
    // Only the findings that make a join PHYSICALLY UNRENDERABLE are promoted.
    // Everything else the validator reported is counted as noise and left
    // alone - the validator has known false-positive classes (prose-level
    // location comparison, overnight time) and folding those in would bury the
    // real ones. Continuity is NOT re-validated here.
    let continuityNoise = 0;
    const chainDirection: number[] = [];
    const chainOther: number[] = [];

    for (const scene of scenes) {
      const issues: ContinuityIssue[] = Array.isArray(scene?.continuityIssues) ? scene.continuityIssues : [];
      const isChain = String(scene?.transitionType ?? "").toUpperCase() === "CHAIN";
      for (const issue of issues) {
        const title = issue.title.toLowerCase();
        if (isChain && issue.dimension === "camera" && title.includes("screen direction")) {
          chainDirection.push(Number(scene?.sceneNumber) || 0);
        } else if (isChain && title.includes("does not open where the last one ended")) {
          chainOther.push(Number(scene?.sceneNumber) || 0);
        } else {
          continuityNoise++;
        }
      }
    }

    if (chainDirection.length > 0) {
      findings.push(
        finding(
          "chain-screen-direction-reversed",
          "block",
          chainDirection,
          `${chainDirection.length} unbroken join(s) reverse screen direction`,
          `Scenes ${chainDirection.join(", ")} are marked CHAIN but the action reads the other way across the join.`,
          "A CHAIN needs the previous clip's last frame as this clip's first frame. Reversed direction makes that impossible - hold direction, or make the join a CUT."
        )
      );
    }

    if (chainOther.length > 0) {
      findings.push(
        finding(
          "chain-join-unrenderable",
          "warn",
          chainOther,
          `${chainOther.length} unbroken join(s) do not open where the previous scene ended`,
          `Scenes ${chainOther.join(", ")}.`,
          "Open the CHAIN from the previous ending, or make it a CUT."
        )
      );
    }

    // =======================================================================
    // 5. SCENE NECESSITY
    // =======================================================================
    //
    // Only raised on COMBINED evidence, and only ever as a repair candidate.
    // A quiet scene is not filler for being quiet: emotional, reaction and
    // silent scenes are frequently the most necessary in a film, so low
    // physical activity is deliberately not part of the evidence at all.
    const flaggedPairs = new Set(
      (d?.pairs ?? []).filter((p) => !p.exempt).flatMap((p) => [p.sceneA, p.sceneB])
    );
    const noChange = new Set(contracts?.unchangedProgressions ?? []);

    for (const scene of scenes) {
      const n = Number(scene?.sceneNumber) || 0;
      const reasons: string[] = [];

      if (flaggedPairs.has(n)) reasons.push("resembles another scene");
      if (noChange.has(n)) reasons.push("its claimed value change does not hold");
      if (!clean(scene?.setupOrPayoff)) reasons.push("plants and pays off nothing");
      if ((Array.isArray(scene?.socialChanges) ? scene.socialChanges : []).length === 0) {
        reasons.push("shifts no relationship");
      }

      // Three independent signals before saying anything. Two is a coincidence.
      if (reasons.length >= 3) {
        findings.push(
          finding(
            "scene-necessity-doubtful",
            "repair",
            [n],
            `Scene ${n} may not be earning its ten seconds`,
            `Combined evidence: ${reasons.join("; ")}.`,
            "Ambiguous by design - review it rather than cutting it. A quiet scene can be necessary; a scene that changes nothing is not."
          )
        );
      }
    }

    // =======================================================================
    // 6. STORY-LEVEL SIGNALS
    // =======================================================================
    const bd = input.beatDensity;
    if (bd && !bd.degraded) {
      for (const f2 of bd.findings.filter((x) => x.severity === "warning")) {
        const code: QualityFindingCode =
          f2.code === "premise-too-small" ? "premise-too-small" : "beat-stretched";
        findings.push(
          finding(
            code,
            "warn",
            f2.beatNumber ? [] : [],
            f2.title,
            f2.detail,
            f2.suggestedFix
          )
        );
      }
    }

    const sq = input.storyQuality;
    if (sq) {
      const unpaid: string[] = Array.isArray(sq.unpaidSetups) ? sq.unpaidSetups : [];
      if (unpaid.length > 0) {
        findings.push(
          finding(
            "unresolved-setup",
            "warn",
            [],
            `${unpaid.length} planted element(s) never pay off`,
            `Unpaid: ${unpaid.join("; ")}.`,
            "Pay them off, or do not plant them. An open promise is felt even when it is not noticed."
          )
        );
      }

      // Place concentration is informational unless genuinely pathological,
      // because a one-room story is a legitimate form.
      const places: Array<{ placeId: string; sharePercent: number }> = d?.placeConcentration ?? [];
      const top = places[0];
      if (top && top.sharePercent >= PLACE_PATHOLOGICAL_SHARE && scenes.length >= 24 && !input.lifeJourney) {
        findings.push(
          finding(
            "place-concentration-pathological",
            "info",
            [],
            `${top.sharePercent}% of the film happens in one place`,
            `"${top.placeId}" carries ${top.sharePercent}% of ${scenes.length} scenes.`,
            "Legitimate for a single-location story. Worth a look otherwise - assembled clips will read as visually static."
          )
        );
      }
    }

    if (hasContracts && contracts!.progressionKinds.length > 0) {
      const top = contracts!.progressionKinds[0];
      if (top.sharePercent >= MONOTONY_SHARE * 100) {
        findings.push(
          finding(
            "progression-monotony",
            "warn",
            [],
            `${top.sharePercent}% of scenes produce the same kind of change`,
            `"${top.kind}" covers ${top.scenes} of ${scenes.length} scenes.`,
            "A story that only ever learns things, or only ever escalates, is running on one gear."
          )
        );
      }
    }

    // =======================================================================
    const bySeverity = (s: QualitySeverity) => findings.filter((x) => x.severity === s);

    return {
      findings: findings.sort(
        (x, y) =>
          ["block", "repair", "warn", "info"].indexOf(x.severity) -
          ["block", "repair", "warn", "info"].indexOf(y.severity)
      ),
      blocked: bySeverity("block").length,
      repairCandidates: [
        ...new Set(bySeverity("repair").flatMap((x) => x.sceneNumbers)),
      ].sort((x, y) => x - y),
      warnings: bySeverity("warn").length,
      infos: bySeverity("info").length,
      // Degraded when the contract-dependent half could not run at all.
      degraded: !hasContracts,
      evidence,
      continuityNoise,
    };
  } catch {
    return empty;
  }
}

/** One-line summary for the generation log. */
export function summariseQualityGate(report: StoryQualityGateReport): string {
  if (report.findings.length === 0 && report.degraded) return "not evaluated (no contract data)";
  return (
    `${report.blocked} block, ${report.repairCandidates.length} repair candidate(s), ` +
    `${report.warnings} warning(s), ${report.infos} note(s)` +
    (report.degraded ? " [degraded: contract checks skipped]" : "")
  );
}

/**
 * Same place, by structured state.
 *
 * Deliberately a local copy of the frame-handoff logic rather than an import:
 * the gate CONSUMES layers and owns nothing, and importing a production module
 * into it would let a change there alter what the gate reports without anyone
 * touching the gate. Place identity wins wherever both scenes carry one.
 */
function samePlaceByState(prev: any, curr: any): boolean {
  const prevId = clean(prev?.continuityState?.placeId);
  const currId = clean(curr?.continuityState?.placeId);
  if (prevId && currId) return prevId === currId;

  const prevWhere = clean(prev?.continuityState?.location) || clean(prev?.environment);
  const currWhere = clean(curr?.continuityState?.location) || clean(curr?.environment);
  if (!prevWhere || !currWhere) return false;

  return textSimilarity(prevWhere, currWhere) >= 0.55;
}

/** True when at least one character carries over the join. */
function sharesCast(prev: any, curr: any): boolean {
  const before = new Set(
    (Array.isArray(prev?.charactersPresent) ? prev.charactersPresent : [])
      .map((c: any) => clean(c).toLowerCase())
      .filter(Boolean)
  );
  const after = (Array.isArray(curr?.charactersPresent) ? curr.charactersPresent : [])
    .map((c: any) => clean(c).toLowerCase())
    .filter(Boolean);

  return after.some((name: string) => before.has(name));
}
