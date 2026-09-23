import { SHOT_LENGTH_PHRASE } from "../../shared/duration.js";
import type { DistinctivenessReport } from "../story/scene-distinctiveness.js";
import type { FeasibilityReport } from "../story/performance-budget.js";
import type { BeatDensityReport } from "../story/beat-density.js";
import type { QualitySeverity, SceneContractReport, StoryQualityGateReport } from "../../types.js";
import type { ActionDensityReport } from "../story/action-density.js";

/**
 * Story-quality section of a manual-test report.
 *
 * Pure rendering: reads a finished story, returns Markdown, changes nothing.
 *
 * The two numbers worth opening the report for are at the top of each block —
 * average consecutive similarity (is the film stalling?) and average words per
 * scene against the speakability envelope (can the dialogue actually be
 * performed?). Everything else is detail behind those two.
 */

function verdictIcon(v: string): string {
  if (v === "overruns") return "!!";
  if (v === "tight") return "! ";
  if (v === "underfilled") return "~ ";
  if (v === "silent") return "  ";
  return "  ";
}

export function buildDistinctivenessSection(report: DistinctivenessReport | undefined): string {
  if (!report || report.sceneCount === 0) return "_Not measured._";

  const flagged = report.pairs.filter((p) => !p.exempt);
  const exempt = report.pairs.filter((p) => p.exempt);
  const unvaried = report.pairs.filter((p) => p.unvariedRecurrence);

  const lines: string[] = [
    `**Average consecutive similarity:** ${report.averageConsecutiveSimilarity} ` +
      `(thresholds: near ${report.thresholds.near} within ${report.thresholds.window} scenes, far ${report.thresholds.far})`,
    `**Flagged pairs:** ${flagged.length} · **exempt (declared repetition):** ${exempt.length} · ` +
      `**repetition runs:** ${report.runs.length} · **scenes involved:** ${report.scenesInvolved.length}/${report.sceneCount}`,
    "",
  ];

  if (report.runs.length > 0) {
    lines.push("**Repetition runs — stretches where the film stalls**", "");
    report.runs.forEach((run) =>
      lines.push(
        `- **S${run.fromScene}–S${run.toScene}** (${run.sceneNumbers.length} scenes), avg ${run.averageScore} — ` +
          `driven by ${run.dominantDimensions.join(", ")}`
      )
    );
    lines.push("");
  }

  if (flagged.length > 0) {
    lines.push("**Most similar pairs**", "", "| A | B | gap | score | strongest dimensions |", "|---|---|---|---|---|");
    flagged
      .slice(0, 15)
      .forEach((p) =>
        lines.push(
          `| S${p.sceneA} | S${p.sceneB} | ${p.gap} | ${p.score} | ${p.topDimensions
            .map((d) => `${d.dimension} ${d.score}`)
            .join(", ")} |`
        )
      );
    lines.push("");
  } else {
    lines.push("_No pair crossed the threshold._", "");
  }

  if (unvaried.length > 0) {
    lines.push(
      "**Declared repetition that did not vary** — a callback or routine must differ each time it returns",
      "",
      ...unvaried.map((p) => `- S${p.sceneA} / S${p.sceneB} (${p.score}) — ${p.exemptReason ?? "declared"}`),
      ""
    );
  }

  if (exempt.length > 0) {
    lines.push(
      "**Exempt recurrence** (intentional, and varied)",
      "",
      ...exempt.slice(0, 10).map((p) => `- S${p.sceneA} / S${p.sceneB} (${p.score}) — ${p.exemptReason ?? "declared"}`),
      ""
    );
  }

  lines.push(
    "**Place concentration**",
    "",
    "| Place | Scenes | Share |",
    "|---|---|---|",
    ...report.placeConcentration.map((p) => `| \`${p.placeId}\` | ${p.scenes} | ${p.sharePercent}% |`),
    "",
    "_Concentration is reported, never penalised — a one-room story is a legitimate form._"
  );

  return lines.join("\n");
}

