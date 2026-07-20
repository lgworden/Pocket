import pool from "./db";
import { getCurrentUser } from "./auth";
import { getTodayWeather, type TodayWeather } from "./weather";
import { getTodayEventsDetailed } from "./googleCalendar";
import { detectTightTransitions } from "./scheduleGaps";
import { buildLearnedUserProfile, type LearnedUserProfile } from "./learnedProfileBuilder";
import { classifyEventType, getRelevantHistory, type MatrixEntry } from "./weatherEventMatrix";

function getCurrentSeason(date = new Date()): string {
  const month = date.getMonth(); // 0-11
  if ([11, 0, 1].includes(month)) return "winter";
  if ([2, 3, 4].includes(month)) return "spring";
  if ([5, 6, 7].includes(month)) return "summer";
  return "fall";
}

// Coldest-part-of-day-first: dress for the low, not the high.
function targetWarmthForTemp(tempF: number): number {
  if (tempF < 32) return 5;
  if (tempF < 45) return 4;
  if (tempF < 60) return 3;
  if (tempF < 75) return 2;
  return 1;
}

async function getRecentlyWornDisplayIds(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ display_id: string }>(
    `SELECT DISTINCT i.display_id
     FROM outfit_logs l
     JOIN items i ON i.id = ANY(l.item_ids)
     WHERE l.user_id = $1 AND l.date >= CURRENT_DATE - INTERVAL '14 days'`,
    [userId]
  );
  return rows.map((r) => r.display_id);
}

async function getSeasonalDirection(userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ style_direction: string | null }>(
    `SELECT style_direction FROM vision_boards
     WHERE user_id = $1 AND style_direction IS NOT NULL
     ORDER BY year DESC, created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0]?.style_direction ?? null;
}

async function getWeatherFilteredCloset(userId: string, tempLowF: number) {
  const season = getCurrentSeason();
  const target = targetWarmthForTemp(tempLowF);

  const { rows } = await pool.query(
    `SELECT display_id, name, category, subcategory, colors, warmth, formality, occasions, seasons
     FROM items
     WHERE user_id = $1
       AND status = 'active'
       AND (seasons = '{}' OR $2 = ANY(seasons))
       AND (warmth IS NULL OR ABS(warmth - $3) <= 1)`,
    [userId, season, target]
  );
  return rows;
}

export type RecommendationContext = {
  style_profile: Record<string, unknown>;
  learned_profile: LearnedUserProfile | null;
  seasonal_direction: string | null;
  weather: {
    high: number;
    low: number;
    precipitation_in: number;
    wind_mph: number;
    condition: string;
    location: string;
  };
  today: string;
  recently_worn: string[];
  closet: unknown[];
  weather_event_history: MatrixEntry | null;
  schedule_constraints: string[];
};

// Assembles the context object described in the build plan's recommendation prompt.
// Calendar events (if connected) are folded into `today` alongside the user's typed summary.
export async function buildRecommendationContext(
  userId: string,
  dayText: string
): Promise<{ context: RecommendationContext; weather: TodayWeather; calendarEvents: string[] | null }> {
  const user = await getCurrentUser();
  const weather = await getTodayWeather(user.location);

  let calendarEventsDetailed: Awaited<ReturnType<typeof getTodayEventsDetailed>> = null;
  try {
    calendarEventsDetailed = await getTodayEventsDetailed(userId);
  } catch {
    calendarEventsDetailed = null; // connected but unreachable (expired grant, API hiccup) — degrade quietly
  }

  const calendarEvents: string[] | null =
    calendarEventsDetailed === null
      ? null
      : calendarEventsDetailed.map((e) => {
          if (!e.start) return e.summary;
          const time = new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          return `${e.summary} (${time})`;
        });

  const todayEventType = classifyEventType(
    [dayText, ...(calendarEvents ?? [])].filter(Boolean).join("; ")
  );

  const [seasonalDirection, recentlyWorn, closet, learnedProfile, weatherEventHistory, scheduleConstraints] =
    await Promise.all([
      getSeasonalDirection(userId),
      getRecentlyWornDisplayIds(userId),
      getWeatherFilteredCloset(userId, weather.tempLowF),
      buildLearnedUserProfile(userId).catch(() => null), // Graceful degradation if learning not ready
      getRelevantHistory(userId, weather, todayEventType).catch(() => null),
      calendarEventsDetailed
        ? detectTightTransitions(calendarEventsDetailed, user.home_address ?? null).catch(() => [])
        : Promise.resolve([]),
    ]);

  const today = calendarEvents?.length
    ? `${dayText}\nCalendar: ${calendarEvents.join("; ")}`
    : dayText;

  const context: RecommendationContext = {
    style_profile: user.style_profile ?? {},
    learned_profile: learnedProfile,
    seasonal_direction: seasonalDirection,
    weather: {
      high: weather.tempHighF,
      low: weather.tempLowF,
      precipitation_in: weather.precipitationSumIn,
      wind_mph: weather.windMaxMph,
      condition: weather.condition,
      location: weather.label,
    },
    today,
    recently_worn: recentlyWorn,
    closet,
    weather_event_history: weatherEventHistory,
    schedule_constraints: scheduleConstraints,
  };

  return { context, weather, calendarEvents };
}
