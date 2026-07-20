import pool from "./db";
import { getTodayWeather } from "./weather";
import { generateAndSaveRecommendation } from "./recommendations";
import { getUserPreferenceAnalysis } from "./preferenceAnalyzer";
import { getWeeklyStyleSummary } from "./anthropic";
import { DEFAULT_TIMEZONE } from "./time";

export type NotificationType =
  | "daily_digest"
  | "weekly_style_analysis"
  | "weekly_feed_summary"
  | "ootd_reminder";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

// ---- CRUD -------------------------------------------------------------

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link: string | null = null
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, type, title, body, link]
  );
  return rows[0].id;
}

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { rows } = await pool.query(
    `SELECT id, type, title, body, link, read_at, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return rows[0].count;
}

export async function markRead(userId: string, id: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [id, userId]
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
}

// ---- Idempotency guards -------------------------------------------------

async function hasNotificationToday(userId: string, type: NotificationType): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = $2
       AND (created_at AT TIME ZONE $3)::date = (now() AT TIME ZONE $3)::date
     LIMIT 1`,
    [userId, type, DEFAULT_TIMEZONE]
  );
  return (rows.length ?? 0) > 0;
}

async function hasNotificationThisWeek(userId: string, type: NotificationType): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notifications
     WHERE user_id = $1 AND type = $2
       AND (created_at AT TIME ZONE $3) >= date_trunc('week', now() AT TIME ZONE $3)
     LIMIT 1`,
    [userId, type, DEFAULT_TIMEZONE]
  );
  return (rows.length ?? 0) > 0;
}

// ---- Content generators -------------------------------------------------
// Each returns true if it created a notification, false if it skipped
// (already sent, preference off, or nothing worth saying).

type UserRow = {
  id: string;
  name: string;
  display_name: string | null;
  location: string | null;
  notification_preferences: Record<string, unknown> | null;
};

export async function generateDailyDigest(user: UserRow): Promise<boolean> {
  if (await hasNotificationToday(user.id, "daily_digest")) return false;

  const weather = await getTodayWeather(user.location || "").catch(() => null);
  const rec = await generateAndSaveRecommendation(user.id, "");
  const outfits = (rec.outfits as Array<{ title: string }>) ?? [];

  const weatherLine = weather
    ? `${weather.tempHighF}°/${weather.tempLowF}° · ${weather.condition}`
    : "Weather unavailable";
  const outfitLine = outfits.length
    ? `${outfits.length} outfit idea${outfits.length > 1 ? "s" : ""} ready: ${outfits
        .map((o) => o.title)
        .join(" · ")}`
    : "Open the app to get today's outfit ideas.";

  await createNotification(
    user.id,
    "daily_digest",
    "Your morning digest",
    `${weatherLine}. ${outfitLine}`,
    `/?recId=${rec.id}`
  );
  return true;
}

export async function generateWeeklyStyleAnalysis(user: UserRow): Promise<boolean> {
  if (await hasNotificationThisWeek(user.id, "weekly_style_analysis")) return false;

  const { rows: weeklyItems } = await pool.query(
    `SELECT i.display_id, i.name, l.date
     FROM outfit_logs l
     JOIN items i ON i.id = ANY(l.item_ids)
     WHERE l.user_id = $1 AND l.date >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY l.date DESC`,
    [user.id]
  );

  const allTimeAnalysis = await getUserPreferenceAnalysis(user.id);
  const displayName = user.display_name || user.name;

  const summary = await getWeeklyStyleSummary(
    weeklyItems.map((r) => ({
      display_id: r.display_id,
      name: r.name,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    })),
    allTimeAnalysis as unknown as Record<string, unknown> | null,
    displayName
  );

  const body = [summary.weekly_vibe, summary.alltime_note].filter(Boolean).join(" ");

  await createNotification(user.id, "weekly_style_analysis", "Your week in style", body, null);
  return true;
}

export async function generateWeeklyFeedSummary(user: UserRow): Promise<boolean> {
  if (await hasNotificationThisWeek(user.id, "weekly_feed_summary")) return false;

  const { rows: postRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM feed_posts
     WHERE user_id = $1 AND created_at >= now() - INTERVAL '7 days'`,
    [user.id]
  );
  const postCount = postRows[0].count;

  const { rows: reactionRows } = await pool.query(
    `SELECT r.reaction, COUNT(*)::int AS count
     FROM feed_reactions r
     JOIN feed_posts p ON p.id = r.post_id
     WHERE p.user_id = $1 AND r.created_at >= now() - INTERVAL '7 days'
     GROUP BY r.reaction`,
    [user.id]
  );

  if (postCount === 0 && reactionRows.length === 0) {
    // Nothing happened — skip rather than send an empty summary.
    return false;
  }

  const emoji: Record<string, string> = { cheers: "🥂", fire: "🔥", eyes: "🥺" };
  const reactionLine = reactionRows.length
    ? reactionRows.map((r) => `${emoji[r.reaction] ?? ""} ${r.count}`).join("  ")
    : "no reactions yet";

  const body = `You posted ${postCount} outfit${postCount === 1 ? "" : "s"} to the feed this week and got ${reactionLine}.`;

  await createNotification(user.id, "weekly_feed_summary", "Your feed this week", body, "/feed");
  return true;
}

export async function generateOotdReminder(user: UserRow): Promise<boolean> {
  if (await hasNotificationToday(user.id, "ootd_reminder")) return false;

  const { rows } = await pool.query(
    `SELECT 1 FROM feed_posts
     WHERE user_id = $1
       AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
     LIMIT 1`,
    [user.id, DEFAULT_TIMEZONE]
  );
  if (rows.length > 0) return false; // already posted today

  await createNotification(
    user.id,
    "ootd_reminder",
    "Post today's outfit",
    "Don't forget to share your outfit of the day on the feed!",
    "/feed"
  );
  return true;
}
