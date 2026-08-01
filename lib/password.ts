import crypto from "crypto";

// Password hashing for username accounts. Uses Node's built-in scrypt rather
// than bcrypt/argon2 so signing up doesn't pull in a native dependency — the
// same reasoning behind the dependency-free sessions in lib/session.ts.
//
// Stored format: "scrypt$<salt-hex>$<key-hex>". The algorithm tag is there so a
// future upgrade can re-hash on next successful sign-in without a migration.

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

// Returns false (never throws) for a malformed or missing stored hash, so an
// account with no password — e.g. one provisioned through Google — simply
// fails password sign-in instead of 500ing.
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;

  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  try {
    const expected = Buffer.from(keyHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
    // timingSafeEqual throws on a length mismatch — guard first.
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Usernames are the public handle (shown as @name in search and the feed) and
// the sign-in identifier, so keep the character set tight and unambiguous.
const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!username) return "Pick a username";
  if (username.length < 3) return "Usernames are at least 3 characters";
  if (username.length > 24) return "Usernames are at most 24 characters";
  if (!USERNAME_RE.test(username)) {
    return "Letters, numbers, underscores and periods only";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Pick a password";
  if (password.length < 8) return "Passwords are at least 8 characters";
  if (password.length > 200) return "That password is too long";
  return null;
}
