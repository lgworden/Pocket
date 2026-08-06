# pckt (née Closet Stylist) — Claude Code build brief

Original product spec lives in `closet-stylist-build-plan.md` in the project root.
That plan's Phases 1-2 (closet + recommendations) are the foundation this app
still runs on, but the product has since pivoted social-first (see
`SOCIAL_PIVOT_PLAN.md`) and grown well past the original phase list. **The
"Feature inventory" section below reflects what's actually shipped and live
today (2026-08-03) — treat it as the source of truth over the phase list,
which is kept only for historical build-order context.** App name settled on
"pckt" (plain text wordmark).

## What's already here
- Next.js 14 (App Router) + TypeScript + Tailwind, configured with the brand's
  "clean girl" design tokens in `tailwind.config.ts` (warm neutrals, one
  caramel accent, rounded corners + soft shadows; Cormorant Garamond for
  headlines, Inter for UI).
- `db/schema.sql` — Postgres schema covering users, items, outfit_logs,
  recommendations, badges, vision_boards, feed_posts, feed_reactions,
  feed_comments, notifications, friendships, follows, invites,
  invite_redemptions, events, plus a derived `item_wear_stats` view. Run
  `npm run db:migrate` against `DATABASE_URL` to apply it. **Note:** the
  `badges` and `vision_boards` tables exist in the schema but have no
  application code reading/writing them yet — original Phase 3/4 items that
  never got built (see Feature inventory below).
- `lib/db.ts` — pg Pool connection helper.
- `lib/anthropic.ts` / `lib/mockup.ts` — Claude calls for `draftItemFromPhoto()`
  (Add Item), `getRecommendations()` (Stylist), and a gpt-image-1 call that
  composes a single outfit illustration from per-item photos.
- `app/page.tsx` — now the **Feed**, not a Today skeleton. The Today/outfit
  recommendation screen lives at `app/stylist/page.tsx`.

## Feature inventory (current, verified live unless noted)

**Auth & onboarding**
- Username/password signup (primary path) + Google Sign-In (secondary) —
  `app/login`, `app/api/auth/{register,signin,google,logout}`.
- `app/welcome` — 4-slide walkthrough carousel for first-time users, gated by
  `walkthrough_completed`.
- `app/onboarding` — style questionnaire → `users.style_profile`; app-wide
  gate via `requireOnboarded()` in `lib/auth.ts`.

**Closet**
- `app/closet` — split layout: filter rail (category/occasion/color/
  provenance/status) on the left, scrollable recent-fits reel on the right,
  icon-only add buttons up top. Category index → per-category list → detail,
  never a blank photo placeholder (uses `AddPhotoButton`).
- `app/closet/[id]` — item detail: photo, display_id, all fields, wear
  history + cost-per-wear from `item_wear_stats`.
- `app/add-item` — camera-first capture → `draftItemFromPhoto()` → editable
  confirm form → provenance → insert into `items`. Client-side photo
  compression before upload.
- `app/add-item/from-outfit` ("log my items") — upload an outfit photo,
  Claude decomposes it into multiple draft items with crops, user
  reviews/skips/saves each into the closet.
- Remove-item flow (`RemoveItemButton`).

**Stylist (Today screen, `app/stylist`)**
- Weather strip (Open-Meteo, keyless) + optional day-summary and free-text
  mood field → assembles recommendation context (style profile, weather, day
  text, recently-worn items, filtered closet) → `getRecommendations()` →
  outfit cards with Wore it / show me another / skip.
- "Shuffle favs" option: recommends a previously-worn outfit matched on
  weather/plan from `outfit_logs`, no Claude call.
- Auto-generated outfit mockup illustration (composed multi-item image),
  cached per unique piece-set.
- Google Calendar autofill of today's events (`app/api/calendar/today`) —
  opt-in, requires user's own OAuth credentials.
- Wore-it writes to `outfit_logs`; self-styled logging has gap-detection
  (tapping an item not yet in `items` prompts add-item).

**Feed & social**
- `app/page.tsx` (home) — color-coded masonry `FeedCollage` of shareable
  outfit posts, 3-tier visibility (friends / close friends / private), 3
  emoji reactions, share-card rendering (`ShareCardButton`).
- `FeedComposer` photo step offers both camera capture and album pick (two
  file inputs — `capture="environment"` opens the camera but suppresses the
  album picker, so each source needs its own input).
- Follow graph (`FollowButton`, `app/api/follows`) + friend tiers
  (`app/api/friends`, `FriendSearch`) — search-based discovery. Close-friend
  tier is toggled by an SVG heart in `FriendsModal`: white = friend,
  red = close friend, with a transient "@user is now your close friend"
  confirmation on promotion.
