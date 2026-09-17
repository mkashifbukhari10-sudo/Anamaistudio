import crypto from "crypto";

/**
 * Password hashing built on Node's own scrypt - no dependency, no native build.
 *
 * scrypt is deliberately slow and memory-hard, so a leaked hash list is
 * expensive to attack offline. Passwords are never stored or logged in plain
 * text anywhere in this codebase; only the hash below ever reaches disk.
 *
 * Stored format (single line, safe to paste into a source file or an env var):
 *
 *   scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 *
 * The parameters travel with the hash, so raising the cost later does not
 * invalidate hashes already issued - old hashes keep verifying with the
 * parameters they were created under.
 */

const SCHEME = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Current cost. Raise N to make hashing (and attacking) more expensive. */
const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** scrypt needs roughly 128 * N * r bytes; give it headroom over the 32MB default. */
function maxmemFor(N: number, r: number): number {
  return Math.max(32 * 1024 * 1024, 256 * N * r);
}

/** Hash a plain-text password into the storable single-line format. */
export function hashPassword(plain: string): string {
  const { N, r, p } = DEFAULT_PARAMS;
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.scryptSync(plain.normalize("NFKC"), salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: maxmemFor(N, r),
  });
  return [SCHEME, N, r, p, salt.toString("hex"), hash.toString("hex")].join("$");
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a typo in the user
 * table must not become a 500 that tells an attacker their guess was special.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== SCHEME) return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = crypto.scryptSync(plain.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: maxmemFor(N, r),
    });

    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Burn roughly one verification's worth of work.
 *
 * Called when no user matches the submitted name. Without it, a missing
 * username would return noticeably faster than a wrong password, which lets an
 * attacker enumerate valid usernames by timing alone.
 */
export function dummyVerify(): void {
  const { N, r, p } = DEFAULT_PARAMS;
  try {
    crypto.scryptSync("dummy-password", crypto.randomBytes(SALT_LENGTH), KEY_LENGTH, {
      N,
      r,
      p,
      maxmem: maxmemFor(N, r),
    });
  } catch {
    // Timing defence only - never allowed to affect the caller.
  }
}
