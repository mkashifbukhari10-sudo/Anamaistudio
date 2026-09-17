/**
 * Per-generation AI call telemetry.
 *
 * Development instrumentation for manual testing: it records what each
 * provider call actually cost and how it finished, so a saved test report can
 * be audited afterwards without guessing.
 *
 * Deliberately passive. Nothing here affects generation: recording is
 * best-effort, every entry point swallows its own errors, and when no capture
 * is active every function is a no-op. A telemetry bug must never be able to
 * break a story.
 *
 * SERVER ONLY. Never records prompts, responses or credentials - only call
 * metadata and token counts.
 */

export interface AICallRecord {
  /** What the call was for, e.g. "blueprint" or "scenes 13-24". */
  context: string;
  provider: string;
  model: string;
  maxTokensRequested?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** Reasoning models bill these inside completionTokens. */
  reasoningTokens?: number;
  cachedPromptTokens?: number;
  finishReason?: string;
  latencyMs: number;
  outcome: "success" | "error";
  error?: string;
  at: string;
}

let active: AICallRecord[] | null = null;
let currentContext = "unattributed";

/** Begin collecting. Any previous capture is discarded. */
export function startCapture(): void {
  active = [];
  currentContext = "unattributed";
}

/** Label the calls that follow, e.g. "blueprint", "scenes 1-12". */
export function setCallContext(context: string): void {
  currentContext = context || "unattributed";
}

/** Stop collecting and return what was gathered. */
export function endCapture(): AICallRecord[] {
  const records = active ?? [];
  active = null;
  currentContext = "unattributed";
  return records;
}

/** Records so far without ending the capture, for partial-failure reports. */
export function peekCapture(): AICallRecord[] {
  return active ? [...active] : [];
}

/**
 * Record one provider call.
 *
 * Called from inside the provider on both the success and failure paths, so a
 * report shows the attempts that failed as well as the one that worked.
 */
export function recordCall(record: Omit<AICallRecord, "context" | "at">): void {
  if (!active) return;
  try {
    active.push({ ...record, context: currentContext, at: new Date().toISOString() });
  } catch {
    // Telemetry must never interrupt generation.
  }
}

/** Totals for the report header. */
export function summariseCalls(records: AICallRecord[]): {
  calls: number;
  succeeded: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalLatencyMs: number;
} {
  const sum = (pick: (r: AICallRecord) => number | undefined) =>
    records.reduce((total, r) => total + (pick(r) || 0), 0);

  return {
    calls: records.length,
    succeeded: records.filter((r) => r.outcome === "success").length,
    failed: records.filter((r) => r.outcome === "error").length,
    promptTokens: sum((r) => r.promptTokens),
    completionTokens: sum((r) => r.completionTokens),
    reasoningTokens: sum((r) => r.reasoningTokens),
    totalLatencyMs: sum((r) => r.latencyMs),
  };
}
