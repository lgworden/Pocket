import pool from "./db";
import { getCurrentUser } from "./auth";
import { getTripWeather, type TripWeather } from "./weather";
import { buildLearnedUserProfile } from "./learnedProfileBuilder";
import { getPackingPlan } from "./anthropic";
import { TRIP_ACTIVITIES } from "./tripActivities";

const VALID_ACTIVITIES = new Set<string>(TRIP_ACTIVITIES.map((a) => a.value));

// Warmth bucket (1-5) a given temperature calls for. Mirrors the Today engine's
// scale so items filter consistently across features.
function targetWarmthForTemp(tempF: number): number {
  if (tempF < 32) return 5;
  if (tempF < 45) return 4;
  if (tempF < 60) return 3;
  if (tempF < 75) return 2;
  return 1;
}

// For a trip we pack across the whole temperature range, so the closet filter is
// deliberately permissive: anything whose warmth falls inside [low bucket, high
// bucket] (± a little slack for layering). Unlike the daily engine we do NOT
// filter by the user's *local* season — a summer wardrobe is exactly what a
// winter beach trip needs.
async function getTripCloset(userId: string, weather: TripWeather) {
  const warmHigh = targetWarmthForTemp(weather.tempHighF); // lightest needed
  const warmLow = targetWarmthForTemp(weather.tempLowF); // warmest needed
  const min = Math.min(warmHigh, warmLow) - 1;
  const max = Math.max(warmHigh, warmLow) + 1;

  const { rows } = await pool.query(
    `SELECT display_id, name, category, subcategory, colors, warmth, formality, occasions, seasons
     FROM items
     WHERE user_id = $1
       AND status = 'active'
       AND (warmth IS NULL OR warmth BETWEEN $2 AND $3)`,
    [userId, min, max]
  );
  return rows;
}

export type PackingRequest = {
  destination: string;
  days: number;
  activities: string[];
  notes?: string;
};

export type PackingContext = {
  style_profile: Record<string, unknown>;
  learned_profile: unknown;
  trip: {
    destination: string;
    days: number;
    activities: string[];
    notes: string;
  };
  trip_weather: {
    high: number;
    low: number;
    rainy_days: number;
    wind_mph: number;
    conditions: string[];
    location: string;
    forecast_days: number;
  };
  closet: unknown[];
};

// Assembles the context for a packing plan, calls Claude, and persists it as a
// recommendation row (context + options) tagged trip:true so it stays distinct
// from daily outfits. Returns the plan plus the resolved trip weather.
export async function generatePackingPlan(
  userId: string,
  req: PackingRequest
): Promise<{ id: string; plan: Record<string, unknown>; weather: TripWeather }> {
  const destination = (req.destination ?? "").trim();
  if (!destination) throw new Error("Where are you headed? Add a destination.");
  const days = Math.min(Math.max(Math.round(req.days) || 1, 1), 30);
  const activities = (req.activities ?? []).filter((a) => VALID_ACTIVITIES.has(a));

  const weather = await getTripWeather(destination, days);

  const [user, closet, learnedProfile] = await Promise.all([
    getCurrentUser(),
    getTripCloset(userId, weather),
    buildLearnedUserProfile(userId).catch(() => null),
  ]);

  const context: PackingContext = {
    style_profile: user.style_profile ?? {},
    learned_profile: learnedProfile,
    trip: {
      destination,
      days,
      activities,
      notes: (req.notes ?? "").trim(),
    },
    trip_weather: {
      high: weather.tempHighF,
      low: weather.tempLowF,
      rainy_days: weather.precipitationDays,
      wind_mph: weather.windMaxMph,
      conditions: weather.conditions,
      location: weather.label,
      forecast_days: weather.days,
    },
    closet,
  };

  const displayName = user.display_name || user.name;
  const plan = await getPackingPlan(context as unknown as Record<string, unknown>, displayName);

  const options = { trip: true, ...plan };
  const { rows } = await pool.query(
    `INSERT INTO recommendations (user_id, context, options)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, JSON.stringify(context), JSON.stringify(options)]
  );

  return { id: rows[0].id, plan, weather };
}
