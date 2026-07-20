# Personalized AI Learning System - Implementation Complete

## Summary

Successfully implemented a user-specific learning system that personalizes Claude AI recommendations based on user behavior and preferences.

---

## What Was Built

### Phase 1: Database Schema ✅

**Files Created:**
- `db/002_add_user_preference_analysis.sql` — Two new tables:
  - `user_preference_analysis` — Stores learned preferences (top colors, occasions, formality ranges, etc.)
  - `item_outcome_tracking` — Tracks which items were worn vs. skipped in recommendations

**Files Created:**
- `db/functions/refresh_user_preferences.sql` — SQL function that extracts preference patterns from outfit history

**Status:** Schema files created. Need to run migration:
```bash
npm run db:migrate
```

---

### Phase 2: Backend Logic ✅

**Files Created:**
- `lib/preferenceAnalyzer.ts` — Core functions:
  - `analyzeUserBehavior(userId)` — Extracts patterns from outfit_logs and updates user_preference_analysis
  - `getUserPreferenceAnalysis(userId)` — Fetches learned preferences for a user
  - `getItemAcceptanceMetrics(userId, itemId)` — Tracks wear rates for individual items

- `lib/learnedProfileBuilder.ts` — Advanced functions:
  - `buildLearnedUserProfile(userId)` — Combines explicit preferences with revealed behavior patterns
  - `formatLearnedProfileForClaude(profile, userName)` — Formats learned profile as personalized system message

**Key Features:**
- Implicit preferences (actual wear) override explicit preferences (what user set)
- Recent-heavy weighting: last 7 days weighted 3x more heavily
- Confidence levels based on data points (low/medium/high)
- Extracts: top colors, occasions, formality ranges, temperature preferences, trusted items, avoided colors

---

### Phase 3: Claude Integration ✅

**Files Updated:**
- `lib/recommendationContext.ts`
  - Added `learned_profile` to RecommendationContext type
  - Builds learned profile on every recommendation request (graceful degradation if not ready)

- `lib/anthropic.ts` → `getRecommendations()`
  - Accepts learned profile
  - Formats it as personalized system message
  - Claude now receives: "You are styling [User], they love [colors], prefer [formality level], their go-to items are [items]"

- `app/api/recommendations/route.ts` → POST handler
  - Passes user's display_name to getRecommendations for personalization

- `app/api/recommendations/[id]/route.ts` → PATCH handler
  - Calls `analyzeUserBehavior()` after marking outfit as "worn"
  - Runs async (non-blocking) to keep response fast

---

## How It Works

### The Learning Loop

1. **User logs an outfit as "worn"**
   ```
   PATCH /api/recommendations/[id]
   { outcome: "worn", itemDisplayIds: ["TOP-0042", "SHOE-0007"] }
   ```

2. **API triggers background analysis**
   ```
   analyzeUserBehavior(userId) — runs async
   ↓
   SQL function refresh_user_preferences() — extracts patterns
   ↓
   Updates user_preference_analysis table
   ```

3. **Next recommendation request**
   ```
   POST /api/recommendations
   ↓
   buildRecommendationContext() — builds learned profile
   ↓
   getRecommendations() — Claude receives personalized system message
   ↓
   Claude: "User loves warm colors, typically wears business casual,
            their most-worn items are [TOP-0042, SHOE-0007]...
            PRIORITIZE these items when recommending."
   ```

---

## Data & Design Decisions

### Implicit Preferences Win
When user sets `style_profile.style_types = ["Minimalist"]` but actually wears bold colors 80% of the time:
- Claude receives revealed preference data (80% bold)
- Implicit preference (behavior) overrides explicit preference (setting)
- System learns what user actually accepts

### Recent-Heavy Weighting
- Last 7 days: weighted 3x
- Older data: weighted 1x
- Allows quick adaptation to mood/seasonal shifts
- Example: user's winter preference for warm colors → spring pivot to cool tones

### User-Specific by Design
- All analysis is scoped to `user_id`
- No cross-user data leakage
- Claude sees only that user's profile + their closet + their calendar
- Fully compliant with privacy requirements

---

## Testing the System

### End-to-End Verification

**Step 1: Add items to closet**
- Add 5-10 diverse items (various colors, formality levels, categories)

**Step 2: Log outfits**
- Get 3-5 recommendations
- Mark 2-3 as "Wore it"
- Let background analysis run

**Step 3: Query learned preferences**
```sql
SELECT top_worn_colors, top_worn_occasions, weekday_preferences
FROM user_preference_analysis
WHERE user_id = 'your-user-id';
```

**Step 4: Generate new recommendation**
- Should include personalized system message
- Should favor trusted items
- Should avoid previously-skipped colors

**Step 5: Monitor confidence growth**
```sql
SELECT COUNT(*) as worn_outfits
FROM outfit_logs
WHERE user_id = 'your-user-id'
  AND date >= CURRENT_DATE - INTERVAL '30 days';
```
- Low: < 3 outfits
- Medium: 3-10 outfits
- High: > 10 outfits

---

## Next Steps

### Immediate (Phase 4)
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Test end-to-end learning loop
- [ ] Verify Claude personalization in recommendations

### Future (Phase 4+)
- [ ] "Why" button to explain learned insights to users
- [ ] Stats dashboard showing preference evolution
- [ ] Confidence indicators ("This is based on your last 15 wears...")
- [ ] Preference trend alerts ("Your style is becoming bolder")

---

## Architecture Notes

### Why This Approach

1. **Async preference analysis** → Keeps API response fast
2. **JSONB storage** → Flexible schema for evolving patterns
3. **SQL function for extraction** → Efficient batch processing on DB side
4. **Learned profile as context** → Claude can use it without fine-tuning
5. **Graceful degradation** → System works even if learning isn't ready yet

### Performance Considerations

- Preference analysis runs async, doesn't block user experience
- Queries use indexes on (user_id) and item_id
- Preference extraction queries look back 30 days (configurable)
- No ML models or embeddings — all pattern extraction is deterministic SQL

---

## File Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| `db/002_add_user_preference_analysis.sql` | NEW | Schema migration |
| `db/functions/refresh_user_preferences.sql` | NEW | Pattern extraction function |
| `lib/preferenceAnalyzer.ts` | NEW | Behavior analysis |
| `lib/learnedProfileBuilder.ts` | NEW | Profile builder + Claude formatter |
| `lib/recommendationContext.ts` | UPDATED | Add learned_profile to context |
| `lib/anthropic.ts` | UPDATED | Use personalized system message |
| `app/api/recommendations/route.ts` | UPDATED | Pass userName to getRecommendations |
| `app/api/recommendations/[id]/route.ts` | UPDATED | Trigger analyzeUserBehavior on worn |
