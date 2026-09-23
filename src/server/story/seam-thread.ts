/**
 * SEAM THREAD — what is still hanging as one shot ends.
 *
 * story-craft.ts already asks for exactly the right thing:
 *
 *   "CONVERSATION CARRIES ACROSS THE JOIN: a question asked at the end of one
 *    scene can be answered at the start of the next ... Dialogue that continues
 *    over a cut is one of the strongest things making separate ten-second clips
 *    feel like one continuous film."
 *
 * Measured on a real generation, it lands at 3 of 35 joins. Speaker changes
 * across a join happen 15 times in 31 - indistinguishable from chance. The
 * guidance is prose advice to the planner with no structure behind it, so the
 * model reads it and writes self-contained scenes anyway.
 *
 * What the seam carries today is entirely physical: end state, screen positions,
 * held props, lighting, environment. A scene therefore inherits where the bodies
 * are and nothing about what was being ASKED. This module carries the dramatic
 * half of the join.
 *
 * It is deliberately optional. A thread that must exist at every join would turn
 * act breaks and time jumps into cliffhangers, which is its own kind of
 * mechanical writing - so "None" is a first-class answer.
 */

/** Values that mean the scene closed its beat cleanly. */
const NO_THREAD = /^(none|n\/a|-+|nothing|closed|resolved|no thread)\b/i;

/** The thread a scene leaves open, or "" when it closes cleanly. */
export function openThreadOf(scene: any): string {
  const raw = String(scene?.openThread ?? "").trim();
  if (!raw || NO_THREAD.test(raw)) return "";
  return raw.replace(/[\s.]+$/, "");
}

/** True when this scene hands something unfinished to the next one. */
export function hasOpenThread(scene: any): boolean {
  return openThreadOf(scene).length > 0;
}

/**
 * Flattens a continuity map into prose for the prompt.
 *
 * 'characterPositions', 'characterEmotions' and 'heldProps' are per-character
 * maps. They were declared on the previous-scene context type and never
 * populated, so these lines were absent from every prompt the pipeline has ever
 * sent. Accepts a map, an array or a plain string, because normalisation has
 * produced all three shapes over the life of the schema.
 */
export function flattenStateMap(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();

  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : `${(v as any)?.character ?? ""} ${(v as any)?.value ?? ""}`))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .join("; ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([name, state]) => {
        const text = String(state ?? "").trim();
        return text ? `${name}: ${text}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }

  return "";
}

/**
 * The dramatic half of the seam, for the next batch's brief.
 *
 * Returns "" when nothing is open, so a clean act break transmits nothing extra
 * and the next scene is free to start somewhere new.
 */
export function buildThreadBlock(previous: {
  sceneNumber?: number;
  openThread?: string;
  characterEmotions?: string;
}): string {
  const thread = openThreadOf(previous);
  const emotions = String(previous?.characterEmotions ?? "").trim();
  if (!thread && !emotions) return "";

  const lines: string[] = [];
  if (thread) {
    lines.push(
      `- STILL OPEN FROM SCENE #${previous.sceneNumber}: ${thread}.`,
      `  This is unfinished business, not background. Your first scene should ENGAGE it - answer it, refuse it, interrupt it, or let someone change the subject on purpose. Do not restate it as if it were new, and do not quietly drop it.`
    );
  }
  if (emotions) {
    lines.push(
      `- WHAT THE AUDIENCE IS HOLDING: ${emotions}.`,
      `  Feeling carries across a cut. Do not reset anyone to neutral without a reason the audience can see.`
    );
  }

  return lines.join("\n");
}

/**
 * How many adjacent pairs actually carry a thread across the join.
 *
 * Report only, and used by the offline validation harness. Counts a join as
 * carried when the earlier scene left something open - whether the next scene
 * engaged it is a judgement the gate makes, not arithmetic.
 */
export function countThreadedJoins(scenes: any[]): { joins: number; threaded: number } {
  const list = Array.isArray(scenes) ? scenes : [];
  let joins = 0;
  let threaded = 0;

  for (let i = 0; i < list.length - 1; i++) {
    joins++;
    if (hasOpenThread(list[i])) threaded++;
  }

  return { joins, threaded };
}
