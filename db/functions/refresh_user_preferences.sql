-- Function to refresh user preference analysis based on recent outfit history
-- Called after outfit_logs are updated with 'worn' outcomes

CREATE OR REPLACE FUNCTION refresh_user_preferences(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_top_colors TEXT[];
  v_top_occasions TEXT[];
  v_top_categories TEXT[];
  v_top_items JSONB;
  v_skipped_colors TEXT[];
  v_skipped_formality INT[];
  v_weekday_prefs JSONB;
  v_temp_prefs JSONB;
BEGIN
  -- Extract top worn colors from outfit_logs (last 30 days, recent-heavy)
  -- Recent 7 days weighted 3x
  WITH color_frequency AS (
    SELECT
      unnest(i.colors) AS color,
      CASE
        WHEN ol.date >= CURRENT_DATE - INTERVAL '7 days' THEN 3
        ELSE 1
      END AS weight
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = p_user_id
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
  )
  SELECT ARRAY_AGG(DISTINCT color ORDER BY color)
  INTO v_top_colors
  FROM color_frequency
  GROUP BY color
  ORDER BY SUM(weight) DESC
  LIMIT 10;

  -- Extract top worn occasions
  WITH occasion_frequency AS (
    SELECT
      unnest(i.occasions) AS occasion,
      CASE
        WHEN ol.date >= CURRENT_DATE - INTERVAL '7 days' THEN 3
        ELSE 1
      END AS weight
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = p_user_id
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
      AND i.occasions IS NOT NULL
  )
  SELECT ARRAY_AGG(DISTINCT occasion ORDER BY occasion)
  INTO v_top_occasions
  FROM (
    SELECT occasion, SUM(weight) as freq
    FROM occasion_frequency
    GROUP BY occasion
    ORDER BY freq DESC
    LIMIT 10
  ) subq;

  -- Extract top worn categories
  WITH category_frequency AS (
    SELECT
      i.category,
      CASE
        WHEN ol.date >= CURRENT_DATE - INTERVAL '7 days' THEN 3
        ELSE 1
      END AS weight
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = p_user_id
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
  )
  SELECT ARRAY_AGG(DISTINCT category ORDER BY category)
  INTO v_top_categories
  FROM (
    SELECT category, SUM(weight) as freq
    FROM category_frequency
    GROUP BY category
    ORDER BY freq DESC
    LIMIT 10
  ) subq;

  -- Extract top worn items with wear counts
  WITH item_frequency AS (
    SELECT
      i.id,
      i.display_id,
      i.name,
      COUNT(*) as wear_count,
      MAX(ol.date) as last_worn
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = p_user_id
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY i.id, i.display_id, i.name
    ORDER BY wear_count DESC
    LIMIT 15
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_id', id,
      'display_id', display_id,
      'name', name,
      'wear_count', wear_count,
      'last_worn', last_worn
    )
  )
  INTO v_top_items
  FROM item_frequency;

  -- Extract frequently skipped colors (from recommendations with outcome='skipped')
  WITH skipped_colors AS (
    SELECT
      unnest(i.colors) AS color
    FROM recommendations r
    JOIN jsonb_to_recordset(r.options) AS opts(items jsonb) ON true
    JOIN jsonb_to_recordset(opts.items) AS it(display_id text, name text) ON true
    JOIN items i ON i.display_id = it.display_id
    WHERE r.user_id = p_user_id
      AND r.outcome = 'skipped'
      AND r.date >= CURRENT_DATE - INTERVAL '30 days'
  )
  SELECT ARRAY_AGG(DISTINCT color ORDER BY color)
  INTO v_skipped_colors
  FROM (
    SELECT color, COUNT(*) as skip_count
    FROM skipped_colors
    GROUP BY color
    ORDER BY skip_count DESC
    LIMIT 5
  ) subq;

  -- Extract weekday preferences (formality by day)
  WITH weekday_formality AS (
    SELECT
      to_char(ol.date, 'Day') as day_name,
      AVG(i.formality::numeric) as avg_formality
    FROM outfit_logs ol
    JOIN items i ON i.id = ANY(ol.item_ids)
    WHERE ol.user_id = p_user_id
      AND ol.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY to_char(ol.date, 'Day')
  )
  SELECT jsonb_object_agg(day_name, ROUND(avg_formality::numeric, 1))
  INTO v_weekday_prefs
  FROM weekday_formality;

  -- Update the user_preference_analysis record
  UPDATE user_preference_analysis
  SET
    top_worn_items = COALESCE(v_top_items, '[]'::jsonb),
    top_worn_colors = COALESCE(v_top_colors, '{}'),
    top_worn_occasions = COALESCE(v_top_occasions, '{}'),
    top_worn_categories = COALESCE(v_top_categories, '{}'),
    frequently_skipped_colors = COALESCE(v_skipped_colors, '{}'),
    weekday_preferences = COALESCE(v_weekday_prefs, '{}'::jsonb),
    last_updated = now()
  WHERE user_id = p_user_id;

END;
$$ LANGUAGE plpgsql;
