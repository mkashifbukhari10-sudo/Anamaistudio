/**
 * Live generation progress.
 *
 * The UI previously showed a timer pretending to be a progress bar: it counted
 * up on its own and froze at 94% regardless of what the server was doing. This
 * replaces that with progress the server actually reports.
 *
 * Kept in memory deliberately. Progress is ephemeral and worthless once a
 * generation ends, so persisting it would be storage for nothing. The known
 * limitation is serverless: a poll may land on a different instance than the
 * one generating, in which case no snapshot is found. The client treats that
 * as "unknown" and falls back to an honest indeterminate state rather than
 * inventing a number - which is the behaviour being fixed in the first place.
 */

export type GenerationPhase =
  | "starting"
  | "blueprint"
  | "screenplay"
  | "scenes"
  | "validating"
  | "complete"
  | "failed";

export interface GenerationProgress {
  generationId: string;
  phase: GenerationPhase;
  label: string;
  detail: string;
  /** 0-100, derived from real milestones. */
  percent: number;
  scenesDone: number;
  scenesTotal: number;
  batchesDone: number;
  batchesTotal: number;
  startedAt: number;
  updatedAt: number;
  error?: string;
}

/**
 * How much of the bar each phase owns.
 *
 * Weighted by observed duration, not by step count: scene generation is by far
 * the longest part of a real run, so it owns most of the bar and moves in
 * proportion to scenes actually produced.
 */
const PHASE_WEIGHTS: Record<GenerationPhase, { start: number; end: number }> = {
  starting: { start: 0, end: 2 },
  blueprint: { start: 2, end: 18 },
  screenplay: { start: 18, end: 32 },
  scenes: { start: 32, end: 92 },
  validating: { start: 92, end: 99 },
  complete: { start: 100, end: 100 },
  failed: { start: 0, end: 0 },
};

const PHASE_LABELS: Record<GenerationPhase, { label: string; detail: string }> = {
  starting: { label: "Preparing", detail: "Setting up the story request..." },
  blueprint: {
    label: "Story architecture",
    detail: "Designing the cast, relationships, world and causal beat structure...",
  },
  screenplay: {
    label: "Screenplay & Character Bible",
    detail: "Writing the story and compiling full character designs...",
  },
  scenes: { label: "Scenes", detail: "Directing the shot-by-shot timeline..." },
  validating: {
    label: "Validation",
    detail: "Checking continuity, facts and the production package...",
  },
  complete: { label: "Complete", detail: "Production package ready." },
  failed: { label: "Failed", detail: "Generation could not be completed." },
};

/** Snapshots are small and short-lived; this bounds memory if one leaks. */
const MAX_TRACKED = 50;
const TTL_MS = 30 * 60 * 1000;

const store = new Map<string, GenerationProgress>();

function prune(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.updatedAt > TTL_MS) store.delete(id);
  }
  while (store.size > MAX_TRACKED) {
    const oldest = [...store.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
    if (!oldest) break;
    store.delete(oldest[0]);
  }
}

export function startProgress(generationId: string, scenesTotal: number): void {
  if (!generationId) return;
  prune();
  const now = Date.now();
  store.set(generationId, {
    generationId,
    phase: "starting",
    ...PHASE_LABELS.starting,
    percent: 0,
    scenesDone: 0,
    scenesTotal,
    batchesDone: 0,
    batchesTotal: 0,
    startedAt: now,
    updatedAt: now,
  });
}

/**
 * Move to a phase, optionally with progress inside it.
 *
 * `fraction` is how far through the phase we are (0-1) and only matters for
 * scene generation, where real counts exist. Everything else reports the start
 * of its band, so the bar never claims progress that has not happened.
 */
export function setPhase(
  generationId: string,
  phase: GenerationPhase,
  patch: Partial<Pick<GenerationProgress, "scenesDone" | "batchesDone" | "batchesTotal" | "error">> = {},
  fraction = 0
): void {
  if (!generationId) return;
  const entry = store.get(generationId);
  if (!entry) return;

  const band = PHASE_WEIGHTS[phase];
  const within = Math.max(0, Math.min(1, fraction));
  const percent = Math.round(band.start + (band.end - band.start) * within);

  const next: GenerationProgress = {
    ...entry,
    ...patch,
    phase,
    ...PHASE_LABELS[phase],
    // Never go backwards: a retry or a split must not make the bar retreat.
    percent: Math.max(entry.percent, percent),
    updatedAt: Date.now(),
  };

  if (phase === "scenes" && next.scenesTotal > 0) {
    next.detail = `Directing scene ${Math.min(next.scenesDone + 1, next.scenesTotal)} of ${next.scenesTotal}...`;
  }
  if (phase === "failed") next.percent = entry.percent;

  store.set(generationId, next);
}

/** Report scene progress, which is the only genuinely measurable part. */
export function setSceneProgress(generationId: string, scenesDone: number, batchesDone: number, batchesTotal: number): void {
  const entry = store.get(generationId);
  if (!entry) return;
  const fraction = entry.scenesTotal > 0 ? scenesDone / entry.scenesTotal : 0;
  setPhase(generationId, "scenes", { scenesDone, batchesDone, batchesTotal }, fraction);
}

export function getProgress(generationId: string): GenerationProgress | undefined {
  return store.get(generationId);
}

/** Keep the terminal state briefly so the client can observe it, then expire. */
export function finishProgress(generationId: string, status: "complete" | "failed", error?: string): void {
  if (!generationId) return;
  setPhase(generationId, status, error ? { error } : {}, 1);
  const entry = store.get(generationId);
  if (entry && status === "complete") store.set(generationId, { ...entry, percent: 100 });
}
