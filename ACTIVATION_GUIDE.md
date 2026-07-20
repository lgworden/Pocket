# Personalized AI Learning System - Activation Guide

## 🚀 Quick Start

The personalized learning system is fully implemented. Activate it with these steps:

### Step 1: Apply Database Migrations

Run the migration script to create the new tables and functions:

```bash
npm run db:migrate
```

This will:
- Create `user_preference_analysis` table — stores learned preferences
- Create `item_outcome_tracking` table — tracks item wear rates
- Create `refresh_user_preferences()` function — extracts patterns from outfit history
- Initialize preference analysis for all users

### Step 2: Test the Learning Loop

1. **Add items to your closet** (at least 5-10 items with diverse colors/formality)
   - Go to Add Item, capture photos
   - Include variety: bold and neutral colors, different formality levels

2. **Get recommendations**
   - Go to Stylist page
   - Enter your day plan
   - Get outfit suggestions

3. **Mark outfits as "Wore it"**
   - Click "Wore it" on recommendations you'd actually wear
   - Background analysis starts automatically

4. **Check learned preferences** (after 3+ wears)
   ```bash
   # In your database:
   SELECT top_worn_colors, top_worn_occasions, weekday_preferences
   FROM user_preference_analysis
   WHERE user_id = 'your-user-id';
   ```

5. **See personalized recommendations**
   - Get 3-5 more recommendations after wearing items
   - Claude should now include personalized system message
   - Notice Claude references your trusted items and favorite colors

---

## 📊 What the System Learns

After each outfit you mark as "worn", the system extracts:

| What It Learns | Example |
|---|---|
| **Top worn colors** | You love warm colors (rust, ochre, cream) |
| **Top occasions** | You wear "workwear" 70%, "casual" 30% |
| **Formality preference** | You typically wear business-casual (level 3) |
| **Day-of-week patterns** | Mondays: formal (level 4), Fridays: casual (level 2) |
| **Temperature dressing** | You tend to dress warmer than average |
| **Trusted items** | TOP-0042, SHOE-0007 (worn 3+ times each) |
| **Skipped patterns** | Avoid neon colors, very high formality |

---

## 🎯 How Personalization Works

### Before Learning (First Few Days)
- Generic recommendations based on weather/calendar
- No personalized system message
- Confidence: LOW

### During Learning (Days 1-2 Weeks)
- System extracts patterns from 3-10 wears
- Personalization starts: "You love warm tones, prefer casual formality..."
- Confidence: MEDIUM
- Claude prioritizes: trusted items, favorite colors, matching formality

### After Learning (2+ Weeks)
- Rich preference profile with 20+ data points
- Confidence: HIGH
- Claude: "Your top items: TOP-0042, SHOE-0007. Your style is becoming bolder. You prefer warm colors 80% of the time."
- Recommendations skew toward what you actually wear

---

## 🔍 Monitoring Learning Progress

### Check Confidence Level
```sql
SELECT
  data_points,
  confidence_level,
  last_updated
FROM user_preference_analysis
WHERE user_id = 'your-user-id';
```

**Interpreting results:**
- `data_points < 3` → `LOW` — not enough data yet, generic recommendations
- `data_points 3-10` → `MEDIUM` — learning, personalization emerging
- `data_points > 10` → `HIGH` — rich profile, strong personalization

### View Learned Profile
```sql
SELECT
  top_worn_colors,
  top_worn_occasions,
  top_worn_categories,
  frequently_skipped_colors,
  weekday_preferences
FROM user_preference_analysis
WHERE user_id = 'your-user-id';
```

### Check Item Trust Metrics
```sql
SELECT
  i.display_id,
  i.name,
  iot.worn_count,
  iot.skipped_count,
  ROUND((iot.worn_count::numeric / NULLIF(iot.recommended_count, 0)) * 100, 1) as accept_rate_pct
FROM item_outcome_tracking iot
JOIN items i ON i.id = iot.item_id
WHERE iot.user_id = 'your-user-id'
ORDER BY iot.worn_count DESC
LIMIT 10;
```

---

## 🔄 The Learning Loop in Action

