/**
 * Error classification shared by every provider adapter and by the failover
 * logic in AIProviderManager.
 *
 * The single question this file answers: "is it worth asking a DIFFERENT
 * provider the same question?"
 *
 *   recoverable  -> the request was fine, this backend could not serve it
 *                   (rate limit, quota, timeout, outage, bad/absent model)
 *   terminal     -> the request itself is the problem, or the deployment is
 *                   misconfigured; another provider would fail the same way
 *                   (malformed request, safety block, context overflow, auth)
 */

export type AIErrorKind =
  | 'rate_limit'
  | 'quota'
  | 'timeout'
  | 'unavailable'
  | 'provider_error'
  | 'invalid_request'
  | 'auth'
  | 'unknown';

/** Kinds that justify trying the next provider. */
const RECOVERABLE_KINDS: ReadonlySet<AIErrorKind> = new Set<AIErrorKind>([
  'rate_limit',
  'quota',
  'timeout',
  'unavailable',
  'provider_error',
]);

export interface AIErrorClassification {
  kind: AIErrorKind;
  recoverable: boolean;
  status?: number;
  message: string;
}

/** Attach to a thrown Error to state its kind explicitly and skip heuristics. */
export interface AIKindedError extends Error {
  aiErrorKind?: AIErrorKind;
  status?: number;
}

/** Tag an error with an explicit kind without altering its message. */
export function tagError<T extends Error>(error: T, kind: AIErrorKind, status?: number): T {
  return Object.assign(error, { aiErrorKind: kind, status });
}

function readStatus(err: any): number | undefined {
  const candidates = [
    err?.status,
    err?.statusCode,
    err?.code,
    err?.error?.code,
    err?.error?.status,
    err?.response?.status,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && value >= 100 && value <= 599) {
      return value;
    }
  }
  return undefined;
}

function kindFromStatus(status: number): AIErrorKind | null {
  if (status === 429) return 'rate_limit';
  if (status === 408) return 'timeout';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';            // balance exhausted (CodeCraft 402)
  if (status === 404) return 'provider_error';   // unknown/retired model
  if (status === 400 || status === 413 || status === 422) return 'invalid_request';
  if (status >= 500) return 'unavailable';
  return null;
}

function kindFromMessage(message: string): AIErrorKind {
  const m = message.toLowerCase();

  // Terminal first: these must never trigger a failover.
  if (
    m.includes('environment variable is missing') ||
    m.includes('api key not valid') ||
    m.includes('invalid api key') ||
    m.includes('invalid_api_key') ||
    m.includes('unauthorized') ||
    m.includes('permission_denied') ||
    m.includes('insufficient_scope') ||
    m.includes('permission denied')
  ) {
    return 'auth';
  }
  if (
    m.includes('invalid_argument') ||
    m.includes('invalid_request_error') ||
    m.includes('context_length_exceeded') ||
    m.includes('context length') ||
    m.includes('safety') ||
    m.includes('blocked') ||
    m.includes('content policy') ||
    m.includes('content_filter')
  ) {
    return 'invalid_request';
  }

  // Recoverable.
  if (m.includes('timed out') || m.includes('timeout') || m.includes('etimedout') || m.includes('aborted')) {
    return 'timeout';
  }
  if (m.includes('429') || m.includes('rate limit') || m.includes('rate_limit')) {
    return 'rate_limit';
  }
  if (
    m.includes('quota') ||
    m.includes('resource_exhausted') ||
    m.includes('insufficient_quota') ||
    m.includes('billing') ||
    m.includes('balance')
  ) {
    return 'quota';
  }
  if (
    m.includes('503') ||
    m.includes('502') ||
    m.includes('504') ||
    m.includes('unavailable') ||
    m.includes('high demand') ||
    m.includes('overloaded') ||
    m.includes('econnreset') ||
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('socket hang up') ||
    m.includes('fetch failed') ||
    m.includes('network')
  ) {
    return 'unavailable';
  }
  if (m.includes('model') && (m.includes('not found') || m.includes('does not exist') || m.includes('decommissioned'))) {
    return 'provider_error';
  }

  return 'unknown';
}

/**
 * Classify a thrown value. Precedence: explicit tag, then HTTP status, then
 * message heuristics. Unrecognised errors are 'unknown' and NOT recoverable -
 * failing over on a mystery would mask real bugs and double the spend.
 */
export function classifyError(err: any): AIErrorClassification {
  const message = err?.message || String(err);
  const status = readStatus(err);

  const tagged: AIErrorKind | undefined = err?.aiErrorKind;
  if (tagged) {
    return { kind: tagged, recoverable: RECOVERABLE_KINDS.has(tagged), status, message };
  }

  if (status !== undefined) {
    const kind = kindFromStatus(status);
    if (kind) {
      return { kind, recoverable: RECOVERABLE_KINDS.has(kind), status, message };
    }
  }

  const kind = kindFromMessage(message);
  return { kind, recoverable: RECOVERABLE_KINDS.has(kind), status, message };
}

export interface AIProviderAttempt {
  provider: string;
  kind: AIErrorKind;
  recoverable: boolean;
  message: string;
}

/**
 * Raised only when MORE THAN ONE provider was tried and all of them failed.
 * A single-provider failure rethrows the original error untouched, so
 * single-provider deployments keep their existing error messages verbatim.
 */
export class AllProvidersFailedError extends Error {
  readonly attempts: AIProviderAttempt[];

  constructor(attempts: AIProviderAttempt[]) {
    const detail = attempts.map((a) => `${a.provider} (${a.kind}): ${a.message}`).join(' | ');
    super(`All AI providers failed. ${detail}`);
    this.name = 'AllProvidersFailedError';
    this.attempts = attempts;
  }
}
