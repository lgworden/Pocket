// Outbound transactional email. Deliberately dependency-free: Resend's REST API
// is a single POST, so there's no SDK to install and nothing to keep in sync —
// the same reason the weather and Google Calendar helpers use plain `fetch`.
//
// Unconfigured is a supported state, not an error: with no RESEND_API_KEY the
// send no-ops and logs, and every caller is expected to have already persisted
// whatever it was about to mail (see lib/feedback.ts). Swapping providers means
// rewriting `sendEmail` and nothing else.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend's shared sender — works with no domain verification, but only delivers
// to the address that owns the Resend account. Fine for the operator-inbox use
// case; set EMAIL_FROM to a verified domain sender to mail anyone else.
const DEFAULT_FROM = "pckt <onboarding@resend.dev>";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Address a reply should go to, when it differs from the sender. */
  replyTo?: string;
};

export type EmailResult = { ok: boolean; skipped?: boolean; error?: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY unset — not sending "${msg.subject}" to ${msg.to}`);
    return { ok: false, skipped: true, error: "email not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `resend ${res.status}: ${detail.slice(0, 300)}`;
      console.error(`[email] send failed —`, error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] send threw —`, error);
    return { ok: false, error };
  }
}

// Minimal HTML escaper — user-authored text (a feedback message) goes into the
// HTML part of an email, so it can't be interpolated raw.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
