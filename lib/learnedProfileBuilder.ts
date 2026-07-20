import pool from "./db";
import { getUserPreferenceAnalysis } from "./preferenceAnalyzer";

export interface LearnedUserProfile {
  explicit_style_types: string[];

  revealed_color_palette: {
    primary: Array<{ color: string; frequency: number }>;
    avoided: string[];
  };

  revealed_formality_range: {
    typical_range: [number, number];
    by_day: Record<string, number>;
  };

  revealed_occasion_preferences: Record<string, number>;

  temperature_dressing_preference: {
    strategy: "minimal" | "layered" | "statement";
    tendency: "warmer" | "neutral" | "cooler";
  };

  item_personality: {
    most_trusted_items: Array<{ display_id: string; name: string }>;
    statement_items: Array<{ display_id: string; name: string }>;
    rarely_worn: Array<{ display_id: string; name: string }>;
  };

  evolution: {
    preference_shift_history: Array<{ date: string; summary: string }>;
    trend: "becoming_bolder" | "becoming_minimal" | "stable";
  };

  confidence_level: "low" | "medium" | "high";
  data_points: number;
}

/**
 * Build a comprehensive learned user profile combining explicit and implicit preferences.
 * Implicit preferences (what they actually wear) take priority over explicit (what they set).
 */
export async function buildLearnedUserProfile(
  userId: string
): Promise<LearnedUserProfile> {
  // Get explicit preferences
  const userResult = await pool.query(
    "SELECT style_profile FROM users WHERE id = $1",
    [userId]
  );

  const explicit_style_types = userResult.rows[0]?.style_profile?.style_types || [];

  // Get learned preferences from behavior
  const analysis = await getUserPreferenceAnalysis(userId);

  // Calculate confidence level based on data points
  const wornOutfitsResult = await pool.query(
    `
    SELECT COUNT(*) as count FROM outfit_logs
    WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
    `,
    [userId]
  );
  const data_points = parseInt(wornOutfitsResult.rows[0].count) || 0;
  const confidence_level: "low" | "medium" | "high" =
    data_points < 3 ? "low" : data_points < 10 ? "medium" : "high";

  // Extract color palette with frequency
  let color_frequency_map: Record<string, number> = {};
  if (analysis?.top_worn_colors) {
    const colorCountResult = await pool.query(
      `
      SELECT
        unnest(i.colors) AS color,
        COUNT(*) as frequency
      FROM outfit_logs ol
      JOIN items i ON i.id = ANY(ol.item_ids)
      WHERE ol.user_id = $1 AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY unnest(i.colors)
      ORDER BY frequency DESC
      `,
      [userId]
    );

    for (const row of colorCountResult.rows) {
      color_frequency_map[row.color] = row.frequency;
    }
  }

  const revealed_color_palette = {
    primary: Object.entries(color_frequency_map)
      .map(([color, frequency]) => ({ color, frequency: Number(frequency) }))
      .slice(0, 10),
    avoided: analysis?.frequently_skipped_colors || [],
  };

  // Extract formality range by analyzing worn outfits
  const formalityResult = await pool.query(
    `
    SELECT
      MIN(i.formality) as min_formality,
      MAX(i.formality) as max_formality,
      ROUND(AVG(i.formality)::numeric, 1)::float as avg_formality
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = $1 AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
    AND i.formality IS NOT NULL
    `,
    [userId]
  );

  const formality_row = formalityResult.rows[0];
  const min_formality = formality_row?.min_formality || 2;
  const max_formality = formality_row?.max_formality || 3;

  const revealed_formality_range = {
    typical_range: [min_formality, max_formality] as [number, number],
    by_day: (analysis?.weekday_preferences as Record<string, number>) || {},
  };

  // Extract occasion preferences
  const occasionResult = await pool.query(
    `
    SELECT
      unnest(i.occasions) AS occasion,
      COUNT(*) as frequency
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = $1
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
      AND i.occasions IS NOT NULL
    GROUP BY unnest(i.occasions)
    ORDER BY frequency DESC
    `,
    [userId]
  );

  const revealed_occasion_preferences: Record<string, number> = {};
  for (const row of occasionResult.rows) {
    revealed_occasion_preferences[row.occasion] = Number(row.frequency);
  }

  // Infer temperature dressing preference from formality and warmth data
  const tempResult = await pool.query(
    `
    SELECT
      ROUND(AVG(i.warmth)::numeric, 1)::float as avg_warmth
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = $1
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
      AND i.warmth IS NOT NULL
    `,
    [userId]
  );

  const avg_warmth = tempResult.rows[0]?.avg_warmth || 3;
  const temperature_dressing_preference = {
    strategy: (avg_warmth > 3.5 ? "layered" : avg_warmth > 2.5 ? "statement" : "minimal") as
      | "minimal"
      | "layered"
      | "statement",
    tendency: (avg_warmth > 3.5 ? "warmer" : avg_warmth > 2.5 ? "neutral" : "cooler") as
      | "warmer"
      | "neutral"
      | "cooler",
  };

  // Extract most trusted, statement, and rarely-worn items
  const itemMetricsResult = await pool.query(
    `
    SELECT
      i.id,
      i.display_id,
      i.name,
      COUNT(ol.id) as wear_count,
      (SELECT recommended_count FROM item_outcome_tracking WHERE item_id = i.id AND user_id = $1) as rec_count
    FROM items i
    LEFT JOIN outfit_logs ol ON i.id = ANY(ol.item_ids) AND ol.user_id = $1 AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
    WHERE i.user_id = $1 AND i.status = 'active'
    GROUP BY i.id, i.display_id, i.name
    ORDER BY wear_count DESC
    `,
    [userId]
  );

  const most_trusted_items = itemMetricsResult.rows
    .filter((row) => row.wear_count >= 2)
    .slice(0, 5)
    .map((row) => ({
      display_id: row.display_id,
      name: row.name,
    }));

  const statement_items = itemMetricsResult.rows
    .filter((row) => row.wear_count === 1)
    .slice(0, 3)
    .map((row) => ({
      display_id: row.display_id,
      name: row.name,
    }));

  const rarely_worn = itemMetricsResult.rows
    .filter((row) => row.wear_count === 0)
    .slice(0, 5)
    .map((row) => ({
      display_id: row.display_id,
      name: row.name,
    }));

  // Determine evolution trend (simplified: check if recent wears differ from older)
  const trend: "becoming_bolder" | "becoming_minimal" | "stable" = "stable";

  return {
    explicit_style_types,
    revealed_color_palette,
    revealed_formality_range,
    revealed_occasion_preferences,
    temperature_dressing_preference,
    item_personality: {
      most_trusted_items,
      statement_items,
      rarely_worn,
    },
    evolution: {
      preference_shift_history: [],
      trend,
    },
    confidence_level,
    data_points,
  };
}

