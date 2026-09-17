import fs from "fs";
import path from "path";
import type { AICallRecord } from "../ai/telemetry.js";
import { summariseCalls } from "../ai/telemetry.js";

/**
 * Manual-test story reports.
 *
 * Writes one self-contained Markdown file per generation so a story produced
 * from the UI can be audited afterwards without re-running it: the full
 * blueprint, cast, social and world facts, every scene, both validator reports,
 * and the per-call provider telemetry.
 *
 * DEVELOPMENT ONLY.
 *   - never runs in production, and never on a read-only serverless filesystem
 *   - writes into a git-ignored directory
 *   - records no credentials: telemetry carries call metadata and token counts,
 *     never prompts, responses or keys
 *   - every failure is swallowed. A report is a convenience; it must never be
 *     able to break or slow a generation.
 *
 * Partial failures are reported too - a run that died at scene 7 still produces
 * a file containing everything up to that point plus the exact error.
 */

const OUTPUT_DIR = process.env.STORY_REPORT_DIR || "test-output";

/** Reports are a local dev aid; serverless filesystems are read-only anyway. */
export function reportsEnabled(): boolean {
  if (process.env.STORY_REPORTS === "off") return false;
  if (process.env.VERCEL) return false;
  return process.env.NODE_ENV !== "production";
}

function fence(value: unknown, lang = "json"): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return `\`\`\`${lang}\n${text ?? "null"}\n\`\`\``;
}

function section(title: string, body: string): string {
  return `\n## ${title}\n\n${body}\n`;
}

function orNone(value: unknown, render: () => string): string {
  if (value === undefined || value === null) return "_Not generated._";
  if (Array.isArray(value) && value.length === 0) return "_None._";
  return render();
}

function telemetryTable(records: AICallRecord[]): string {
  if (records.length === 0) return "_No provider calls recorded._";

  const header =
    "| # | Context | Model | max_tokens | prompt | completion | reasoning | cached | finish | latency | outcome |\n" +
    "|---|---|---|---|---|---|---|---|---|---|---|";

  const rows = records.map((r, i) =>
    `| ${i + 1} | ${r.context} | ${r.model} | ${r.maxTokensRequested ?? "-"} | ${r.promptTokens ?? "-"} | ` +
    `${r.completionTokens ?? "-"} | ${r.reasoningTokens ?? "-"} | ${r.cachedPromptTokens ?? "-"} | ` +
    `${r.finishReason ?? "-"} | ${r.latencyMs}ms | ${r.outcome === "success" ? "ok" : "**ERROR**"} |`
  );

  const errors = records
    .filter((r) => r.outcome === "error")
    .map((r, i) => `${i + 1}. **${r.context}** (${r.model}): ${r.error}`);

  return [
    header,
    ...rows,
    "",
    errors.length > 0 ? `**Failed calls:**\n\n${errors.join("\n")}` : "_No failed calls._",
  ].join("\n");
}

