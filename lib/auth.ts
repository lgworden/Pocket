import { redirect } from "next/navigation";
import pool from "./db";
import { readSessionUserId } from "./session";

// Multi-user: the current user is resolved per-request from the signed session
// cookie. NEVER cache the id at module scope — a module-level singleton is shared
// across every request in the process and would leak one person's identity to
// everyone else.

// Nullable read — use when "not logged in" is a valid state to handle yourself.
export async function getSessionUserId(): Promise<string | null> {
  return readSessionUserId();
}

// Page/route guard: returns the logged-in user id, or bounces to /login.
export async function getCurrentUserId(): Promise<string> {
  const id = readSessionUserId();
  if (!id) redirect("/login");
  return id;
}

export async function getCurrentUser() {
  const id = await getCurrentUserId();
  const { rows } = await pool.query(
    "SELECT id, name, email, username, display_name, bio, avatar, location, home_address, style_profile, scheduling_preferences, notification_preferences, onboarding_completed, walkthrough_completed FROM users WHERE id = $1",
    [id]
  );
  if (rows.length === 0) {
    // Session points at a user that no longer exists (deleted/reset DB).
    redirect("/login");
  }
  return rows[0];
}

// Sign-in provisioning: find the user for this verified Google email, or create
// one. Email is the identity key; a unique index on lower(email) (migration 010)
// guards against duplicate accounts under a race.
export async function findOrCreateUserByEmail(profile: {
  email: string;
  name?: string;
}): Promise<string> {
  const email = profile.email.trim().toLowerCase();
  const existing = await pool.query("SELECT id FROM users WHERE lower(email) = $1", [
    email,
  ]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const displayName = profile.name?.trim() || email.split("@")[0];
  const { rows } = await pool.query(
    `INSERT INTO users (name, email) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [displayName, email]
  );
  return rows[0].id;
}

// Username/password sign-up. Returns the new user's id, or null if the
// username is already taken — the caller turns that into a form error rather
// than a 500. The unique index on lower(username) (migration 022) is what
// actually decides the race; the pre-check just gives a nicer message.
export async function createUserWithUsername(input: {
  username: string;
  passwordHash: string;
}): Promise<string | null> {
  const username = input.username.trim().toLowerCase();
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, password_hash) VALUES ($1, $1, $2)
       RETURNING id`,
      [username, input.passwordHash]
    );
    return rows[0].id;
  } catch (err) {
    // 23505 = unique_violation — the username was claimed between the
    // availability check and this insert.
    if ((err as { code?: string }).code === "23505") return null;
    throw err;
  }
}

// Sign-in lookup. Matches case-insensitively so "Nora" and "nora" reach the
// same account, mirroring the unique index that keeps them from being two.
export async function findUserByUsername(
  username: string
): Promise<{ id: string; password_hash: string | null } | null> {
  const { rows } = await pool.query(
    "SELECT id, password_hash FROM users WHERE lower(username) = lower($1)",
    [username.trim()]
  );
  return rows[0] ?? null;
}

// Call at the top of any page that should be unreachable until registration
// (name / style / "how can we help") is complete, and until the new-user
// welcome carousel has been seen or skipped. Redirects to /onboarding or
// /welcome as needed. The onboarding and welcome pages themselves must not
// call this — they'd redirect into each other.
export async function requireOnboarded() {
  const user = await getCurrentUser();
  if (!user.onboarding_completed) {
    redirect("/onboarding");
  }
  if (!user.walkthrough_completed) {
    redirect("/welcome");
  }
  return user;
}
