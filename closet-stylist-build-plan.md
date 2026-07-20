# Closet Stylist — Build Plan
*Working title: TBD (she deserves a name)*
*Prepared July 2026*

## The Concept

A personal AI stylist that kills morning decision fatigue. She knows the weather, knows your day, knows every piece in your closet, and recommends 2–3 complete outfits with reasoning. Behind the charm is a data layer: every item has an ID, provenance, and wear history, which powers gamified badges, cost-per-wear stats, and shareable outfit cards. Built single-player, architected for friends to join later.

## Product Principles

1. **The app never nags.** Photos, logging, and details are rewarded, not required.
2. **The closet grows conversationally.** No data-entry marathon; the inventory converges on reality through gap-fill questions during recommendations and gap-detection when logging outfits.
3. **Every fun feature is a query.** Badges, streaks, and stats are questions asked of data collected as a side effect of normal use — never a separate chore.
4. **Single-player now, multiplayer bones.** Every record hangs off a user ID from day one. Social is an unlock, not a rewrite.

## Tech Stack

Responsive web app (phone-first — the 7am-in-front-of-the-closet moment is the whole app), deployed on Railway like Rainier Bound. Suggested stack: a lightweight Node/Express or Next.js backend, Postgres on Railway (better than SQLite here because multi-user is on the roadmap and Railway makes Postgres trivial), image storage via Railway volume or an S3-compatible bucket, and the Anthropic API for item auto-tagging, outfit recommendations, and vision-board analysis. Weather via Open-Meteo (free, no API key).

## Data Model

Six core tables. Everything references `users` from day one, even while it has one row.

```sql
users
  id, name, email, created_at
  location            -- for weather (DC)
  style_profile       -- JSON from onboarding questionnaire

items
  id                  -- internal PK
  display_id          -- human-readable, visible in UI: TOP-0042, SHOE-0007
  user_id
  name                -- "black ribbed turtleneck"
  category            -- top / bottom / dress / outerwear / shoes / accessory
  subcategory         -- turtleneck, midi skirt, ankle boot...
  occasions[]         -- workwear, casual, going-out, athletic, lounge
  tags[]              -- free-form vibe words: "structured", "the good jeans"
  colors[]            -- primary + secondary
  warmth              -- 1–5, what the weather API talks to
  formality           -- 1–5
  seasons[]
  provenance          -- thrifted / retail / gifted / secondhand / handmade
  cost                -- optional; powers cost-per-wear
  status              -- active / archived / donated
  date_added, photos[]

outfit_logs
  id, user_id, date
  item_ids[]          -- required
  photo               -- optional mirror pic
  occasion, weather_snapshot
  source              -- accepted a rec / self-styled
  visibility          -- private (default) / shared
  notes

recommendations
  id, user_id, date
  context             -- weather + day summary + any mood input
  options             -- JSON: the 2–3 outfits proposed with reasoning
  outcome             -- worn / skipped / modified  ← the learning signal

badges
  id, user_id, badge_type, earned_date, context

vision_boards
  id, user_id, season, year
  images[]
  style_direction     -- Claude's distilled read of the board, feeds recs
```

Wear count and last-worn per item are computed from `outfit_logs`, never stored redundantly.

## Screens (v1)

- **Today** — the home screen. Weather strip, "what's your day?" text box, then 2–3 recommended outfits as cards showing the actual item photos with one-line reasoning. Wore it / show me another / skip.
- **Closet** — grid of items, filterable by category, occasion, color, provenance, status. Tap into an item for its detail page: photo, display ID, all fields, wear history, cost-per-wear.
- **Add item** — camera-first. Snap → Claude drafts name, category, colors, warmth, formality, occasions → you confirm and pick provenance. Target: under 15 seconds per item.
- **Log outfit** — tap the items you wore (photo optional). If an item isn't in the closet, "I don't know this piece — add it?"
- **Stats & badges** — wear streaks, closet utilization, cost-per-wear leaders, provenance breakdown, badge shelf, monthly recap.
- **Profile** — onboarding questionnaire answers, editable anytime.

Phase 4 adds a **Vision board** screen; Phase 5 adds calendar autofill and share settings.

## The Recommendation Prompt (draft)

Sent to the Anthropic API each morning or on demand:

```
You are [NAME], a personal stylist. Recommend outfits from the user's
actual closet — never suggest items they don't own, except as a single
optional "gap" question at the end.

STYLE PROFILE: {style_profile JSON}
SEASONAL DIRECTION: {current vision_board.style_direction, if any}
WEATHER: {high/low, precipitation, wind — from Open-Meteo}
TODAY: {user's typed-in day summary and any mood input}
RECENTLY WORN (last 14 days): {item display_ids from outfit_logs}
CLOSET: {active items pre-filtered by season and weather-appropriate
warmth, as JSON}

Rules:
- Propose 2–3 complete outfits (top/bottom or dress, shoes, outerwear
  if temp warrants, one optional accessory).
- Reference items by display_id and name.
- One sentence of reasoning per outfit tying it to the weather and the
  day's activities.
- Avoid exact-outfit repeats from the last 14 days; favor under-worn
  items when appropriate ("shopping your closet").
- Respect formality: infer required formality from the day summary.
- Optionally end with ONE gap-fill question ("Do you own white
  sneakers? They'd unlock a lot here.").
Respond only in JSON: { outfits: [...], gap_question: string|null }
```

The `recommendations.outcome` field closes the loop: accepted and skipped outfits get fed back into the style profile over time.

## Gamification (all queries, no new chores)

Fresh Rotation (3+ items worn for the first time this week), Full Thrift (head-to-toe thrifted/secondhand outfit), Closet Shopper (30 days with no exact-outfit repeat), Deep Cut (wore something untouched for 90+ days), Cost-Per-Wear Champion (an item crosses under $5/wear), Streaks (consecutive days logged), and a Monthly Wrapped recap (most-worn item, color of the month, provenance pie, closet utilization %). Badge logic runs as simple queries after each outfit log.

## Share Cards (the social bridge)

Any logged outfit renders into a designed card — item photos, display IDs if you want them, the badge earned, "100% thrifted" — exportable as an image to text or post anywhere. This delivers the influencer moment in v1 and doubles as the on-ramp for the eventual multi-user version, where `visibility: shared` outfits become a friends feed.

## Build Phases

**Phase 1 — Closet.** Auth (single user), items table, camera-first add flow with AI auto-tagging, closet grid and item detail. *Exit test: catalog 30 items in one evening without hating it.*

**Phase 2 — Recommendations + logging.** Weather integration, day text box, recommendation engine, outfit logging with gap-detection. *Exit test: you consult it every morning for a week.*

**Phase 3 — Style profile + stats.** Onboarding questionnaire (informed by what you found yourself vetoing in Phase 2), badges, stats screen, monthly recap.

**Phase 4 — Vision boards + share cards.** Seasonal boards (upload-based), Claude distills style direction into recs, share card renderer.

**Phase 5 — Integrations + friends.** Google Calendar autofill; Pinterest via data export or pasted board URLs (official API approval is a stretch goal, not a dependency); then multi-user: invites, friends feed of shared outfits, privacy controls.

## Open Decisions

The app's name. Whether cost is entered at add-time or skippable forever (recommend: skippable, badge-gated incentive to fill it in). Whether the Today screen supports a "mood" input alongside the day summary (recommend: yes, one optional free-text field). Photo storage budget — item photos should be compressed client-side before upload.
