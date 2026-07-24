import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { analyzeUserBehavior } from "@/lib/preferenceAnalyzer";
import { classifyEventType, type WeatherSnapshot } from "@/lib/weatherEventMatrix";
import { track } from "@/lib/analytics";

type StoredRecommendationContext = {
  weather?: { high: number; low: number; precipitation_in: number; wind_mph: number; condition: string };
  today?: string;
};

// PATCH updates a recommendation's outcome. When outcome is "worn", also writes
// the chosen outfit's items to outfit_logs — the learning signal for future recs.
// Also triggers preference analysis to update the user's learned profile.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  const { outcome, itemDisplayIds } = await req.json();

  if (!["worn", "skipped", "modified"].includes(outcome)) {
    return NextResponse.json({ error: "invalid outcome" }, { status: 400 });
  }

  await pool.query(
    `UPDATE recommendations SET outcome = $1 WHERE id = $2 AND user_id = $3`,
    [outcome, params.id, userId]
  );

  if (outcome === "worn" && Array.isArray(itemDisplayIds) && itemDisplayIds.length > 0) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM items WHERE user_id = $1 AND display_id = ANY($2)`,
      [userId, itemDisplayIds]
    );
    const itemIds = rows.map((r) => r.id);
    if (itemIds.length > 0) {
      // The recommendation's own context already captured weather + calendar
      // at the moment it was generated — reuse that snapshot rather than
      // re-fetching, and normalize field names into the shape the weather x
      // event-type matrix expects (see weatherEventMatrix.ts).
      const { rows: recRows } = await pool.query<{ context: StoredRecommendationContext }>(
        `SELECT context FROM recommendations WHERE id = $1 AND user_id = $2`,
        [params.id, userId]
      );
      const context = recRows[0]?.context;
      const w = context?.weather;
      const weatherSnapshot: WeatherSnapshot | null = w
        ? {
            tempLowF: w.low,
            tempHighF: w.high,
            precipitationSumIn: w.precipitation_in,
            windMaxMph: w.wind_mph,
            condition: w.condition,
          }
        : null;
      const occasion = classifyEventType(context?.today ?? null);

      await pool.query(
        `INSERT INTO outfit_logs (user_id, item_ids, source, weather_snapshot, occasion)
         VALUES ($1, $2, 'recommended', $3, $4)`,
        [userId, itemIds, weatherSnapshot ? JSON.stringify(weatherSnapshot) : null, occasion]
      );

      track(userId, "outfit_logged", { source: "recommended" });

      // Trigger preference analysis in the background
      // Don't await — let it run async so response is fast
      analyzeUserBehavior(userId).catch((err) =>
        console.error("[API] Background preference analysis failed:", err)
      );
    }
  }

  return NextResponse.json({ ok: true });
}
