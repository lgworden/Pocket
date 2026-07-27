# Pocket — social pivot plan

Repositioning from *closet index with a social feature* to *social app with a closet
underneath*. Written 2026-07-27. Companion to `closet-stylist-build-plan.md`, which
remains the source of truth for the closet/stylist data model.

## The thesis

The closet is infrastructure, not a destination. People do not open an app daily to
maintain an inventory — they open it to see other people and to be seen. The wear
log, the item catalogue, and the stylist all still matter, but they matter because
they make posting easier and recommendations better, not as ends in themselves.

Three loops, in priority order:

1. **See** — there is always something worth looking at, on day one.
2. **Post** — sharing a fit takes seconds and never requires a catalogued closet.
3. **Return** — reactions, comments, and follows pull you back without you posting.

## Membership and graph model

- **Invite-only.** You join because an existing member invites you. No open signup.
- **Anyone can follow anyone.** One-way follow is open across the whole member base;
  it is not gated on influencer status.
- **Profiles are private by default.** Posts and friends lists are not visible to
  strangers. Access widens as the relationship deepens (ladder below).
- **Influencer status is automatic** at a friend-count threshold. It is a *status
  signal*, not a permission grant — it does not change who may follow you, because
  everyone may already. It surfaces as a distinct profile card colour.

### The access ladder

Four states, each strictly wider than the last:

| State | Sees |
|---|---|
| **Stranger** | Name, avatar, influencer badge, friend count, friend-request button. Nothing else. |
| **Follower** (one-way) | The above, plus the author's `public`-tier posts in feed and on the profile grid. No friends list. |
| **Friend** (mutual) | The above, plus `friends`-tier posts and the friends list. |
| **Close friend** | The above, plus `close_friends`-tier posts — the gated tier. |

**One deliberate amendment to "all posts private until friends":** posts the author
*chooses* to mark `public` are visible to followers. Without this, following conveys
nothing and influencers have no way to grow reach — which is the stated point of the
influencer tier. Public is opt-in per post; the composer default stays `friends`, so
the private-by-default principle holds for everything the author doesn't deliberately
push outward. Think of `public` posts as the shop window and everything else as the
apartment behind it.

---

## Phase 0 — Reframe the shell

No schema. Makes the app *read* social before it *is* social.

1. **Nav order** — `components/BottomNav.tsx`. Recommended: **Feed · Stylist ·
   Closet · Settings**. Stylist stays at position two: it is the only surface that
   works with zero friends, so it carries daily opens through cold start.
2. **Route move** — Feed to `/`, current Stylist home to `/stylist`. Keep `/feed` as
   a redirect so notification deep-links and invite landings survive.
3. **Compose in the nav** — the `+` currently lives in the feed header
   (`components/feed/FeedCollage.tsx`). Promote it to a persistent centre action.
4. **Rename** the "Friends" tab to "Feed"; move graph management under the profile.

---

## Phase 1 — Graph, profiles, and status

### Schema (`020_add_social.sql`)

```sql
ALTER TYPE feed_visibility  ADD VALUE 'public';
ALTER TYPE notification_type ADD VALUE 'new_follower';
ALTER TYPE notification_type ADD VALUE 'friend_request';

ALTER TABLE users ADD COLUMN IF NOT EXISTS influencer_since TIMESTAMPTZ;
-- NULL = not an influencer. Timestamp = when the threshold was first crossed.
-- Stored rather than computed so the badge doesn't flicker if a friend is removed.

CREATE INDEX IF NOT EXISTS friendships_friend_created_idx
  ON friendships(friend_id, created_at DESC);
```

**Privacy guardrail — non-negotiable.** The migration must not touch a single
existing `feed_posts` row. Every post authored before this ships keeps the tier its
author chose under a friends-only app. `public` is opt-in, per post, going forward.

### The graph is already directed

`friendships` stores two rows per friendship — `acceptInvite` and `addFriend` insert
both to fake symmetry (`lib/friends.ts`). Read a row `(A, B)` as **A follows B**:

- **A follows B** → `(A,B)` only
- **Mutual friends** → `(A,B)` and `(B,A)`
- **Close friend** → `(B,A).tier = 'close_friend'`

So one-way follow is largely "stop inserting the second row." `unfollow` removes one
row; `removeFriend` removes both. These are different operations that look alike —
the likeliest place to introduce a privacy bug.

### Influencer threshold

