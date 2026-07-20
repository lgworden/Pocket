import pool from "./db";
import { getCurrentUser } from "./auth";
import { buildRecommendationContext } from "./recommendationContext";
import { getRecommendations } from "./anthropic";
import { attachSketchesToOutfits } from "./sketch";
import type { TodayWeather } from "./weather";

// Shared by the interactive "Get outfits" button (app/api/recommendations/route.ts)
// and the daily-digest cron job — both just assemble context, call Claude, and
// persist the same way.
export async function generateAndSaveRecommendation(
  userId: string,
  dayText: string
): Promise<{
  id: string;
  outfits: unknown[];
  gap_question: string | null;
  weather: TodayWeather;
  calendarEvents: string[] | null;
}> {
  const { context, weather, calendarEvents } = await buildRecommendationContext(userId, dayText);

  const user = await getCurrentUser();
  const displayName = user.display_name || user.name;

  const result = await getRecommendations(context as unknown as Record<string, unknown>, displayName);

  // Attach each item's stored sketch (null if none) so recommendation cards can
  // show the croquis alongside the display_id/name.
  const outfitsWithSketches = await attachSketchesToOutfits(userId, result.outfits ?? []);
  const persisted = { ...result, outfits: outfitsWithSketches };

  const { rows } = await pool.query(
    `INSERT INTO recommendations (user_id, context, options)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, JSON.stringify(context), JSON.stringify(persisted)]
  );

  return {
    id: rows[0].id,
    outfits: outfitsWithSketches,
    gap_question: result.gap_question ?? null,
    weather,
    calendarEvents,
  };
}
