import crypto from "crypto";

/**
 * Print a SESSION_SECRET for .env.
 *
 *   npm run generate-secret
 *
 * 64 random bytes, well past the 32-character minimum the session module
 * enforces. Anyone holding this value can mint a valid session cookie for any
 * account, so it belongs in .env (git-ignored) or the host's secret store -
 * never in the repo.
 */
console.log("\nAdd this to your .env (never commit it):\n");
console.log(`SESSION_SECRET="${crypto.randomBytes(64).toString("hex")}"`);
console.log("");
