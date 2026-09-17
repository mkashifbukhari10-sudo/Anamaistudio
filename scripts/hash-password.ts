import { hashPassword } from "../src/server/auth/password.js";

/**
 * Turn a plain password into the hash that goes in src/server/auth/users.ts.
 *
 *   npm run hash-password -- "the password"
 *
 * Take the password from argv rather than prompting: this runs in the same
 * terminal the developer already has open, and a prompt would need a TTY that
 * CI and most editor terminals do not reliably provide.
 *
 * Note the password will sit in shell history. On a shared machine, clear it
 * afterwards (`history -d`) or export it and pass "$VAR".
 */
const password = process.argv.slice(2).join(" ");

if (!password) {
  console.error('Usage: npm run hash-password -- "your password here"');
  process.exit(1);
}

if (password.length < 10) {
  console.error(`Refusing to hash a ${password.length}-character password.`);
  console.error("Use at least 10 characters - these accounts cannot be rotated without a redeploy.");
  process.exit(1);
}

console.log("\nPaste this into the user's passwordHash field:\n");
console.log(hashPassword(password));
console.log("");