Evaluated after each new follower, in SQL, alongside the existing badge checks — not
as a background job (consistent with the build plan's gamification approach). Sets
`influencer_since` on first crossing and leaves it set thereafter.

Threshold number is tunable and unset; pick it once there's real distribution data.
Set it too low and the signal is worthless; too high and nobody reaches it.

Worth building now: notify the user when they cross, and honour an opt-out. Status
that appears silently on your profile is worse than status you're told you earned —
and the opt-out costs one boolean.

### Profiles (`app/profile/[id]/page.tsx`)

The ladder above, enforced server-side. Card colour carries the status signal:

- New palette token — a dusty, desaturated blue (~`#9BAAB4`). **Do not reuse `blue`**,
  which is caramel `#AD8A64` despite the name and already denotes the close-friends
  card tier. Name the new token for its role (e.g. `azure`), not by hue.
- This will be the only cool colour in an all-warm palette. That is the point for a
  badge, but it is a real departure from the "one accent" clean-girl direction and
  should be a conscious call.

---

## Phase 2 — Cold start and discovery

Invite-only mostly solves the *seed content* problem — you control the initial
cohort, so there is real content from day one. What it does not solve is what a
brand-new member sees before they have followed anyone.

1. **`/explore`** — `public`-tier posts from across the member base, recency plus
   engagement, computed in SQL. No recommender.
2. **Empty-feed backfill** — below ~10 posts, home transparently pulls from Explore.
   The empty state should be nearly unreachable.
3. **Onboarding ends in follows, not items.** Nobody should reach an empty feed
   because they haven't catalogued a closet.

---

## Phase 3 — Growth

Invite-only has a visibility paradox: exclusivity only creates demand if people know
the thing exists and know they can't get in. That requires an *outbound* artifact.

**Ranked by leverage:**

1. **Share cards — promote from Phase 4 to here.** A rendered outfit image, posted to
   an Instagram story, carrying the wordmark. Friends see it, want in, ask for an
   invite. With closed signup this is not a nice-to-have; it is the *only*
   acquisition channel. Every invite-only success had one of these.
2. **Scarce, countable invites.** Give each member 3–5, show the remaining count, and
   refill on milestones (posting streak, friend count). Scarcity makes them feel
   valuable, makes people spend them on people they actually want here, and ties
   growth to engagement. Note `getOrCreateInviteCode` currently mints one unlimited
   reusable code per user — that needs to become a countable allowance.
3. **Make the invite landing sell.** `/invite/[code]` currently just accepts the
   code. It should show who invited you and a few of their public fits. Real content
   converts far better than a bare signup screen.
4. **Close friends as the creator ladder.** Public teaser → full look, brands, and
   where-to-buy gated to close friends. This is the influencer value proposition made
   concrete, and the seed of a monetisation path if you ever want one.
5. **Visible progress to influencer.** If the threshold is automatic, show the
   distance to it. A visible ladder drives exactly the behaviour the tier is meant to
   encourage.
6. **Tagged non-members → invite prompt.** `tagged_user_ids` already exists; tagging
   someone who isn't a member is the warmest possible invite moment.
7. **Waitlist** for people without an invite. Captures demand, makes scarcity legible,
   and gives you a pool to open up to when you want a growth push.

---

## Phase 4 — Retention

Social notification types (follower, reaction, comment, tagged) on the existing
notification + cron infrastructure. Profile as a real destination. Keep the digest
and OOTD reminders as the utility-side return hook.

---

## Phase 5 — Data capture

Last to build, **first to instrument.** Start logging in Phase 0.

Extend `events` to capture: recommendation shown → wore/skipped/swapped with full
context; item worn with weather and calendar; post → reactions received; closet items
never worn (the rarest and most valuable negative signal).

**On a custom model.** The moat is the data, not the weights. A custom foundation
model is an eight-figure effort and would not beat a frontier model at taste-driven
styling. The reachable ladder: **cache** aggressively → **split mechanical from
taste** (tagging and categorisation onto a small fine-tuned model, styling judgment
stays frontier) → **distil** from frontier-generated labels → **revisit** at millions
of wear-outcome pairs. Logging costs nothing today and cannot be backfilled; that
asymmetry is the whole argument for starting in Phase 0.

---

## What breaks

- **Deep links** — moving Feed to `/` changes every notification link and the invite
  landing path. Redirects are mandatory.
- **`getFeedPosts` callers** — the profile page reuses it via `opts.authorId`; the
  rewrite must stay correct for a viewer who follows but is not friends.
- **`VISIBILITY_STYLES`** — a fourth tier needs a fourth colour in a three-colour
  palette, and the stacked legend that just shipped makes it more visible.
- **`removeFriend` vs `unfollow`** — see above.
- **Walkthrough copy** — `/welcome` describes a closet-first app.

## Open decisions

- **Influencer threshold number** — needs distribution data.
- **Badge naming in UI** — "influencer" sets a particular tone; "open profile" or
  similar reads less like a status hierarchy if that isn't the vibe.
- **Invite allowance** — how many, and what refills them.
- **Is `public` visible to logged-out visitors?** Affects share-card landing pages and
  whether there's any SEO surface at all.
- **Does the closet stay fully private?** Assumed yes — only posts are social.

## Sequencing

Phase 0 is a day and changes how the app feels immediately. Phase 1 is the schema
commitment. Phase 3's share card is the acquisition channel and should not wait for
Phase 4 — with closed signup, nothing else brings people in.
