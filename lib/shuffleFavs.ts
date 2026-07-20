import pool from "./db";
import { getCurrentUser } from "./auth";
import { getTodayWeather, type TodayWeather } from "./weather";
import { getTodayEventsSummary } from "./googleCalendar";
import { classifyEventType, getWeatherBucket } from "./weatherEventMatrix";

type FavOutfit = {
  title: string;
  reasoning: string;
  items: { display_id: string; name: string }[];
  logId: string;
};

type Combo = {
  logId: string;
  items: { display_id: string; name: string }[];
  occasion: string | null;
  weatherBucket: string | null;
  timesWorn: number;
  lastWorn: string;
};

// One row per historical outfit_logs entry whose items are ALL still active in
// the closet (an item getting archived/donated retires every combo it was part
// of, rather than resurfacing a fit that's no longer wearable).
async function getActiveWornCombos(userId: string): Promise<Combo[]> {
  const { rows } = await pool.query<{
    log_id: string;
    date: string;
    occasion: string | null;
    weather_snapshot: { tempLowF?: number; precipitationSumIn?: number } | null;
    items: { display_id: string; name: string }[];
  }>(
    `SELECT l.id as log_id, l.date, l.occasion, l.weather_snapshot,
            json_agg(json_build_object('display_id', i.display_id, 'name', i.name) ORDER BY i.category) as items
     FROM outfit_logs l
     JOIN items i ON i.id = ANY(l.item_ids) AND i.status = 'active'
     WHERE l.user_id = $1
     GROUP BY l.id
     HAVING count(i.id) = array_length(l.item_ids, 1)
     ORDER BY l.date DESC`,
    [userId]
  );

  // Group logged instances by their combo of items — the same outfit worn on
  // multiple dates is a "favorite", not several distinct outfits.
  const byCombo = new Map<string, Combo>();
  for (const row of rows) {
    const key = row.items
      .map((i) => i.display_id)
      .sort()
      .join("+");
    const weatherBucket =
      row.weather_snapshot?.tempLowF != null
        ? getWeatherBucket(row.weather_snapshot.tempLowF, row.weather_snapshot.precipitationSumIn ?? 0)
        : null;

    const existing = byCombo.get(key);
    if (existing) {
      existing.timesWorn += 1;
      if (row.date > existing.lastWorn) existing.lastWorn = row.date;
    } else {
      byCombo.set(key, {
        logId: row.log_id,
        items: row.items,
        occasion: row.occasion,
        weatherBucket,
        timesWorn: 1,
        lastWorn: row.date,
      });
    }
  }
  return Array.from(byCombo.values());
}

function relativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildTitle(combo: Combo, eventType: string): string {
  if (combo.timesWorn > 2) return "One of your go-tos";
  if (eventType !== "none" && eventType !== "casual") {
    return `A past ${eventType} favorite`;
  }
  return "From your archive";
}

function buildReasoning(combo: Combo, tier: "exact" | "weather" | "any", weather: TodayWeather): string {
  const worn =
    combo.timesWorn > 1
      ? `You've worn this ${combo.timesWorn} times, most recently ${relativeDate(combo.lastWorn)}.`
      : `You wore this ${relativeDate(combo.lastWorn)}.`;
  if (tier === "exact") return `${worn} Matches today's weather and plans.`;
  if (tier === "weather") return `${worn} Fits today's ${weather.condition.toLowerCase()} weather.`;
  return `${worn} Pulling from your history since nothing quite matches today's weather.`;
}

// Weighted random pick — combos worn more often (the actual "favorites") are
// more likely to come up, but anything in the tier has a shot.
function weightedPick(combos: Combo[]): Combo {
  const totalWeight = combos.reduce((sum, c) => sum + c.timesWorn, 0);
  let r = Math.random() * totalWeight;
  for (const combo of combos) {
    r -= combo.timesWorn;
    if (r <= 0) return combo;
  }
  return combos[combos.length - 1];
}

// Resurfaces an outfit the user has actually worn before — never a freshly
// generated combo — picked to fit today's weather and plans rather than by
// Claude. Falls back tier by tier (exact weather+event match, weather-only,
// then anything) so there's always a pick once any history exists.
export async function pickFavoriteOutfit(
  userId: string,
  dayText: string,
  excludeLogIds: string[] = []
): Promise<{ outfit: FavOutfit | null; weather: TodayWeather; today: string }> {
  const user = await getCurrentUser();
  const weather = await getTodayWeather(user.location);

  const calendarEvents = await getTodayEventsSummary(userId).catch(() => null);
  const today = calendarEvents?.length ? `${dayText}\nCalendar: ${calendarEvents.join("; ")}` : dayText;

  const eventType = classifyEventType(today);
  const todayBucket = getWeatherBucket(weather.tempLowF, weather.precipitationSumIn);

  const combos = (await getActiveWornCombos(userId)).filter((c) => !excludeLogIds.includes(c.logId));
  if (combos.length === 0) return { outfit: null, weather, today };

  const tier1 = combos.filter((c) => c.weatherBucket === todayBucket && c.occasion === eventType);
  const tier2 = combos.filter((c) => c.weatherBucket === todayBucket);
  const tierPool = tier1.length ? tier1 : tier2.length ? tier2 : combos;
  const tierLabel: "exact" | "weather" | "any" = tier1.length ? "exact" : tier2.length ? "weather" : "any";

  const picked = weightedPick(tierPool);

  return {
    outfit: {
      title: buildTitle(picked, eventType),
      reasoning: buildReasoning(picked, tierLabel, weather),
      items: picked.items,
      logId: picked.logId,
    },
    weather,
    today,
  };
}
