import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentHHMMInZone, getCurrentWeekdayInZone, isTimeDue } from "@/lib/time";
import { DEFAULT_DAILY_DIGEST_TIME } from "@/lib/onboardingOptions";
import {
  generateDailyDigest,
  generateWeeklyStyleAnalysis,
  generateWeeklyFeedSummary,
  generateOotdReminder,
} from "@/lib/notifications";

// Fixed weekly slots (America/New_York, see lib/time.ts) — not user-configurable
// yet, unlike daily_digest_time. Sunday evening, spaced 1hr apart so the two
// Claude-backed generators don't run in the same 15-min cron tick.
const WEEKLY_STYLE_ANALYSIS_TIME = "18:00";
const WEEKLY_FEED_SUMMARY_TIME = "19:00";
const OOTD_REMINDER_TIME = "11:00"; // 11am ET, per product spec

// Railway cron should hit this every 15 minutes: `*/15 * * * *` →
// `curl -X POST https://<app-domain>/api/cron/tick -H "Authorization: Bearer $CRON_SECRET"`
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowHHMM = getCurrentHHMMInZone();
  const weekday = getCurrentWeekdayInZone();

  const { rows: users } = await pool.query(
    `SELECT id, name, display_name, location, notification_preferences FROM users`
  );

  const results: Record<string, string[]> = {
    daily_digest: [],
    weekly_style_analysis: [],
    weekly_feed_summary: [],
    ootd_reminder: [],
    errors: [],
  };

  for (const user of users) {
    const prefs = (user.notification_preferences ?? {}) as Record<string, unknown>;

    if (
      prefs.daily_digest &&
      isTimeDue((prefs.daily_digest_time as string) || DEFAULT_DAILY_DIGEST_TIME, nowHHMM)
    ) {
      try {
        if (await generateDailyDigest(user)) results.daily_digest.push(user.id);
      } catch (err) {
        console.error(`[cron] daily_digest failed for ${user.id}:`, err);
        results.errors.push(`daily_digest:${user.id}`);
      }
    }

    if (
      prefs.ootd_reminder &&
      isTimeDue(OOTD_REMINDER_TIME, nowHHMM)
    ) {
      try {
        if (await generateOotdReminder(user)) results.ootd_reminder.push(user.id);
      } catch (err) {
        console.error(`[cron] ootd_reminder failed for ${user.id}:`, err);
        results.errors.push(`ootd_reminder:${user.id}`);
      }
    }

    if (
      prefs.weekly_style_analysis &&
      weekday === "sun" &&
      isTimeDue(WEEKLY_STYLE_ANALYSIS_TIME, nowHHMM)
    ) {
      try {
        if (await generateWeeklyStyleAnalysis(user)) results.weekly_style_analysis.push(user.id);
      } catch (err) {
        console.error(`[cron] weekly_style_analysis failed for ${user.id}:`, err);
        results.errors.push(`weekly_style_analysis:${user.id}`);
      }
    }

    if (
      prefs.weekly_feed_summary &&
      weekday === "sun" &&
      isTimeDue(WEEKLY_FEED_SUMMARY_TIME, nowHHMM)
    ) {
      try {
        if (await generateWeeklyFeedSummary(user)) results.weekly_feed_summary.push(user.id);
      } catch (err) {
        console.error(`[cron] weekly_feed_summary failed for ${user.id}:`, err);
        results.errors.push(`weekly_feed_summary:${user.id}`);
      }
    }
  }

  return NextResponse.json({ nowHHMM, weekday, results });
}
