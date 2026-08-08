import pool from "./db";

// "Designer" is a hidden, operator-granted account status (users.designer_since).
// It does exactly one thing product-wise: a designer can be followed, and
// nobody else can. It is deliberately invisible — no badge, no label, no
// "N to go" progress, no mention in onboarding or help copy. The only tell a
// user ever sees is that designer profiles look different (warmer background)
// and carry a follow button. That opacity is the point: there is no advertised
// ladder to climb, so grant it out of band with
//
//   npm run designer:grant -- <username|email>
//   npm run designer:revoke -- <username|email>
//
// If this ever becomes something users can earn, the rule belongs here — not
// scattered across the follow path — and the UI silence still has to be a
// deliberate decision rather than an accident.

export async function isDesigner(userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM users WHERE id = $1 AND designer_since IS NOT NULL",
    [userId]
  );
  return rows.length > 0;
}
