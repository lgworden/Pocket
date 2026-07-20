import { getCurrentUserId, getCurrentUser } from "@/lib/auth";
import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWeather } from "@/lib/weather";
import { getTodayEventsSummary } from "@/lib/googleCalendar";
import { classifyEventType, type WeatherSnapshot } from "@/lib/weatherEventMatrix";
import { analyzeUserBehavior } from "@/lib/preferenceAnalyzer";

// Best-effort context capture — a one-tap wear log should still succeed even
// if weather/calendar lookups fail (no location set, API hiccup, expired
// calendar grant). Feeds the weather x event-type matrix in weatherEventMatrix.ts.
async function captureTodayContext(userId: string): Promise<{
  weatherSnapshot: WeatherSnapshot | null;
  occasion: string | null;
}> {
  let weatherSnapshot: WeatherSnapshot | null = null;
  try {
    const user = await getCurrentUser();
    if (user.location) {
      const weather = await getTodayWeather(user.location);
      weatherSnapshot = {
        tempLowF: weather.tempLowF,
        tempHighF: weather.tempHighF,
        precipitationSumIn: weather.precipitationSumIn,
        windMaxMph: weather.windMaxMph,
        condition: weather.condition,
      };
    }
  } catch {
    weatherSnapshot = null;
  }

  let occasion: string | null = null;
  try {
    const events = await getTodayEventsSummary(userId);
    occasion = classifyEventType(events?.join("; ") ?? null);
  } catch {
    occasion = null;
  }

  return { weatherSnapshot, occasion };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Verify item ownership
    const { rows: itemRows } = await pool.query(
      "SELECT id FROM items WHERE id = $1 AND user_id = $2",
      [params.id, userId]
    );

    if (itemRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { weatherSnapshot, occasion } = await captureTodayContext(userId);

    // Create an outfit log entry for today with this item
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO outfit_logs (user_id, date, item_ids, source, weather_snapshot, occasion)
       VALUES ($1, $2, $3, 'self_styled', $4, $5)`,
      [userId, today, [params.id], weatherSnapshot ? JSON.stringify(weatherSnapshot) : null, occasion]
    );

    analyzeUserBehavior(userId).catch((err) =>
      console.error("[API] Background preference analysis failed:", err)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error incrementing wear count:", err);
    return NextResponse.json(
      { error: "Failed to increment wear count" },
      { status: 500 }
    );
  }
}
