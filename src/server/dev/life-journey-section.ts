import type { LifeJourney, LifeJourneyReport, StoryScope } from "../../types.js";

/**
 * The life-journey section of a manual-test report.
 *
 * Kept in its own module because it is the densest formatting in the report and
 * story-report.ts is already long. Pure rendering: it reads a finished story
 * and returns Markdown, changes nothing, and throws nothing - a report must
 * never be able to affect a generation.
 *
 * Phases and time jumps are exactly what a person opens a long-form report to
 * check, so they get a readable table rather than only appearing as JSON inside
 * the blueprint dump.
 */

function phaseTable(journey: LifeJourney): string {
  const rows = journey.phases.map((p) => {
    const jump = p.entryJump ? `${p.entryJump.span} (${p.entryJump.magnitude})` : "_opens the film_";
    return `| ${p.phaseNumber} | ${p.title} | ${p.sceneStart}-${p.sceneEnd} | ${(p.chapterNumbers ?? []).join(", ")} | ${jump} |`;
  });

  return ["| Phase | Title | Scenes | Chapters | Entry jump |", "|---|---|---|---|---|", ...rows].join("\n");
}

function jumpList(journey: LifeJourney): string {
  if (journey.timeJumps.length === 0) return "_No time jumps._";

  return journey.timeJumps
    .map((j) => {
      const shown = j.screenTreatment || "**NOT SHOWN ON SCREEN**";
      const changed = (j.whatChanged ?? []).join("; ") || "_nothing stated_";
      return `- **After scene ${j.afterScene}** — ${j.span} (${j.magnitude})\n  - shown as: ${shown}\n  - changed: ${changed}`;
    })
    .join("\n");
}

function lifeStatePerPhase(journey: LifeJourney): string {
  return journey.phases
    .map((p) => {
      const chars = (p.characterStates ?? []).map((c) => {
        const work = c.occupation ? `, ${c.occupation}` : "";
        const duties = c.responsibilities?.length
          ? ` (responsible for: ${c.responsibilities.join("; ")})`
          : "";
        return `  - ${c.characterId}: ${c.lifeStage}${work}${duties}`;
      });

      const houses = (p.householdStates ?? []).map((h) => {
        const pressures = h.pressures?.length ? ` | under: ${h.pressures.join("; ")}` : "";
        const owns = h.possessions?.length ? ` | owns: ${h.possessions.join("; ")}` : "";
        return `  - ${h.householdId}: ${h.livelihood || "livelihood not stated"}${owns}${pressures}`;
      });

      const body = [...chars, ...houses];
      return `**Phase ${p.phaseNumber} — ${p.title}**\n${body.length > 0 ? body.join("\n") : "  - _nothing recorded_"}`;
    })
    .join("\n\n");
}

function aspirationList(journey: LifeJourney): string {
  if (journey.aspirations.length === 0) return "_No aspirations planned._";

  return journey.aspirations
    .map(
      (a) =>
        `- **${a.characterId}** — ${a.goal} → **${a.outcome}** at phase ${a.resolvesAtPhase}\n` +
        `  - why: ${a.whyItMatters || "-"}\n  - costs others: ${a.costToOthers || "-"}`
    )
    .join("\n");
}

function milestoneList(journey: LifeJourney, unearned: number[]): string {
  if (journey.milestones.length === 0) return "_No milestones planned._";

  return journey.milestones
    .map((m) => {
      const proven = (m.provingSceneNumbers ?? []).map((n) => `S${n}`).join(", ") || "**NOTHING**";
      const flag = unearned.includes(m.atScene) ? " — **UNEARNED**" : "";
      return `- S${m.atScene} **${m.kind}**${flag}: ${m.description}\n  - proven by: ${proven}\n  - cost: ${m.cost || "_none stated_"}`;
    })
    .join("\n");
}

function routineList(journey: LifeJourney): string {
  if (journey.routines.length === 0) return "_No routines recorded._";

  return journey.routines
    .map(
      (r) =>
        `- **${r.activity}** (phases ${(r.phaseNumbers ?? []).join(", ") || "-"}) — varies: ${
          r.variationAcrossStory || "**NO VARIATION DECLARED**"
        }`
    )
    .join("\n");
}

function findings(report: LifeJourneyReport | undefined): string {
  if (!report || report.issues.length === 0) return "_No findings._";

  return report.issues
    .map((i) => {
      const where = i.sceneNumber ? ` (S${i.sceneNumber})` : i.phaseNumber ? ` (phase ${i.phaseNumber})` : "";
      return `- [${i.severity}] **${i.title}**${where} — ${i.detail} _${i.suggestedFix}_`;
    })
    .join("\n");
}

/**
 * Render the section body.
 *
 * A story with no journey still produces output, so the report's shape does not
 * depend on which kind of story ran - and any normalisation findings that
 * explain WHY there is no journey are still surfaced.
 */
export function buildLifeJourneySection(params: {
  journey?: LifeJourney | null;
  report?: LifeJourneyReport | null;
  scope?: StoryScope;
}): string {
  const { journey, report, scope } = params;

  if (!journey) {
    const explanation = report && report.issues.length > 0 ? `\n\n${findings(report)}` : "";
    return `_Single episode — no time jumps planned._ (scope: ${scope ?? "Auto"})${explanation}`;
  }

  return [
    `**Scope:** ${scope ?? "Auto"} — **${journey.phases.length} phases**, ${journey.timeJumps.length} time jump(s)`,
    `**Why this shape:** ${journey.whyThisShape || "_not stated_"}`,
    "",
    `**Opening life:** ${journey.openingLife || "_not stated_"}`,
    `**Closing life:** ${journey.closingLife || "_not stated_"}`,
    "",
    phaseTable(journey),
    "",
    "**Time jumps**",
    "",
    jumpList(journey),
    "",
    "**Life state per phase**",
    "",
    lifeStatePerPhase(journey),
    "",
    "**Aspirations**",
    "",
    aspirationList(journey),
    "",
    "**Milestones** — proving scenes are what make an achievement earned",
    "",
    milestoneList(journey, report?.unearnedMilestones ?? []),
    "",
    "**Routines**",
    "",
    routineList(journey),
    "",
    "**Findings**",
    "",
    findings(report ?? undefined),
  ].join("\n");
}
