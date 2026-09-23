import type { Server } from "http";

/**
 * HTTP timeouts for long-form story generation.
 *
 * A ten-minute film is sixty scenes: five provider batches plus the blueprint
 * and screenplay, held open inside ONE POST that can run for half an hour or
 * more. Node's HTTP defaults assume ordinary request/response traffic and
 * will
 * close that socket while the work is still in flight. The browser sees the
 * connection drop rather than an HTTP status, so it reports "unable to reach
 * the studio backend server" - after the tokens have already been spent.
 *
 * These are server-side limits only. They do not extend any provider call; the
 * per-attempt ceiling in the DeepSeek provider still bounds a hung model.
 */

/**
 * Generous but finite, so a truly stuck request cannot pin a socket forever.
 *
 * Sized against the worst case: a ten-minute film is five scene batches, and at
 * the provider's 420s per-attempt ceiling that is 35 minutes of batches alone,
 * before the blueprint and screenplay. Kept deliberately above that rather than
 * trimmed to fit, because the failure mode is the worst kind - the socket drops
 * AFTER the tokens have been spent - and a generous ceiling costs nothing on a
 * request that finishes normally.
 */
const LONG_REQUEST_MS = 65 * 60 * 1000;

export function applyLongGenerationTimeouts(server: Server): void {
  // Time to receive the whole request. The body is small and arrives at once,
  // but this has been observed to bound the exchange as a whole, so it is
  // raised rather than relied upon to mean only what it says.
  server.requestTimeout = LONG_REQUEST_MS;

  // Socket inactivity. A generation sends nothing while it thinks, which is
  // exactly what this would otherwise treat as a dead connection.
  server.timeout = LONG_REQUEST_MS;

  // Must stay above the load balancer's idle timeout on a hosted deploy,
  // otherwise the proxy closes a connection this server still considers live.
  server.keepAliveTimeout = 75 * 1000;

  // Node requires this to exceed keepAliveTimeout, or headers can time out on
  // a connection that was legitimately being kept alive.
  server.headersTimeout = 90 * 1000;
}