- `BottomNav` hides itself on scroll-down and reappears (fully opaque) on
  scroll-up; always shown near the top of the page.
- `app/profile`, `app/profile/[id]` — own and others' profiles.
- `app/invite`, `app/invite/[code]` — generic invite links (not tied to a
  specific channel), `InviteLinkCard`.

**Notifications**
- In-app notifications, 6 types, `app/notifications` + `NotificationsList` /
  `NotificationsModal` / `NotificationButton`; the scheduled ones are
  delivered via Railway-cron hitting `app/api/cron/tick`, while `new_follower`
  and `new_friend` fire inline from `lib/follows.ts` / `lib/friends.ts` at the
  moment the relationship is created.
- Web push (home-screen push) on top of in-app: `public/sw.js` service
  worker, VAPID keys, `PushNotificationSetup` component, `app/api/push`
  subscribe/unsubscribe. **Not yet fully live** — prod needs its own VAPID
  key pair set on Railway.

**Pack My Bags** (`app/pack`)
- 3-3-3 method vacation packing planner: destination multi-day weather,
  activity chips, airplane-fly animation, generates a packing list from the
  closet.

**Preferences & profile management** (`app/preferences`)
- Editable "Your info" / "Notifications" popups (shared pickers, not inline).
- `StylePicker`, `GoalsPicker`, `NotificationPicker`, avatar upload
  (`AvatarUpload`), editable location (fixes an earlier bug where a null
  location silently geocoded to France).

**Admin & observability**
- `app/admin/metrics` — dashboard gated by `ADMIN_EMAILS` env var.
- DIY Postgres event logging (`lib/analytics.ts`, `events` table).
- Sentry error tracking (`sentry.{client,server,edge}.config.ts`).

**Native app shell (Capacitor)**
- `capacitor.config.ts` + `android/` + `ios/` — thin native wrapper whose
  WebView loads the **deployed URL** (`server.url`), not a bundled build, since
  the app depends on SSR, session cookies, and API routes. Consequence worth
  remembering: **shipping to Railway updates the native app instantly, with no
  App Store / Play resubmission.** Only native-surface changes (a new plugin,
  icons, permission strings) need a rebuild. Override the target with
  `PCKT_APP_URL` to test the shell against a LAN dev server.
- `lib/nativePhoto.ts` — the only reason the shell exists. A browser
  `<input type="file">` can't restrict the OS picker to the camera roll (the
  Files/Browse entry is always offered and no attribute suppresses it); the
  native Camera plugin can. Every picker call site branches through it:
  FeedComposer, AddPhotoButton, AddItemClient, LogFitComposer, AvatarUpload,
  AddFromOutfitClient.
- `components/PhotoSourceSheet.tsx` — on native, tapping "album" opens this
  2-option app-level sheet (Photo Library / Choose File) instead of going
  straight to the Camera plugin's Photos-only picker. Deliberate product
  choice to re-add a Files option on native, since `@capacitor/camera` has no
  Files source of its own — "Choose File" falls back to the same plain
  `<input type="file">` the web path uses, which Capacitor's WebView already
  routes to the OS document picker with no extra plugin needed. Web is
  unaffected: the sheet only renders when `isNativePlatform()` is true, so
  "album" still opens the file input directly there, unchanged.
- **Two invariants to preserve when touching a photo picker:**
  1. The native check (`isNativePlatform()`) must stay *synchronous* before the
     web `.click()` — awaiting first spends the transient user activation a
     file picker needs, which silently breaks it in Safari.
  2. `@capacitor/*` must never be statically imported into client components.
     Detection reads the `window.Capacitor` global and the plugin is behind a
     dynamic `import()`, which keeps it a lazy ~13 kB chunk that browser users
     never fetch (verified: 0 occurrences in the shared first-load bundles).
- Not yet buildable on this machine: `npx cap add ios` scaffolded `ios/`, but
  `pod install` was skipped — needs full Xcode (not just Command Line Tools)
  plus CocoaPods. Android needs Android Studio / the SDK to build.

**Built in schema but not yet implemented in app code**
- Badges/gamification (`badges` table, no queries against it anywhere).
- Vision boards (`vision_boards` table, no upload UI or usage).

## Setup
```
npm install
cp .env.example .env.local   # fill in DATABASE_URL and ANTHROPIC_API_KEY
npm run db:migrate
npm run dev
```

## Original build order (historical — Phases 1-2 fully shipped, Phase 3 partially shipped as noted, Phases 4-5 superseded by the social pivot; kept for context only, see Feature inventory above for current state)

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
