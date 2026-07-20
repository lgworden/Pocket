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
    "SELECT id, name, email, display_name, bio, avatar, location, home_address, style_profile, scheduling_preferences, notification_preferences, onboarding_completed FROM users WHERE id = $1",
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

// Call at the top of any page that should be unreachable until registration
// (name / style / "how can we help") is complete. Redirects to /onboarding
// otherwise. The onboarding page itself must not call this.
export async function requireOnboarded() {
  const user = await getCurrentUser();
  if (!user.onboarding_completed) {
    redirect("/onboarding");
  }
  return user;
}
