# Closet Stylist — Scaling & Rollout Plan

Two plans in one doc:
1. **Cost-scaling triggers** — what to watch and what to change as users grow, so cost never surprises you.
2. **Marketing & rollout** — how to go from 25 friends to a public launch.

Everything here is trigger-based (act when a *metric* crosses a line), not calendar-based —
because the bill tracks **active usage**, not sign-ups.

---

## Part 1 — Cost scaling: reconsider when these triggers fire

### The one number that matters: **cost per active user**
Not sign-ups. A dormant account costs ~$0. Instrument this early:

- **Active/registered ratio** — of everyone who signed up, how many used it this week?
- **AI calls per active user per day** — recommendations, add-item drafts, image gen.
- **Monthly AI bill** (Anthropic + OpenAI), split by feature if you can tag calls.
- **DB**: connection count vs. pool limit, storage GB.
- **Storage**: total size of `public/uploads` (or S3 bucket).

If you log just the first three, every decision below becomes obvious instead of a guess.

### Tier 0 — Now (1–25 users) · **do nothing, just watch**
- Pay-as-you-go on both API accounts, spend alerts set (~$75 Anthropic / $25 OpenAI).
- Railway default Postgres + a photos volume. No upgrades.
- **Action:** none. Watch the monthly bill once. This tier is a rounding error.

### Tier 1 — ~50–150 active · **trigger: AI bill > ~$150/mo, or you decide to grow**
Turn on the cheap code-level cost levers (all low-risk, ~a few hours):
- **Model tiering** — move `draftItemFromPhoto`, `draftItemsFromOutfitPhoto`,
  `getWeeklyStyleSummary` to Haiku (simple extraction/summary; ~1/3 the cost).
  Keep the strong model only for `getRecommendations` / `getPackingPlan`.
- **Prompt caching** on the recommendation prompt's stable prefix (~90% off repeated input).
- **Minify the context payload** — drop the `null, 2` pretty-print in `lib/anthropic.ts`.
- **Cap the closet payload** — send the top ~40 relevant items, not the whole closet.
- **Add per-user usage logging** so "cost per active user" becomes a real dashboard number.

Expected effect: **~$4 → ~$1–1.50 per active user/month.** Postgres/storage still fine.

### Tier 2 — ~150–500 active · **trigger: AI bill > ~$500/mo, DB connections near pool limit, or volume > ~5 GB**
Now cost is real money, so introduce controls and make the money decision:
- **Rate limits / free-tier caps** — e.g. 1–2 AI recommendations/day free. This alone
  caps your worst-case bill regardless of how heavy a power user is.
- **Decide monetization** (see Part 1 note below) — this is the fork in the road.
- **Move photos to S3-compatible storage** (`PHOTO_STORAGE_*` placeholders already exist) —
  cheaper and more durable than a growing Railway volume, plus a CDN in front.
- **Bump Postgres** one tier if connection count crowds the pool; add connection pooling
  (PgBouncer) before buying a bigger box.
- **Batch API** for the non-realtime weekly recap (cron) — another ~50% off those calls.

### Tier 3 — 1,000s active · **trigger: infra cost is a meaningful % of revenue**
- Monetization **must** be live by now. An AI app has real marginal cost per user —
  unlike pure SaaS, the 1,000th active user is *not* free.
- Caching layer for recommendations (same weather + plan + closet → serve cached).
- Read replica / heavier Postgres only when metrics say so (p95 query latency, CPU).
- Talk to Anthropic/OpenAI about **committed-spend discounts** once volume is steady.

### The monetization fork (decide by Tier 2)
Freemium fits this app because **the expensive thing is the premium hook**:
- **Free forever:** closet, logging, feed, friends (near-zero marginal cost).
- **Paid (~$5–8/mo) or free daily cap:** AI daily recommendations, outfit illustrations,
  packing planner.
- At ~$1 cost / ~$6 price, each paying user funds ~5 free users. That's what makes
  "thousands of users" survivable.

---

## Part 2 — Marketing & rollout

Positioning (from the product vision — closet + assistant + feed):
> **Your personal AI stylist for the closet you already own.**
> Lead with the *assistant* (get-dressed-in-seconds daily rec) as the hook,
> the *closet* as the foundation, the *feed* as the retention + virality layer.

### Phase 0 — Closed beta (now, 25 friends) · **goal: proof it's sticky**
Not a growth phase — a learning phase. Before spending a dollar on acquisition, prove
people come back.
- **Set up a feedback loop:** one channel (a group chat or a short form) where testers
  drop bugs and reactions. Make it frictionless.
- **Define success metrics up front:**
  - **D7 retention** — % still using it a week in (the make-or-break number).
  - **Outfits logged per active user per week** (engagement depth).
  - **Invites sent/accepted** (does it spread on its own?).
- **Harvest testimonials + screenshots** now — they're your launch assets later.
- **Exit test:** if a meaningful share of 25 friends still open it in week 2 unprompted,
  you have something worth marketing. If not, fix retention *before* acquisition —
  paid growth on a leaky bucket just burns money.

### Phase 1 — Waitlist + referral loop · **goal: a warm audience before public launch**
- **Landing page + waitlist** — one page: the hook, 3 screenshots, an email capture.
- **Turn the built-in invite system into a growth loop** — you already have invites and a
  friends feed. Reward referrals (skip-the-line, or a free month of premium later).
- **Prioritize the share-card renderer** (Phase 4 in the build plan) — every shared outfit
  becomes free advertising. This is the highest-leverage *product* work for growth.

### Phase 2 — Public launch · **goal: acquisition through channels that fit the niche**
This app lives in a visual, share-heavy niche — pick channels accordingly:
- **TikTok / Instagram Reels** — "AI picked my outfit," closet-organization, capsule-wardrobe,
  and cost-per-wear content perform extremely well here. This is your #1 channel.
- **Fashion micro-influencers** — closet-tour and capsule-wardrobe creators; gift access,
  let the product be the content.
- **Reddit** — r/femalefashionadvice, r/capsulewardrobe, r/declutter (contribute genuinely,
  don't spam).
- **Product Hunt** — good for the tech-curious early-adopter wave and backlinks.

### Content angles that match the product's real value
- "Get dressed in 10 seconds" (the assistant).
- "What your cost-per-wear actually is" (the stats — surprising, shareable).
- "One capsule, a week of outfits" (the packing / 3-3-3 planner).
- "My closet, styled by AI" (the outfit illustrations — inherently screenshot-able).

### The funnel to watch (AARRR)
- **Acquisition** — sign-ups by channel (which content actually converts).
- **Activation** — % who complete onboarding *and* get their first recommendation.
- **Retention** — D7 / D30 (the number that decides whether to scale spend).
- **Referral** — invites sent / accepted (your cheapest growth).
- **Revenue** — once monetization is live.

Rule of thumb: **don't pour money into Acquisition until Retention is proven** in Phase 0.