function sceneBlock(scene: any): string {
  const parts: string[] = [];
  parts.push(`### Scene ${scene?.sceneNumber} — ${scene?.timeRange ?? "?"} [${scene?.transitionType ?? "?"}]`);
  parts.push(`**Purpose:** ${scene?.purpose ?? "-"}`);
  parts.push(`**Story function:** ${scene?.storyFunction ?? "-"}`);
  if (scene?.setupOrPayoff) parts.push(`**Setup/Payoff:** ${scene.setupOrPayoff}`);
  parts.push(`**Characters present:** ${(scene?.charactersPresent ?? []).join(", ") || "-"}`);
  parts.push(`**Action:** ${scene?.characterActions ?? "-"}`);

  const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
  parts.push(
    `**Dialogue:**\n${
      turns.length === 0
        ? "_(none — visual scene)_"
        : turns.map((t: any) => `- **${t.speaker}:** "${t.line}"`).join("\n")
    }`
  );

  parts.push(`**Start state:** ${scene?.startState ?? "-"}`);
  parts.push(`**End state:** ${scene?.endState ?? "-"}`);
  parts.push(`**Next handoff:** ${scene?.nextSceneHandoff ?? "-"}`);

  const cs = scene?.continuityState;
  parts.push(`**placeId:** \`${cs?.placeId ?? "(none)"}\` · **location:** ${cs?.location ?? "-"} · **time:** ${cs?.timeOfDay ?? "-"} · **lighting:** ${cs?.lighting ?? "-"}`);

  if (scene?.openingState) {
    parts.push(`**Opening state (CHAIN — inherited from previous end):**\n${fence(scene.openingState)}`);
  }
  if (cs) parts.push(`**continuityState (final frame):**\n${fence(cs)}`);

  const dispositions = cs?.propDispositions ?? [];
  if (dispositions.length > 0) {
    parts.push(`**Prop dispositions:**\n${dispositions.map((d: any) => `- ${d.prop} → ${d.disposition} (${d.detail})`).join("\n")}`);
  }

  const changes = scene?.socialChanges ?? [];
  if (changes.length > 0) {
    parts.push(`**Social changes:**\n${changes.map((c: any) => `- ${c.characterA} / ${c.characterB} — ${c.dimension}: ${c.change}`).join("\n")}`);
  }

  if (scene?.frameHandoff) parts.push(`**Frame handoff:** ${scene.frameHandoff.type} — ${scene.frameHandoff.instruction}`);
  if (scene?.finalVideoPrompt) parts.push(`**Flow/Veo prompt:**\n${fence(scene.finalVideoPrompt, "text")}`);
  if (scene?.negativePrompt) parts.push(`**Negative prompt:**\n${fence(scene.negativePrompt, "text")}`);

  const issues = scene?.continuityIssues ?? [];
  if (issues.length > 0) {
    parts.push(`**Continuity findings:**\n${issues.map((i: any) => `- [${i.severity}] ${i.dimension}: ${i.title}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

export interface StoryReportInput {
  generationId: string;
  request: Record<string, unknown>;
  provider: string;
  model: string;
  status: "complete" | "partial" | "failed";
  elapsedMs: number;
  story?: any;
  blueprint?: any;
  telemetry: AICallRecord[];
  failure?: { message: string; stack?: string };
}

/** Render the full Markdown report. */
export function buildStoryReport(input: StoryReportInput): string {
  const { story, blueprint } = input;
  const totals = summariseCalls(input.telemetry);
  const scenes: any[] = Array.isArray(story?.scenes) ? story.scenes : [];
  const requested = Number((input.request as any)?.characterCount);

  const out: string[] = [];

  out.push(`# AnamStudio test report — ${story?.title ?? "(untitled)"}`);
  out.push(
    [
      `- **Generation ID:** \`${input.generationId}\``,
      `- **Timestamp:** ${new Date().toISOString()}`,
      `- **Status:** ${input.status.toUpperCase()}`,
      `- **Provider / model:** ${input.provider} / ${input.model}`,
      `- **Total time:** ${(input.elapsedMs / 1000).toFixed(1)}s`,
      `- **Topic:** ${(input.request as any)?.topic ?? "-"}`,
      `- **Duration:** ${(input.request as any)?.duration ?? "-"} · **Language:** ${(input.request as any)?.language ?? "-"} · **Mode:** ${(input.request as any)?.storyMode ?? "-"} · **Style:** ${(input.request as any)?.animationStyle ?? "-"}`,
      `- **Character count:** requested ${Number.isFinite(requested) ? requested : "Auto"} → actual ${story?.characters?.length ?? 0}`,
      `- **Scenes:** ${scenes.length} / ${story?.sceneGeneration?.targetSceneCount ?? "?"}`,
      `- **Provider calls:** ${totals.calls} (${totals.succeeded} ok, ${totals.failed} failed)`,
      `- **Tokens:** prompt ${totals.promptTokens} · completion ${totals.completionTokens} · reasoning ${totals.reasoningTokens}`,
    ].join("\n")
  );

  if (input.failure) {
    out.push(section("FAILURE", `**${input.failure.message}**\n\n${input.failure.stack ? fence(input.failure.stack, "text") : ""}`));
  }

  out.push(section("Provider telemetry", telemetryTable(input.telemetry)));

  out.push(section("Scene generation report", orNone(story?.sceneGeneration, () => fence(story.sceneGeneration))));
  out.push(section("Fact report", orNone(story?.factReport, () => fence(story.factReport))));
  out.push(section("Continuity report", orNone(story?.continuityReport, () => fence(story.continuityReport))));
  out.push(section("Social plan report", orNone(story?.socialPlanReport, () => fence(story.socialPlanReport))));
  out.push(section("Story quality report", orNone(story?.storyQuality, () => fence(story.storyQuality))));

  out.push(section("Narrative blueprint", orNone(blueprint, () => fence(blueprint))));
  out.push(section("Social graph", orNone(story?.socialGraph, () => fence(story.socialGraph))));
  out.push(section("World registry", orNone(story?.worldRegistry, () => fence(story.worldRegistry))));

  out.push(
    section(
      "Setups / payoffs",
      orNone(blueprint?.setups, () =>
        (blueprint.setups as any[])
          .map((s) => `- **${s.element}** (${s.type}) — plant S${s.plantScene} → payoff S${s.payoffScene}. _${s.meaning}_`)
          .join("\n")
      )
    )
  );

  out.push(
    section(
      "Relationship changes emitted",
      orNone(scenes, () => {
        const deltas = scenes.flatMap((sc) =>
          (sc?.socialChanges ?? []).map((c: any) => `- S${sc.sceneNumber}: ${c.characterA} / ${c.characterB} — ${c.dimension}: ${c.change}`)
        );
        return deltas.length > 0 ? deltas.join("\n") : "_None emitted._";
      })
    )
  );

  out.push(section("Character bible", orNone(story?.characters, () => fence(story.characters))));
  out.push(section("Character reference prompts", orNone(story?.characterReferences, () => fence(story.characterReferences))));

  out.push(section("Full story text", orNone(story?.fullStoryText, () => fence(story.fullStoryText, "text"))));
  out.push(section("Chapters", orNone(story?.chapters, () => fence(story.chapters))));
  out.push(section("Moral (metadata, not spoken)", orNone(story?.moral, () => `> ${story.moral}`)));

  out.push(
    section(
      "Scenes",
      scenes.length === 0 ? "_No scenes generated._" : scenes.map(sceneBlock).join("\n\n---\n\n")
    )
  );

  out.push(`\n---\n\n_Development test report. Contains no credentials._\n`);

  return out.join("\n");
}

/**
 * Write the report. Returns the path, or null when disabled or on any failure.
 *
 * Swallows everything: a report is never worth failing a generation over.
 */
export function saveStoryReport(input: StoryReportInput): string | null {
  if (!reportsEnabled()) return null;

  try {
    const dir = path.resolve(process.cwd(), OUTPUT_DIR);
    fs.mkdirSync(dir, { recursive: true });

    const safeTitle = String(input.story?.title ?? "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "untitled";

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `${stamp}__${input.status}__${safeTitle}.md`);

    fs.writeFileSync(file, buildStoryReport(input), "utf8");
    return file;
  } catch (err: any) {
    console.warn(`[Report] Could not write test report: ${err?.message || err}`);
    return null;
  }
}
