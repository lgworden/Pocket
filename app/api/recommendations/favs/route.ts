import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import { pickFavoriteOutfit } from "@/lib/shuffleFavs";
import { attachSketchesToOutfits } from "@/lib/sketch";

// "Shuffle favs" — recommends an outfit pulled straight from outfit_logs
// history (never a freshly generated combo), picked to fit today's weather
// and plans. Persists to the same `recommendations` table as the Claude-driven
// flow so the existing "wore it" / outcome tracking in
// app/api/recommendations/[id]/route.ts works unchanged.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { dayText, excludeLogIds } = await req.json();

  const { outfit, weather, today } = await pickFavoriteOutfit(
    userId,
    dayText ?? "",
    Array.isArray(excludeLogIds) ? excludeLogIds : []
  );

  if (!outfit) {
    return NextResponse.json({ id: null, outfits: [], gap_question: null, empty: true });
  }

  const context = {
    weather: {
      high: weather.tempHighF,
      low: weather.tempLowF,
      precipitation_in: weather.precipitationSumIn,
      wind_mph: weather.windMaxMph,
      condition: weather.condition,
      location: weather.label,
    },
    today,
  };

  const [outfitWithSketches] = await attachSketchesToOutfits(userId, [outfit]);

  const { rows } = await pool.query(
    `INSERT INTO recommendations (user_id, context, options)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, JSON.stringify(context), JSON.stringify({ outfits: [outfitWithSketches], gap_question: null })]
  );

  return NextResponse.json({
    id: rows[0].id,
    outfits: [outfitWithSketches],
    gap_question: null,
    logId: outfit.logId,
  });
}
