import pool from "./db";
import { sendEmail, escapeHtml } from "./email";

// Where every submission lands. Overridable per-environment so a staging deploy
// doesn't mail the real inbox, but the operator address is the default rather
// than a required env var — feedback should reach a human out of the box.
const DEFAULT_INBOX = "lilygworden@gmail.com";

export const SENTIMENTS = ["love", "meh", "bug", "idea"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  love: "😍 loving it",
  meh: "😐 it's fine",
  bug: "🐛 something's broken",
  idea: "💡 idea / request",
};

export type FeedbackInput = {
  userId: string;
  message: string;
  sentiment?: Sentiment | null;
  /** Entry point it came from, e.g. "weekly_reminder" or "preferences". */
  source?: string | null;
};

export const MAX_FEEDBACK_LENGTH = 4000;

/**
 * Store a piece of feedback, then email it to the operator inbox.
 *
 * The insert and the email are deliberately sequential and independently
 * fallible: the row is the durable copy, so a mail outage (or an unconfigured
 * RESEND_API_KEY) costs the notification, never the feedback. The send result
 * is written back onto the row so a failed delivery is visible in the table
 * rather than only in the logs.
 */
export async function submitFeedback(input: FeedbackInput): Promise<{ id: string }> {
  const message = input.message.trim().slice(0, MAX_FEEDBACK_LENGTH);

  const { rows } = await pool.query(
    `INSERT INTO feedback (user_id, message, sentiment, source)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [input.userId, message, input.sentiment ?? null, input.source ?? null]
  );
  const id: string = rows[0].id;

  // Who sent it — for the email header. Best-effort: a lookup failure must not
  // sink a submission that's already safely stored.
  const { rows: userRows } = await pool
    .query(
      `SELECT name, username, display_name, email FROM users WHERE id = $1`,
      [input.userId]
    )
    .catch(() => ({ rows: [] as Array<Record<string, string | null>> }));
  const user = userRows[0] ?? {};
  const handle = user.username ? `@${user.username}` : user.email || "unknown user";
  const displayName = user.display_name || user.name || handle;

  const result = await sendEmail(buildFeedbackEmail({
    id,
    message,
    sentiment: (input.sentiment ?? null) as Sentiment | null,
    source: input.source ?? null,
    displayName,
    handle,
    userEmail: user.email ?? null,
    userId: input.userId,
  }));

  await pool
    .query(
      `UPDATE feedback
       SET emailed_at = CASE WHEN $2 THEN now() ELSE NULL END,
           email_error = $3
       WHERE id = $1`,
      [id, result.ok, result.ok ? null : result.error ?? "unknown error"]
    )
    .catch((err) => console.error("[feedback] could not record email status:", err));

  return { id };
}

function buildFeedbackEmail(f: {
  id: string;
  message: string;
  sentiment: Sentiment | null;
  source: string | null;
  displayName: string;
  handle: string;
  userEmail: string | null;
  userId: string;
}) {
  const to = process.env.FEEDBACK_EMAIL_TO || DEFAULT_INBOX;
  const sentimentLine = f.sentiment ? SENTIMENT_LABEL[f.sentiment] : "no rating";
  const subject = `[pckt feedback] ${f.sentiment ? `${f.sentiment} — ` : ""}${f.displayName}`;

  const meta = [
    `From:      ${f.displayName} (${f.handle})`,
    `Sentiment: ${sentimentLine}`,
    `Source:    ${f.source || "unspecified"}`,
    `User id:   ${f.userId}`,
    `Feedback:  ${f.id}`,
  ].join("\n");

  const text = `${meta}\n\n---\n\n${f.message}\n`;

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
      <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8178;margin:0 0 4px">
        pckt feedback
      </p>
      <h2 style="margin:0 0 16px;font-weight:600">${escapeHtml(f.displayName)} · ${escapeHtml(sentimentLine)}</h2>
      <div style="white-space:pre-wrap;background:#faf7f2;border:1px solid #e7e0d6;border-radius:12px;padding:16px;font-size:15px;line-height:1.5">
        ${escapeHtml(f.message)}
      </div>
      <p style="font-size:12px;color:#8a8178;margin-top:16px;line-height:1.6">
        ${escapeHtml(f.handle)}${f.userEmail ? ` · ${escapeHtml(f.userEmail)}` : ""}<br>
        source: ${escapeHtml(f.source || "unspecified")}<br>
        user id: ${escapeHtml(f.userId)}<br>
        feedback id: ${escapeHtml(f.id)}
      </p>
    </div>
  `;

  // Reply-to only when the sender actually has an email (username accounts
  // don't) — otherwise hitting reply should do nothing rather than bounce.
  return { to, subject, text, html, ...(f.userEmail ? { replyTo: f.userEmail } : {}) };
}

export type FeedbackRow = {
  id: string;
  message: string;
  sentiment: Sentiment | null;
  source: string | null;
  created_at: string;
};

/** This user's own past submissions — shown under the form so they can see it landed. */
export async function listUserFeedback(userId: string, limit = 5): Promise<FeedbackRow[]> {
  const { rows } = await pool.query(
    `SELECT id, message, sentiment, source, created_at
     FROM feedback WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}
