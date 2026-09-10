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
  /**
   * Authorization, not authentication: the credential is accepted but this
   * project, plan or scope may not serve the request (Gemini
   * PERMISSION_DENIED, CodeCraft insufficient_scope, a disabled API).
   * Nothing is wrong with the request, so another provider genuinely can
   * serve it - this is recoverable.
   */
  | 'access_denied'
  | 'invalid_request'
  /** Authentication: the credential itself is wrong or absent. Terminal. */
  | 'auth'
  | 'unknown';

/** Kinds that justify trying the next provider. */
const RECOVERABLE_KINDS: ReadonlySet<AIErrorKind> = new Set<AIErrorKind>([
  'rate_limit',
  'quota',
  'timeout',
  'unavailable',
  'provider_error',
  'access_denied',
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

/**
 * A 403 can mean two very different things. Moderation and guardrail blocks
 * are a property of the REQUEST, so they stay terminal - re-submitting
 * flagged content to another provider is not a fix. Everything else at 403 is
 * an entitlement denial against this account.
 */
function isModerationBlock(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('moderation') ||
    m.includes('flagged') ||
    m.includes('guardrail') ||
    m.includes('safety') ||
    m.includes('content policy') ||
    m.includes('content_filter')
  );
}

function kindFromStatus(status: number, message: string): AIErrorKind | null {
  if (status === 429) return 'rate_limit';
  if (status === 408) return 'timeout';
  // 401 is unauthenticated - the credential is wrong or absent. Terminal.
  if (status === 401) return 'auth';
  // 403 is unauthorized - the credential is fine, this account is not.
  if (status === 403) return isModerationBlock(message) ? 'invalid_request' : 'access_denied';
  if (status === 402) return 'quota';            // balance exhausted (CodeCraft 402)
  if (status === 404) return 'provider_error';   // unknown/retired model
  if (status === 400 || status === 413 || status === 422) return 'invalid_request';
  if (status >= 500) return 'unavailable';
  return null;
}

function kindFromMessage(message: string): AIErrorKind {
  const m = message.toLowerCase();

  // AUTHENTICATION - the credential itself is wrong or absent. Terminal:
  // every provider would reject the same deployment mistake, and silently
  // switching providers would hide a configuration error that needs fixing.
  if (
    m.includes('environment variable is missing') ||
    m.includes('api key not valid') ||
    m.includes('invalid api key') ||
    m.includes('invalid_api_key') ||
    m.includes('api key expired') ||
    m.includes('invalid or revoked') ||
    m.includes('authentication_error') ||
    m.includes('unauthorized')
  ) {
    return 'auth';
  }

  // AUTHORIZATION / ENTITLEMENT - the key is accepted, but this project,
  // plan or scope cannot serve the request. The request is fine, so another
  // provider can serve it: recoverable. This is what stops a denied Gemini
  // project from taking the whole failover chain down with it.
  if (
    m.includes('permission_denied') ||
    m.includes('permission denied') ||
    m.includes('denied access') ||
    m.includes('access denied') ||
    m.includes('insufficient_scope') ||
    m.includes('has not been used in project') ||
    m.includes('has not been enabled') ||
    m.includes('is not enabled') ||
    m.includes('consumer_suspended') ||
    m.includes('suspended')
  ) {
    return 'access_denied';
  }
  if (
    m.includes('invalid_argument') ||
    m.includes('invalid_request_error') ||
    m.includes('context_length_exceeded') ||
    m.includes('context length') ||
    m.includes('safety') ||
    m.includes('blocked') ||
    m.includes('content policy') ||
    m.includes('content_filter') ||
    m.includes('moderation') ||
    m.includes('flagged') ||
    m.includes('guardrail')
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

  // A credential problem is unambiguous from its wording and is MORE specific
  // than the status it happens to arrive with - Gemini reports an invalid key
  // as 400 INVALID_ARGUMENT, which would otherwise read as a malformed request.
  // Both are terminal, but the operator needs to see the real cause.
  if (kindFromMessage(message) === 'auth') {
    return { kind: 'auth', recoverable: false, status, message };
  }

  if (status !== undefined) {
    const kind = kindFromStatus(status, message);
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
