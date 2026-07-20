import pool from "./db";

export interface UserPreferenceAnalysis {
  top_worn_items: Array<{
    item_id: string;
    display_id: string;
    name: string;
    wear_count: number;
    last_worn: string;
  }>;
  top_worn_colors: string[];
  top_worn_occasions: string[];
  top_worn_categories: string[];
  frequently_skipped_colors: string[];
  frequently_skipped_formality: number[];
  weekday_preferences: Record<string, number>;
  temperature_preferences: Record<string, string>;
  last_updated: string;
}

/**
 * Analyze user behavior and extract preference patterns from outfit history.
 * Called after each outfit is logged as 'worn' outcome.
 */
export async function analyzeUserBehavior(userId: string): Promise<void> {
  try {
    // Call the SQL function to refresh preferences
    await pool.query(
      "SELECT refresh_user_preferences($1)",
      [userId]
    );

    // Update item_outcome_tracking for items in recent outfits
    await updateItemOutcomeTracking(userId);

    console.log(`[Preferences] Updated learning profile for user ${userId}`);
  } catch (err) {
    console.error(`[Preferences] Error analyzing user behavior:`, err);
    // Don't throw - this is non-critical background work
  }
}

/**
 * Update item_outcome_tracking to track which items were worn vs skipped.
 */
async function updateItemOutcomeTracking(userId: string): Promise<void> {
  // Get items from recent worn outfits
  const wornResult = await pool.query(
    `
    SELECT DISTINCT i.id
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = $1 AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
    `,
    [userId]
  );

  for (const row of wornResult.rows) {
    const itemId = row.id;

    // Upsert into item_outcome_tracking
    await pool.query(
      `
      INSERT INTO item_outcome_tracking (user_id, item_id, worn_count, created_at)
      VALUES ($1, $2, 1, now())
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET
        worn_count = item_outcome_tracking.worn_count + 1,
        last_interaction_date = CURRENT_DATE,
        accept_rate = (item_outcome_tracking.worn_count + 1)::numeric /
                      NULLIF(item_outcome_tracking.recommended_count, 0)
      `,
      [userId, itemId]
    );
  }

  // Track skipped recommendations
  const skippedResult = await pool.query(
    `
    SELECT DISTINCT jsonb_path_query_array(r.options, '$..[*].items[*].display_id')::text as display_id
    FROM recommendations r
    WHERE r.user_id = $1
      AND r.outcome = 'skipped'
      AND r.date >= CURRENT_DATE - INTERVAL '30 days'
    `,
    [userId]
  );

  for (const row of skippedResult.rows) {
    const displayId = row.display_id;

    // Find item by display_id
    const itemResult = await pool.query(
      "SELECT id FROM items WHERE user_id = $1 AND display_id = $2",
      [userId, displayId]
    );

    if (itemResult.rows.length > 0) {
      const itemId = itemResult.rows[0].id;

      // Upsert into item_outcome_tracking
      await pool.query(
        `
        INSERT INTO item_outcome_tracking (user_id, item_id, skipped_count, created_at)
        VALUES ($1, $2, 1, now())
        ON CONFLICT (user_id, item_id)
        DO UPDATE SET
          skipped_count = item_outcome_tracking.skipped_count + 1,
          last_interaction_date = CURRENT_DATE
        `,
        [userId, itemId]
      );
    }
  }
}

/**
 * Fetch the current preference analysis for a user.
 */
export async function getUserPreferenceAnalysis(
  userId: string
): Promise<UserPreferenceAnalysis | null> {
  const result = await pool.query(
    `
    SELECT
      top_worn_items,
      top_worn_colors,
      top_worn_occasions,
      top_worn_categories,
      frequently_skipped_colors,
      frequently_skipped_formality,
      weekday_preferences,
      temperature_preferences,
      last_updated
    FROM user_preference_analysis
    WHERE user_id = $1
    `,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Get item acceptance metrics for a specific item.
 */
export async function getItemAcceptanceMetrics(
  userId: string,
  itemId: string
): Promise<{
  worn_count: number;
  skipped_count: number;
  recommended_count: number;
  accept_rate: number | null;
} | null> {
  const result = await pool.query(
    `
    SELECT worn_count, skipped_count, recommended_count, accept_rate
    FROM item_outcome_tracking
    WHERE user_id = $1 AND item_id = $2
    `,
    [userId, itemId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}