export function buildFeasibilitySection(report: FeasibilityReport | undefined): string {
  if (!report || report.scenes.length === 0) return "_Not measured._";

  const lines: string[] = [
    `**Average:** ${report.averageWords} words/scene · speech fills ${Math.round(report.averageSpeechFraction * 100)}% of the shot`,
    `**Envelope:** comfortable ≤ ${report.envelope.comfortable} words · ceiling ≤ ${report.envelope.ceiling} words per ${SHOT_LENGTH_PHRASE} shot`,
    `**Verdicts:** ${report.overruns.length} overrun · ${report.tight.length} tight · ` +
      `${report.scenes.filter((s) => s.verdict === "comfortable").length} comfortable · ` +
      `${report.underfilled.length} underfilled · ${report.silent.length} silent`,
    "",
  ];

  if (report.dominantTurnCount) {
    const d = report.dominantTurnCount;
    lines.push(
      `**Turn-count spread:** std dev ${report.turnsStdDev} · most common is **${d.turns} turns in ${d.scenes} scenes (${d.sharePercent}%)**`
    );
    if (d.sharePercent >= 70) {
      lines.push(
        "",
        `> Nearly every scene carries the same amount of talk. That is a quota being filled rather than scenes being written, and it is itself a form of repetition.`
      );
    }
    lines.push("");
  }

  if (report.overruns.length > 0) {
    lines.push(
      `> ${report.overruns.length} scene(s) contain more dialogue than can be spoken in the shot. Flow/Veo will rush or clip these lines.`,
      ""
    );
  }

  lines.push("| Scene | Turns | Words | Speech | Verdict |", "|---|---|---|---|---|");
  report.scenes.forEach((s) =>
    lines.push(
      `| S${s.sceneNumber} | ${s.turns} | ${s.words} | ${s.estimatedSpeechSeconds}s (${Math.round(
        s.speechFraction * 100
      )}%) | ${verdictIcon(s.verdict)}${s.verdict} |`
    )
  );

  lines.push(
    "",
    "_Report only. Nothing is truncated: trimming a line here would desynchronise the Flow prompt built from it._"
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------

/**
 * Beat density — how much real material the beat sheet contains.
 *
 * Read this before the scene sections: a stretch reported here was decided at
 * blueprint time, and no amount of scene-level craft undoes it.
 */
export function buildBeatDensitySection(report: BeatDensityReport | undefined): string {
  if (!report || report.beats.length === 0) return "_Not measured._";

  if (report.degraded) {
    return (
      "_Density could not be verified — this blueprint carries no per-scene moves " +
      "(`whatEachSceneDoes`). Older blueprints land here; the beat sheet still works, " +
      "but its scene allocation is a claim nothing can check._"
    );
  }

  const lines: string[] = [
    `**${report.totalVerifiedDistinctMoves} materially different move(s) across ${report.totalScenes} scene(s)** · ` +
      `~${report.totalStretchScenes} stretched · ${report.warnings} warning(s), ${report.infos} note(s)`,
    `_Two descriptions count as one move at similarity ≥ ${report.threshold}._`,
    "",
    "| Beat | Name | Scenes | Declared | Described | Verified | Stretch |",
    "|---|---|---|---|---|---|---|",
    ...report.beats.map((b) => {
      const flag = b.stretchScenes > 0 ? " ⚠" : "";
      const declared = b.declaredDistinctScenes ?? "—";
      const verified = b.verifiable ? String(b.verifiedDistinctMoves) : "_n/a_";
      return `| ${b.beatNumber} | ${b.name} | ${b.sceneStart}–${b.sceneEnd} (${b.allocatedScenes}) | ${declared} | ${b.describedMoves} | ${verified} | ${b.stretchScenes}${flag} |`;
    }),
    "",
  ];

  if (report.unverifiableBeats.length > 0) {
    lines.push(`_Beats without per-scene moves (not checked): ${report.unverifiableBeats.join(", ")}_`, "");
  }

  const repeated = report.beats.filter((b) => b.repeatedGroups.length > 0);
  if (repeated.length > 0) {
    lines.push("**Scenes that repeat one move**", "");
    repeated.forEach((b) =>
      b.repeatedGroups.forEach((g) =>
        lines.push(
          `- **Beat ${b.beatNumber}**, scenes ${g.sceneNumbers.join(", ")} (similarity ${g.averageSimilarity}) — “${g.representative}”`
        )
      )
    );
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("**Findings**", "");
    report.findings.forEach((f) =>
      lines.push(`- [${f.severity}] **${f.title}** — ${f.detail} _${f.suggestedFix}_`)
    );
  } else {
    lines.push("_No density findings — every allocated scene has its own move._");
  }

  lines.push(
    "",
    "_Report only. The beat sheet is never rewritten and no scene range is reallocated: " +
      "that is a creative decision, and inventing story material is the one thing this system must never do._"
  );

  return lines.join("\n");
}

/**
 * Scene contracts — what each scene claims to do, and whether the claim holds.
 *
 * The number to read first is how many scenes carry a VALID contract. A story
 * where most contracts are valid can be trusted by the checks built on top of
 * them; one where most are missing or flagged cannot, and says so.
 */
export function buildContractSection(report: SceneContractReport | undefined): string {
  if (!report || report.sceneCount === 0) return "_Not measured._";

  if (report.degraded) {
    return (
      "_No scene carried a dramatic contract — this story predates the contract layer. " +
      "Contract-dependent checks are skipped rather than reported as passing._"
    );
  }

  const lines: string[] = [
    `**${report.scenesWithValidContract.length}/${report.sceneCount} scenes carry a valid contract** · ` +
      `${report.scenesWithInvalidContract.length} with findings · ${report.scenesMissingContract.length} missing · ` +
      `${report.warnings} warning(s), ${report.infos} note(s)`,
    "",
  ];

  if (report.progressionKinds.length > 0) {
    lines.push(
      "**What the story changes**",
      "",
      "| Change kind | Scenes | Share |",
      "|---|---|---|",
      ...report.progressionKinds.map((k) => `| ${k.kind} | ${k.scenes} | ${k.sharePercent}% |`),
      ""
    );
    const top = report.progressionKinds[0];
    if (top && top.sharePercent >= 50) {
      lines.push(
        `> Half the film or more produces one kind of change (**${top.kind}**). A story that only ever learns things, or only ever escalates, is running on one gear.`,
        ""
      );
    }
  }

  if (report.performanceTypes.length > 0) {
    lines.push(
      "**What kind of scenes these are**",
      "",
      "| Performance type | Scenes | Share |",
      "|---|---|---|",
      ...report.performanceTypes.map((t) => `| ${t.type} | ${t.scenes} | ${t.sharePercent}% |`),
      "",
      "_Classification only at this stage — it does not yet drive dialogue density._",
      ""
    );
  }

  if (report.unchangedProgressions.length > 0) {
    lines.push(
      `**Scenes whose claimed change does not hold:** ${report.unchangedProgressions.map((n) => `S${n}`).join(", ")}`,
      ""
    );
  }

  if (report.invalidRepetitionIntents.length > 0) {
    lines.push(
      `**Unusable repetition declarations:** ${report.invalidRepetitionIntents.map((n) => `S${n}`).join(", ")} ` +
        "— these do NOT exempt their scenes from repetition findings.",
      ""
    );
  }

  const warnings = report.issues.filter((i) => i.severity === "warning");
  if (warnings.length > 0) {
    lines.push("**Findings**", "");
    warnings
      .slice(0, 40)
      .forEach((i) => lines.push(`- **S${i.sceneNumber}** [${i.code}] ${i.title} — ${i.detail} _${i.suggestedFix}_`));
    if (warnings.length > 40) lines.push(`- _…and ${warnings.length - 40} more._`);
    lines.push("");
  } else {
    lines.push("_No contract warnings._", "");
  }

  lines.push(
    "_Report only. No contract is rewritten, no scene is regenerated, and nothing here blocks a story._"
  );

  return lines.join("\n");
}

/**
 * Per-scene execution table — the single view for judging a P3 generation.
 *
 * Everything needed to answer "did this scene do its job?" on one row: the
 * move P1 planned, the contract the model actually produced, the performance
 * type it claimed, what that cost in speech, and whether any layer flagged it.
 *
 * Built from the reports that already exist rather than a new telemetry
 * system — this is a join, not a source.
 */
export function buildSceneExecutionSection(params: {
  scenes: any[];
  blueprint?: any;
  feasibility?: FeasibilityReport;
  distinctiveness?: DistinctivenessReport;
  contractReport?: SceneContractReport;
  beatDensity?: BeatDensityReport;
}): string {
  const scenes = Array.isArray(params.scenes) ? params.scenes : [];
  if (scenes.length === 0) return "_No scenes._";

  // Planned moves, mapped the same way everywhere: whatEachSceneDoes[i]
  // belongs to sceneStart + i.
  const plannedMove = new Map<number, string>();
  for (const beat of params.blueprint?.beats ?? []) {
    const moves: string[] = Array.isArray(beat?.whatEachSceneDoes) ? beat.whatEachSceneDoes : [];
    const start = Number(beat?.sceneStart);
    if (!Number.isFinite(start)) continue;
    moves.forEach((m, i) => {
      const text = String(m ?? "").trim();
      if (text) plannedMove.set(start + i, text);
    });
  }

  const feasibilityBy = new Map((params.feasibility?.scenes ?? []).map((f) => [f.sceneNumber, f]));

  const contractIssuesBy = new Map<number, string[]>();
  (params.contractReport?.issues ?? [])
    .filter((i) => i.severity === "warning")
    .forEach((i) => {
      if (!contractIssuesBy.has(i.sceneNumber)) contractIssuesBy.set(i.sceneNumber, []);
      contractIssuesBy.get(i.sceneNumber)!.push(i.code);
    });

  const duplicateOf = new Map<number, string[]>();
  (params.distinctiveness?.pairs ?? [])
    .filter((p) => !p.exempt)
    .forEach((p) => {
      for (const [a, b] of [[p.sceneA, p.sceneB], [p.sceneB, p.sceneA]] as const) {
        if (!duplicateOf.has(a)) duplicateOf.set(a, []);
        duplicateOf.get(a)!.push(`S${b} ${p.score}`);
      }
    });

  const inRun = new Set<number>((params.distinctiveness?.runs ?? []).flatMap((r) => r.sceneNumbers));

  const stretchedBeats = new Set<number>();
  (params.beatDensity?.beats ?? [])
    .filter((b) => b.stretchScenes > 0)
    .forEach((b) => {
      for (let n = b.sceneStart; n <= b.sceneEnd; n++) stretchedBeats.add(n);
    });

  const lines: string[] = [
    "One row per scene: what was planned, what was produced, and what each layer made of it.",
    "",
    "| # | Planned move (P1) | Progression (P2) | Type | Turns | Words | Speech | Findings |",
    "|---|---|---|---|---|---|---|---|",
  ];

  const short = (s: unknown, n: number) => {
    const text = String(s ?? "").replace(/\|/g, "\|").trim();
    return text.length > n ? `${text.slice(0, n - 1)}…` : text || "—";
  };

  for (const scene of scenes) {
    const n = Number(scene?.sceneNumber) || 0;
    const c = scene?.contract;
    const p = c?.progression;
    const f = feasibilityBy.get(n);

    const progression = p
      ? `${short(p.kind, 12)}: ${short(p.value, 22)} ${short(p.before, 20)} → ${short(p.after, 20)}`
      : "_no contract_";

    const findings: string[] = [];
    (contractIssuesBy.get(n) ?? []).forEach((code) => findings.push(code));
    if (duplicateOf.has(n)) findings.push(`dup ${duplicateOf.get(n)!.slice(0, 2).join(", ")}`);
    if (inRun.has(n)) findings.push("in-run");
    if (stretchedBeats.has(n)) findings.push("stretched-beat");
    // Under-filling is only a fault for a scene that chose to be a talking
    // scene. A silent, reaction, establishing, action, transition or montage
    // shot is SUPPOSED to be sparse, and reporting it teaches exactly the
    // padding this project spent three phases removing.
    const perfType = String(c?.performanceType ?? "").trim().toLowerCase();
    const talkingScene = perfType === "dialogue-scene" || perfType === "comedy-beat";
    if (f?.verdict === "overruns") findings.push("overruns");
    else if (f?.verdict === "underfilled" && talkingScene) findings.push("underfilled");

    lines.push(
      `| ${n} | ${short(plannedMove.get(n), 46)} | ${progression} | ${short(c?.performanceType, 16)} | ` +
        `${f?.turns ?? "—"} | ${f?.words ?? "—"} | ${f ? `${f.estimatedSpeechSeconds}s` : "—"} | ` +
        `${findings.length > 0 ? findings.join("; ") : "—"} |`
    );
  }

  const planned = scenes.filter((s) => plannedMove.has(Number(s?.sceneNumber) || 0)).length;
  const withContract = scenes.filter((s) => s?.contract?.progression).length;

  lines.push(
    "",
    `**Coverage:** ${planned}/${scenes.length} scenes had a planned move · ` +
      `${withContract}/${scenes.length} produced a contract.`,
    "",
    "_Report only. Nothing here is auto-corrected._"
  );

  return lines.join("\n");
}

/**
 * The Story Quality Gate section.
 *
 * Findings grouped by severity, most severe first, each carrying the
 * measurement that produced it so a person can check the claim rather than
 * trust it.
 *
 * `block` names a severe failure. It never means the story was withheld.
 */
export function buildQualityGateSection(
  report: StoryQualityGateReport | undefined,
  actionDensity?: ActionDensityReport
): string {
  if (!report) return "_Not evaluated._";

  const lines: string[] = [
    `**${report.blocked} blocking** · **${report.repairCandidates.length} repair candidate(s)** · ` +
      `${report.warnings} warning(s) · ${report.infos} note(s)`,
    "",
    `_Report only. "block" means a severe quality failure was detected - the story was still delivered in full, and nothing here was rewritten or repaired._`,
    "",
  ];

  if (report.degraded) {
    lines.push(
      "> **Degraded.** No usable scene contracts, so the contract-honesty checks were SKIPPED rather than passed. Older stories land here.",
      ""
    );
  }

  const ev = report.evidence;
  lines.push(
    "**Evidence available**",
    "",
    `| Layer | Present |`,
    `|---|---|`,
    `| P0 distinctiveness | ${ev.distinctiveness ? "yes" : "—"} |`,
    `| P0 dialogue feasibility | ${ev.feasibility ? "yes" : "—"} |`,
    `| P1 beat density | ${ev.beatDensity ? "yes" : "—"} |`,
    `| P2 scene contracts | ${ev.contracts ? "yes" : "—"} |`,
    `| P3 planned moves | ${ev.plannedMoves ? "yes" : "—"} |`,
    `| P4 action density | ${ev.actionDensity ? "yes" : "—"} |`,
    `| Continuity findings | ${ev.continuity ? "yes" : "—"} |`,
    ""
  );

  if (actionDensity && actionDensity.unclassified.length > 0) {
    lines.push(
      `> **Action density could not classify ${actionDensity.unclassified.length} scene(s).** ` +
        `The staging vocabulary is English; where the action line is written in another language it is reported as unclassified rather than as clean. ` +
        `Scenes: ${actionDensity.unclassified.slice(0, 20).join(", ")}${actionDensity.unclassified.length > 20 ? "…" : ""}`,
      ""
    );
  }

  if (report.continuityNoise > 0) {
    lines.push(
      `_${report.continuityNoise} continuity finding(s) were left with the Continuity Director rather than treated as quality failures. ` +
        `Only joins that are physically unrenderable are promoted here; the validator has known false-positive classes and folding them in would bury the real findings._`,
      ""
    );
  }

  const groups: Array<{ severity: QualitySeverity; label: string }> = [
    { severity: "block", label: "Blocking" },
    { severity: "repair", label: "Repair candidates" },
    { severity: "warn", label: "Warnings" },
    { severity: "info", label: "Notes" },
  ];

  for (const group of groups) {
    const items = report.findings.filter((f) => f.severity === group.severity);
    if (items.length === 0) continue;

    lines.push(`### ${group.label} (${items.length})`, "");
    for (const f of items) {
      const where = f.sceneNumbers.length > 0 ? ` — ${f.sceneNumbers.map((n) => `S${n}`).join(", ")}` : "";
      lines.push(`- **[\`${f.code}\`]** ${f.title}${where}`);
      lines.push(`  - ${f.detail}`);
      lines.push(`  - _${f.suggestedFix}_`);
    }
    lines.push("");
  }

  if (report.findings.length === 0) {
    lines.push("_No findings._", "");
  }

  if (report.repairCandidates.length > 0) {
    lines.push(
      `**Scenes a future repair pass would target:** ${report.repairCandidates.map((n) => `S${n}`).join(", ")}`,
      "",
      "_Repair is P5 and is not built. Listing a scene here changes nothing about the delivered story._"
    );
  }

  return lines.join("\n");
}
