import type { Express, NextFunction, Request, Response } from "express";
import { dummyVerify, verifyPassword } from "./password.js";
import { findUserById, findUserByUsername, usingPlaceholderCredentials, type AppUser } from "./users.js";
import {
  SESSION_COOKIE,
  createSessionToken,
  parseCookies,
  sessionCookieOptions,
  verifySessionToken,
} from "./session.js";

export { hashPassword, verifyPassword } from "./password.js";
export { SESSION_COOKIE } from "./session.js";
export type { AppUser } from "./users.js";

/** What the browser is allowed to know about the signed-in account. */
interface PublicUser {
  id: string;
  username: string;
  displayName: string;
}

/** Never let the password hash reach a response body. */
function toPublicUser(user: AppUser): PublicUser {
  return { id: user.id, username: user.username, displayName: user.displayName };
}

/** Endpoints reachable without a session. Everything else under /api requires one. */
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/me"]);

// ---------------------------------------------------------------------------
// Login throttling
//
// Bounded in-memory counter. On a single Node host this stops password
// guessing outright. On Vercel each function instance keeps its own counter,
// so it slows an attacker rather than stopping them - real rate limiting there
// needs shared storage, which this app deliberately does not have yet.
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

const attempts = new Map<string, { count: number; firstAt: number }>();

function throttleKey(req: Request, username: string): string {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  return `${ip}::${username.toLowerCase()}`;
}

function isLockedOut(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    // Cheap bound on memory: drop the oldest window when the map grows large,
    // so a flood of distinct usernames cannot exhaust the process.
    if (attempts.size >= MAX_TRACKED_KEYS) {
      const oldest = [...attempts.entries()].sort((a, b) => a[1].firstAt - b[1].firstAt)[0];
      if (oldest) attempts.delete(oldest[0]);
    }
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }

  entry.count += 1;
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

// ---------------------------------------------------------------------------
// Request authentication
// ---------------------------------------------------------------------------

/** Resolve the signed-in user for a request, or null. */
function currentUser(req: Request): AppUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const payload = verifySessionToken(cookies[SESSION_COOKIE]);
  if (!payload) return null;
  return findUserById(payload.uid) ?? null;
}

/**
 * Gate every /api route that is not explicitly public.
 *
 * Applied as a single app-level middleware rather than per-route, so a new
 * endpoint is protected by default. Forgetting to add a guard should not be
 * what exposes the API.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const path = req.path.replace(/\/+$/, "") || req.path;

  if (!path.startsWith("/api/") || PUBLIC_API_PATHS.has(path)) {
    next();
    return;
  }

  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required.", authenticated: false });
    return;
  }

  (req as Request & { user?: PublicUser }).user = toPublicUser(user);
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerAuthRoutes(app: Express): void {
  if (usingPlaceholderCredentials()) {
    console.warn(
      "[Auth] The placeholder 'admin' account is active. Replace its hash in " +
        "src/server/auth/users.ts (npm run hash-password -- \"your password\") or set APP_USERS before deploying."
    );
  }

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const key = throttleKey(req, username);
    if (isLockedOut(key)) {
      return res.status(429).json({
        error: "Too many failed sign-in attempts. Please wait 15 minutes and try again.",
      });
    }

    const user = findUserByUsername(username);

    // Spend the same work whether or not the username exists, so response time
    // does not reveal which usernames are real.
    const ok = user ? verifyPassword(password, user.passwordHash) : (dummyVerify(), false);

    if (!user || !ok) {
      recordFailure(key);
      // One message for both cases - naming which half was wrong hands an
      // attacker a free username oracle.
      return res.status(401).json({ error: "Incorrect username or password." });
    }

    clearFailures(key);
    res.cookie(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
    return res.json({ success: true, authenticated: true, user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
    return res.json({ success: true, authenticated: false });
  });

  /**
   * Session probe for app start-up. Always 200, so the frontend can ask "am I
   * signed in?" without a failed request appearing in the console on a normal
   * first visit.
   */
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const user = currentUser(req);
    return res.json(
      user ? { authenticated: true, user: toPublicUser(user) } : { authenticated: false, user: null }
    );
  });
}
