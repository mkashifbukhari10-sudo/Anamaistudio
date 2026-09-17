import crypto from "crypto";

/**
 * Stateless, HMAC-signed session tokens.
 *
 * Deliberately stateless: on Vercel each request may hit a different function
 * instance with its own memory, so an in-process session map would log users
 * out at random as instances recycle. The signature makes the cookie
 * self-verifying, so any instance can validate it without shared storage.
 *
 * The cookie carries only a user id and an expiry - no password material, no
 * personal data. It is signed, not encrypted, so its contents are readable by
 * the client but cannot be altered without the secret.
 *
 * Token format:  v1.<base64url(payload)>.<base64url(hmac)>
 */

export const SESSION_COOKIE = "anam_session";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_HOURS = 12;

interface SessionPayload {
  /** User id. */
  uid: string;
  /** Issued at, epoch seconds. */
  iat: number;
  /** Expires at, epoch seconds. */
  exp: number;
}

let cachedSecret: string | null = null;

/**
 * The signing secret.
 *
 * Missing in production is fatal: falling back to a random secret would mean
 * every deploy and every cold start silently invalidated all sessions, and a
 * predictable fallback would let anyone mint their own cookie. In development
 * an ephemeral secret is generated so the app still runs out of the box.
 */
function sessionSecret(): string {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters. Generate one with: npm run generate-secret");
    }
    cachedSecret = configured;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production. Generate one with: npm run generate-secret");
  }

  cachedSecret = crypto.randomBytes(48).toString("hex");
  console.warn(
    "[Auth] SESSION_SECRET is not set - using a temporary secret for this process. " +
      "Everyone is logged out whenever the server restarts. Set SESSION_SECRET in .env to stop that."
  );
  return cachedSecret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

/** Mint a signed session token for a user. */
export function createSessionToken(userId: string, ttlHours: number = DEFAULT_TTL_HOURS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: userId,
    iat: now,
    exp: now + Math.round(ttlHours * 3600),
  };
  const body = `${TOKEN_VERSION}.${base64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body)}`;
}

/**
 * Validate a token and return its payload, or null.
 *
 * The signature is compared in constant time, and is checked BEFORE the
 * payload is trusted for anything - an attacker must not be able to influence
 * parsing with an unsigned blob.
 */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [version, encodedPayload, signature] = parts;
  if (version !== TOKEN_VERSION) return null;

  const expected = sign(`${version}.${encodedPayload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload?.uid || typeof payload.exp !== "number") return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}

/**
 * Cookie attributes.
 *
 * httpOnly keeps the token away from any script on the page, so an XSS bug
 * cannot read it. sameSite=lax blocks it from riding along on cross-site
 * requests, which is what stops CSRF here. secure is on in production; it is
 * off locally because http://localhost would otherwise drop the cookie.
 */
export function sessionCookieOptions(maxAgeHours: number = DEFAULT_TTL_HOURS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.round(maxAgeHours * 3600 * 1000),
  };
}

/**
 * Read cookies off the raw header.
 *
 * Express does not parse cookies without cookie-parser, and one small reader
 * is cheaper than another dependency in the serverless bundle.
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  for (const segment of cookieHeader.split(";")) {
    const index = segment.indexOf("=");
    if (index < 1) continue;
    const name = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** Test seam: forget the memoised secret so a changed env var is re-read. */
export function resetSessionSecretCache(): void {
  cachedSecret = null;
}
