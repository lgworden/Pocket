# Closet Stylist — Claude Code build brief

This scaffold is set up. Your job is to build it out phase by phase. Full product
spec lives in `closet-stylist-build-plan.md` in the project root — read it first,
it's the source of truth for data model, screens, and the recommendation prompt.

## What's already here
- Next.js 14 (App Router) + TypeScript + Tailwind, configured with the brand's
  design tokens in `tailwind.config.ts` (colors, Cormorant Garamond for headlines,
  Inter for UI) — pulled from the brand kit HTML. App name still TBD.
- `db/schema.sql` — full Postgres schema for all six tables (users, items,
  outfit_logs, recommendations, badges, vision_boards) plus a derived
  `item_wear_stats` view. Run `npm run db:migrate` against `DATABASE_URL` to apply it.
- `lib/db.ts` — pg Pool connection helper.
- `lib/anthropic.ts` — two Claude API calls stubbed out: `draftItemFromPhoto()`
  for the Add Item flow, `getRecommendations()` for the Today screen. Both
  return parsed JSON per the response shapes in the build plan.
- `app/page.tsx` — a static, styled skeleton of the Today screen so the visual
  system is validated before real data is wired in.

## Setup
```
npm install
cp .env.example .env.local   # fill in DATABASE_URL and ANTHROPIC_API_KEY
npm run db:migrate
npm run dev
```

## Build order (matches the plan's phases — don't skip ahead)

### Phase 1 — Closet
1. Add a minimal single-user auth (a hardcoded/seeded user row is fine for v1;
   don't over-build auth before multi-user is real).
2. Build `app/closet/page.tsx` — grid of items from `items` table, filterable by
   category / occasion / color / provenance / status.
3. Build `app/closet/[id]/page.tsx` — item detail: photo, display_id, all fields,
   wear history + cost-per-wear (pull both from `item_wear_stats` view).
4. Build `app/add-item/page.tsx` — camera-first capture → call
   `draftItemFromPhoto()` → editable confirm form → user picks provenance →
   insert into `items`. Generate `display_id` server-side as
   `{CATEGORY_PREFIX}-{zero-padded sequence}` (e.g. TOP-0042).
   **Target: under 15 seconds per item end to end.**
5. Exit test before moving on: catalog 30 items in one sitting without it feeling
   like a chore.

### Phase 2 — Recommendations + logging
1. Weather: fetch from Open-Meteo (no key needed) using `users.location`.
2. Wire the real Today screen: weather strip + day-summary textbox → on submit,
   assemble the context object described in the build plan's recommendation
   prompt (style profile, weather, day text, recently-worn display_ids, filtered
   closet) → call `getRecommendations()` → render outfit cards with "Wore it /
   show me another / skip" actions → write to `recommendations` table, and to
   `outfit_logs` on "Wore it".
3. Build `app/log-outfit/page.tsx` for self-styled (non-recommended) logging,
   with gap-detection: if a tapped item isn't in `items`, prompt to add it.

### Phase 3 — Style profile + stats
1. Onboarding questionnaire → `users.style_profile`.
2. Badge queries (see build plan's Gamification section for the exact list and
   trigger conditions) — run as SQL queries against `outfit_logs`/`items` after
   each log, not as a background job.
3. `app/stats/page.tsx` — streaks, closet utilization, cost-per-wear leaders,
   provenance breakdown, badge shelf, monthly recap.

### Phase 4 — Vision boards + share cards
Upload-based vision boards, Claude-distilled `style_direction` feeding into the
recommendation context, and a share-card renderer (canvas or an image-gen
service) for logged outfits.

### Phase 5 — Integrations + friends
Google Calendar autofill, Pinterest via export/pasted URLs, then multi-user
(invites, friends feed of `visibility: shared` outfits, privacy controls).

## Open decisions to make while building (see plan's "Open Decisions" section)
- App name — still TBD, using "Closet Stylist" as placeholder throughout.
- Cost is skippable at add-time (badge-gated incentive to fill in later) —
  don't make it required in the Add Item form.
- Today screen mood input: build as one optional free-text field alongside the
  day summary.
- Compress photos client-side before upload (budget matters for the Railway
  volume / S3 bucket).

## Conventions to hold to
- Every table already has `user_id` — keep querying by it even with one user,
  so multi-user in Phase 5 is additive, not a rewrite.
- Wear count / last-worn are always derived from `outfit_logs` via the
  `item_wear_stats` view — never store them redundantly on `items`.
- The app should never block or nag for missing data (photos, cost, notes are
  all optional) — this is a stated product principle, not a nice-to-have.
