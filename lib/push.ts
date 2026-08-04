import webpush from "web-push";
import pool from "./db";

// Web Push delivery: fans a notification out to every subscribed browser/device
// for a user (phone home screen, desktop, etc). Best-effort — a user with no
// subscriptions (push never enabled, or declined) just gets the in-app
// notification created by lib/notifications.ts, nothing more.

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; link?: string | null }
): Promise<void> {
  if (!ensureConfigured()) return; // push not set up in this environment — no-op

  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    link: payload.link || "/",
  });

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked on the browser's end — stop
          // trying it rather than erroring on every future notification.
          await removeSubscription(row.endpoint);
        }
      }
    })
  );
}
