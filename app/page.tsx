import { requireOnboarded, getCurrentUserId } from "@/lib/auth";
import { getTodayWeather } from "@/lib/weather";
import { isCalendarConnected } from "@/lib/googleCalendar";
import { getTimeOfDayGreeting } from "@/lib/time";
import pool from "@/lib/db";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import TodayInteractive from "@/components/TodayInteractive";
import NotificationButton from "@/components/NotificationButton";

export const dynamic = "force-dynamic";

async function getInitialRecommendation(userId: string, recId: string | undefined) {
  if (!recId) return null;
  const { rows } = await pool.query(
    `SELECT id, options FROM recommendations WHERE id = $1 AND user_id = $2`,
    [recId, userId]
  );
  if (rows.length === 0) return null;
  const options = rows[0].options ?? {};
  return {
    id: rows[0].id as string,
    outfits: options.outfits ?? [],
    gapQuestion: options.gap_question ?? null,
  };
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [user, userId] = await Promise.all([requireOnboarded(), getCurrentUserId()]);
  const recId = typeof searchParams.recId === "string" ? searchParams.recId : undefined;
  const [weather, calendarConnected, initialRecommendation] = await Promise.all([
    getTodayWeather(user.location).catch(() => null),
    isCalendarConnected(userId),
    getInitialRecommendation(userId, recId),
  ]);

  const calendarStatus = searchParams.calendar;

  return (
    <main className="px-4 pt-6 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-ui font-semibold text-slate tracking-wide">
            Stylist
          </p>
          <h1 className="text-2xl mt-1">{getTimeOfDayGreeting()}, {user.display_name || user.name}</h1>
          <p className="text-sm text-ink/60 mt-1">
            {weather
              ? `${weather.tempHighF}°/${weather.tempLowF}° · ${weather.condition} · ${weather.label}`
              : "Weather unavailable"}
          </p>
        </div>
        <NotificationButton />
      </header>

      {calendarStatus === "connected" && (
        <div className="card bg-blue/10 border-blue/30 text-sm">
          ✓ Google Calendar connected
        </div>
      )}
      {calendarStatus === "error" && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose">
          Couldn't connect Google Calendar — try again?
        </div>
      )}

      <TodayInteractive calendarConnected={calendarConnected} initialRecommendation={initialRecommendation} />

      <Link
        href="/pack"
        className="card block bg-blue/10 border-blue/30 hover:bg-blue/20 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-ui font-semibold text-ink">where to next?</p>
            <p className="text-xs text-slate/70 mt-0.5">
              help me plan my next trip
            </p>
          </div>
        </div>
      </Link>

      <BottomNav />
    </main>
  );
}