```
User wears outfit
    ↓
PATCH /api/recommendations/[id] { outcome: "worn" }
    ↓
API writes to outfit_logs
    ↓
Background: analyzeUserBehavior(userId) triggers
    ↓
SQL function: refresh_user_preferences() extracts patterns
    ↓
user_preference_analysis table updates with:
  - top_worn_colors (last 30 days, recent 3x weighted)
  - top_worn_occasions
  - weekday_preferences
  - temperature_dressing_preference
    ↓
Next recommendation request
    ↓
buildLearnedUserProfile() combines explicit + implicit preferences
    ↓
Claude receives personalized system message:
  "You're styling [User], they love [colors],
   prefer [formality], trust these items: [items]..."
    ↓
Recommendations get smarter & more personal
```

---

## ⚙️ Configuration

### Adjust Learning Window
By default, the system weights the last 7 days 3x more heavily.

To change this, edit `db/functions/refresh_user_preferences.sql`:

```sql
-- Current: last 7 days weighted 3x
CASE
  WHEN ol.date >= CURRENT_DATE - INTERVAL '7 days' THEN 3
  ELSE 1
END AS weight
```

Change to:
```sql
-- Example: last 14 days weighted 2x
CASE
  WHEN ol.date >= CURRENT_DATE - INTERVAL '14 days' THEN 2
  ELSE 1
END AS weight
```

Then re-run migrations.

### Confidence Threshold
Currently, personalization starts at `MEDIUM` confidence (3+ wears).

To require more data before personalization:
- Edit `lib/learnedProfileBuilder.ts` → `buildLearnedUserProfile()`
- Change: `if (profile.confidence_level === "low")` to require "medium" or "high"

---

## 🧪 Example: The First Week

### Day 1-2: Building Data
- Add 10 items (5 warm colors, 5 cool colors; mix of formality levels)
- Get 5 recommendations
- Wear 2-3 outfits (mark as "Wore it")
- Learning system extracts initial patterns

**Result:** System notices you wore 2 warm-colored outfits → starts favoring warm tones

### Day 3-5: Personalization Emerges
- Get 5 more recommendations
- Notice: top items include the ones you wore → Claude prioritizes them
- Wear 2-3 more outfits
- System learns your weekday vs. weekend preferences

**Result:** Monday recommendations favor formal items you wore; Friday recommendations suggest casual

### Week 2+: Smart Stylist
- Get recommendations that feel "right"
- Claude explains: "Wearing TOP-0042 because you've worn it 4 times and loved it every time"
- System avoids colors you've never picked
- Treats you like a known style preference, not a stranger

---

## 🚨 Troubleshooting

### Recommendations Still Generic?
**Check:** Has migration run?
```bash
npm run db:migrate
```

**Check:** Confidence level too low?
```sql
SELECT confidence_level, data_points
FROM user_preference_analysis
WHERE user_id = 'your-user-id';
```
→ Need 3+ outfits logged as "worn" for personalization

### Missing Personalized Message?
**Check:** Is `learned_profile` being built?
```sql
SELECT last_updated FROM user_preference_analysis
WHERE user_id = 'your-user-id';
```
→ Should update after every "Wore it"

### Personalization But No Improvement?
**Check:** Are recommendations matching learned preferences?
```sql
SELECT top_worn_colors FROM user_preference_analysis
WHERE user_id = 'your-user-id';
```
→ Compare with outfit recommendations; Claude should favor these colors

---

## 📋 Success Metrics

After 2-3 weeks of regular use, verify:

- [ ] Confidence level: HIGH (10+ wears)
- [ ] Worn outfit recommendations increase acceptance rate
- [ ] Claude references specific learned patterns ("You love warm tones")
- [ ] Top items appear in 50%+ of recommendations
- [ ] Skipped colors disappear from suggestions
- [ ] Monday recommendations differ from Friday (if patterns exist)

---

## 🔐 Privacy & Data

✅ **All data stays private & user-specific:**
- Learning analysis is per-user_id (database-level partition)
- Claude sees only that user's profile, closet, and calendar
- No cross-user data leakage
- No centralized models or shared embeddings
- Pattern extraction is deterministic SQL (no ML, no blackbox)

---

## 📞 Next Steps

- [ ] Run `npm run db:migrate`
- [ ] Add 5-10 items to closet
- [ ] Get & wear 3-5 recommended outfits
- [ ] Monitor learning progress with SQL queries above
- [ ] Enjoy increasingly personalized recommendations! 🎉

---

## 💡 Implementation Notes

For deeper technical details, see `IMPLEMENTATION_NOTES.md`:
- Architecture decisions
- File changes summary
- Performance considerations
- Future enhancements (Phase 4+)