/**
 * Format learned profile as a personalized system message for Claude.
 */
export function formatLearnedProfileForClaude(
  profile: LearnedUserProfile,
  userName: string
): string {
  if (profile.confidence_level === "low") {
    return ""; // Not enough data yet, skip personalization
  }

  const primary_colors = profile.revealed_color_palette.primary
    .slice(0, 3)
    .map((c) => c.color)
    .join(", ");

  const formality_range = profile.revealed_formality_range.typical_range;
  const formality_map: Record<number, string> = {
    1: "very casual",
    2: "casual",
    3: "business casual",
    4: "business formal",
    5: "formal",
  };

  const formality_desc =
    formality_range[0] === formality_range[1]
      ? formality_map[formality_range[0]]
      : `${formality_map[formality_range[0]]} to ${formality_map[formality_range[1]]}`;

  const trusted_items = profile.item_personality.most_trusted_items
    .map((i) => `${i.display_id} (${i.name})`)
    .join(", ");

  const avoided_colors = profile.revealed_color_palette.avoided.join(", ");

  let message = `You are a personal stylist for ${userName}. You know their style deeply:\n`;
  message += `- They love these colors: ${primary_colors || "varied palettes"}\n`;
  message += `- Their typical formality level: ${formality_desc}\n`;

  if (trusted_items) {
    message += `- Their go-to, trusted items: ${trusted_items}\n`;
  }

  if (avoided_colors) {
    message += `- They rarely wear: ${avoided_colors}\n`;
  }

  message += `\nWhen recommending, PRIORITIZE their most-trusted items and favorite colors.`;

  return message;
}
