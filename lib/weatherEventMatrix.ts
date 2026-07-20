import pool from "./db";
import type { TodayWeather } from "./weather";

// Canonical shape every write path normalizes into before storing on
// outfit_logs.weather_snapshot, so the matrix reader doesn't need to handle
// multiple field-naming conventions (TodayWeather vs. RecommendationContext.weather).
export type WeatherSnapshot = {
  tempLowF: number;
  tempHighF: number;
  precipitationSumIn: number;
  windMaxMph?: number;
  condition?: string;
};

const EVENT_KEYWORDS: Record<string, string[]> = {
  workwear: [
    "meeting", "standup", "call", "office", "work", "review",
    "interview", "presentation", "client", "sync", "1:1", "conference",
  ],
  athletic: [
    "gym", "workout", "run", "yoga", "training", "spin", "hike", "class", "pilates", "cycle",
  ],
  "going-out": [
    "dinner", "party", "date", "drinks", "wedding", "concert", "birthday", "bar", "brunch", "show",
  ],
};

// Best-effort classification of free-text calendar summaries into the app's
// existing occasion vocabulary (workwear/athletic/going-out/casual/none), so
// weather+occasion history can be cross-referenced without inventing a new
// taxonomy. "none" means no calendar text at all; "casual" means events
// existed but didn't match a known keyword.
export function classifyEventType(calendarText: string | null | undefined): string {
  if (!calendarText || !calendarText.trim()) return "none";
  const lower = calendarText.toLowerCase();
  for (const [type, keywords] of Object.entries(EVENT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "casual";
}

type TempBand = "freezing" | "cold" | "cool" | "mild" | "warm";

function tempBandFor(tempLowF: number): TempBand {
  if (tempLowF < 32) return "freezing";
  if (tempLowF < 45) return "cold";
  if (tempLowF < 60) return "cool";
  if (tempLowF < 75) return "mild";
  return "warm";
}

// Buckets raw temp/precipitation into a coarse label ("cold-wet", "mild-dry", ...)
// coarse enough that a handful of logged outfits still land in the same bucket
// as today, rather than every day forming its own singleton bucket.
export function getWeatherBucket(tempLowF: number, precipitationIn: number): string {
  const tempBand = tempBandFor(tempLowF);
  const wet = precipitationIn > 0.05;
  return `${tempBand}-${wet ? "wet" : "dry"}`;
}

export type MatrixEntry = {
  weatherBucket: string;
  eventType: string;
  timesLogged: number;
  topItems: Array<{ display_id: string; name: string; count: number }>;
  topColors: string[];
  topCategories: string[];
  avgFormality: number | null;
  avgWarmth: number | null;
};

type LogRow = {
  date: string;
  weather_snapshot: Partial<WeatherSnapshot> | null;
  occasion: string | null;
  display_id: string;
  name: string;
  colors: string[];
  category: string;
  formality: number | null;
  warmth: number | null;
};

type Bucket = {
  weatherBucket: string;
  eventType: string;
  outfitDates: Set<string>;
  itemCounts: Map<string, { display_id: string; name: string; count: number }>;
  colorCounts: Map<string, number>;
  categoryCounts: Map<string, number>;
  formalitySum: number;
  formalityN: number;
  warmthSum: number;
  warmthN: number;
};

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// Rebuilds the weather x event-type x closet-choice matrix from outfit_logs
// on every call rather than storing it redundantly, matching the
// item_wear_stats view convention — cheap at single-user data volume, and
// never goes stale.
export async function buildWeatherEventMatrix(userId: string): Promise<MatrixEntry[]> {
  const { rows } = await pool.query<LogRow>(
    `SELECT l.date, l.weather_snapshot, l.occasion,
            i.display_id, i.name, i.colors, i.category, i.formality, i.warmth
     FROM outfit_logs l
     JOIN items i ON i.id = ANY(l.item_ids)
     WHERE l.user_id = $1
       AND l.weather_snapshot IS NOT NULL
       AND l.date >= CURRENT_DATE - INTERVAL '180 days'`,
    [userId]
  );

  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const snap = row.weather_snapshot;
    if (snap?.tempLowF == null) continue;

    const weatherBucket = getWeatherBucket(snap.tempLowF, snap.precipitationSumIn ?? 0);
    const eventType = row.occasion ?? "none";
    const key = `${weatherBucket}::${eventType}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        weatherBucket,
        eventType,
        outfitDates: new Set(),
        itemCounts: new Map(),
        colorCounts: new Map(),
        categoryCounts: new Map(),
        formalitySum: 0,
        formalityN: 0,
        warmthSum: 0,
        warmthN: 0,
      };
      buckets.set(key, bucket);
    }

    bucket.outfitDates.add(row.date);

    const existingItem = bucket.itemCounts.get(row.display_id);
    if (existingItem) existingItem.count += 1;
    else bucket.itemCounts.set(row.display_id, { display_id: row.display_id, name: row.name, count: 1 });

    for (const color of row.colors ?? []) {
      bucket.colorCounts.set(color, (bucket.colorCounts.get(color) ?? 0) + 1);
    }
    bucket.categoryCounts.set(row.category, (bucket.categoryCounts.get(row.category) ?? 0) + 1);

    if (row.formality != null) {
      bucket.formalitySum += row.formality;
      bucket.formalityN += 1;
    }
    if (row.warmth != null) {
      bucket.warmthSum += row.warmth;
      bucket.warmthN += 1;
    }
  }

  return Array.from(buckets.values())
    .map((b) => ({
      weatherBucket: b.weatherBucket,
      eventType: b.eventType,
      timesLogged: b.outfitDates.size,
      topItems: Array.from(b.itemCounts.values())
        .sort((a, c) => c.count - a.count)
        .slice(0, 5),
      topColors: Array.from(b.colorCounts.entries())
        .sort((a, c) => c[1] - a[1])
        .slice(0, 5)
        .map(([color]) => color),
      topCategories: Array.from(b.categoryCounts.entries())
        .sort((a, c) => c[1] - a[1])
        .map(([category]) => category),
      avgFormality: b.formalityN > 0 ? average([b.formalitySum / b.formalityN]) : null,
      avgWarmth: b.warmthN > 0 ? average([b.warmthSum / b.warmthN]) : null,
    }))
    .sort((a, b) => b.timesLogged - a.timesLogged);
}

// Finds the best historical match for today's weather + event type: exact
// weather+event match first, falling back to weather-only (merged across
// event types) so a handful of logged outfits still surface a signal instead
// of nothing.
export async function getRelevantHistory(
  userId: string,
  weather: TodayWeather,
  eventType: string
): Promise<MatrixEntry | null> {
  const matrix = await buildWeatherEventMatrix(userId);
  if (matrix.length === 0) return null;

  const bucketLabel = getWeatherBucket(weather.tempLowF, weather.precipitationSumIn);

  const exact = matrix.find((m) => m.weatherBucket === bucketLabel && m.eventType === eventType);
  if (exact) return exact;

  const weatherOnly = matrix.filter((m) => m.weatherBucket === bucketLabel);
  if (weatherOnly.length === 0) return null;

  const mergedItems = new Map<string, { display_id: string; name: string; count: number }>();
  for (const entry of weatherOnly) {
    for (const item of entry.topItems) {
      const existing = mergedItems.get(item.display_id);
      mergedItems.set(item.display_id, { ...item, count: (existing?.count ?? 0) + item.count });
    }
  }

  return {
    weatherBucket: bucketLabel,
    eventType: "any",
    timesLogged: weatherOnly.reduce((sum, m) => sum + m.timesLogged, 0),
    topItems: Array.from(mergedItems.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topColors: Array.from(new Set(weatherOnly.flatMap((m) => m.topColors))).slice(0, 5),
    topCategories: Array.from(new Set(weatherOnly.flatMap((m) => m.topCategories))),
    avgFormality: average(weatherOnly.map((m) => m.avgFormality).filter((v): v is number => v != null)),
    avgWarmth: average(weatherOnly.map((m) => m.avgWarmth).filter((v): v is number => v != null)),
  };
}
