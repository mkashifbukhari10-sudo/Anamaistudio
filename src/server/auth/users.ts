/**
 * The user list.
 *
 * Accounts live in code, as asked, so adding a user is a source edit and a
 * deploy. Two consequences are worth knowing rather than discovering:
 *
 *   1. Anything committed here is in git history permanently. That is why the
 *      field below is a scrypt HASH, never a plain password - a leaked repo
 *      then costs an attacker an expensive offline crack instead of handing
 *      them working logins.
 *   2. A password cannot be rotated without a commit and a redeploy. For a
 *      small fixed team that is fine; past roughly a dozen users, or if
 *      accounts need to change without a deploy, this should move to a
 *      database.
 *
 * Generate a hash with:   npm run hash-password -- "the password"
 *
 * APP_USERS overrides this list entirely when set (a JSON array of the same
 * shape). Use it in production to keep real credentials out of the repo; the
 * code list then serves as the local-development default.
 */

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  /** scrypt$N$r$p$salt$hash - never a plain-text password. */
  passwordHash: string;
}

/**
 * Accounts compiled into the build.
 *
 * Replace the placeholder hash before deploying. It was generated from the
 * password "change-me-now", so leaving it in place ships a known credential.
 */
const CODE_USERS: AppUser[] = [
  {
    id: "u_admin",
    username: "admin",
    displayName: "Studio Admin",
    passwordHash:
      "scrypt$16384$8$1$51e39c2ea9a9d2cbbca7b679b1c40fd0$0bc0819c0ced0326232c4801bb0652ad2dd9925430562497a23e261031bc77f849c687ae26ba242782e4bd0aa729954903d1c8d7e9e3e744cb3b4c2a10119400",
  },
];

let cachedUsers: AppUser[] | null = null;

/**
 * Parse APP_USERS if present, otherwise fall back to the code list.
 *
 * A malformed APP_USERS throws at startup rather than silently falling back:
 * quietly reverting to a default admin account because of a JSON typo is the
 * kind of failure that goes unnoticed until it is exploited.
 */
function loadUsers(): AppUser[] {
  const raw = process.env.APP_USERS?.trim();
  if (!raw) return CODE_USERS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("APP_USERS is set but is not valid JSON. Expected an array of user objects.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("APP_USERS must be a non-empty JSON array of user objects.");
  }

  return parsed.map((entry: any, index: number) => {
    const { id, username, displayName, passwordHash } = entry || {};
    if (!username || !passwordHash) {
      throw new Error(`APP_USERS[${index}] is missing 'username' or 'passwordHash'.`);
    }
    return {
      id: String(id || `u_${username}`),
      username: String(username),
      displayName: String(displayName || username),
      passwordHash: String(passwordHash),
    };
  });
}

function allUsers(): AppUser[] {
  if (!cachedUsers) cachedUsers = loadUsers();
  return cachedUsers;
}

/** Look up a user by username. Case-insensitive; surrounding space is ignored. */
export function findUserByUsername(username: string): AppUser | undefined {
  const needle = String(username || "").trim().toLowerCase();
  if (!needle) return undefined;
  return allUsers().find((user) => user.username.toLowerCase() === needle);
}

/** Look up a user by id. Used to rehydrate the account behind a session cookie. */
export function findUserById(id: string): AppUser | undefined {
  if (!id) return undefined;
  return allUsers().find((user) => user.id === id);
}

/** True when the shipped placeholder account is still active. */
export function usingPlaceholderCredentials(): boolean {
  return !process.env.APP_USERS?.trim() && CODE_USERS.some((u) => u.id === "u_admin");
}

/** Test seam: drop the memoised list so a changed APP_USERS is re-read. */
export function resetUserCache(): void {
  cachedUsers = null;
}
