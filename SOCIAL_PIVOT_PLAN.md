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

**Revised 2026-07-27, after Phase 1 shipped.** The `public` visibility tier described
below in the original Phase 1/2 write-up was built, then explicitly rejected by the
user and removed the same day — reach/discovery is meant to work entirely through
search-and-friend, not a broadcast tier. The sections below are corrected to match
what's actually live; struck-through ideas are kept only so the reasoning ("why not")
isn't lost.

- **Invite-only.** You join because an existing member invites you. No open signup.
- **Anyone can search for and instantly friend anyone.** No approval step
  (`lib/friends.ts` `addFriend`) — this is the app's entire reach/discovery mechanism.
- **Follow exists as a separate, lightweight signal** (`lib/follows.ts`) — one-way,
  open to anyone, drives follower/following counts and automatic influencer status.
  It has **no effect on what posts anyone can see.** ~~Originally: followers could see
  a `public` visibility tier.~~ Removed — the user judged search-and-friend sufficient
  for reach, and didn't want a fourth "everyone" tier cluttering the composer.
- **Profiles are private by default.** Posts are not visible to non-friends. A
  profile's shell (name, avatar, counts, follow button) is visible to anyone; posts
  require being a mutual friend regardless of follow status (see the ladder below).
- **Influencer status is automatic** at a follower-count threshold
  (`INFLUENCER_THRESHOLD` in `lib/follows.ts`, currently a placeholder pending real
  distribution data). Pure status signal — a distinct profile card colour (`azure`,
  `#9BAAB4`) plus a badge chip. It does not gate anything.

### The access ladder (as actually implemented)

| State | Sees |
|---|---|
| **Stranger** | Name, avatar, influencer badge, follower/following/friend counts, follow button. No posts. |
| **Follower** (one-way follow, not mutual) | Same as stranger — follow carries no content access. |
| **Friend** (mutual — a `friendships` row, created instantly via search-and-add, no approval) | All of the above, plus `friends`-tier posts. |
| **Close friend** (a friend the author has additionally marked `close_friend`) | All of the above, plus `close_friends`-tier posts — the one gated tier that still exists. |

Enforcement lives entirely in `lib/feedQueries.ts`'s SQL — `getProfileAccess` in
`lib/profile.ts` only picks the right empty-state copy, it doesn't gate anything
itself. Since follower and stranger see identically nothing, their copy is now
identical too ("Be friends to see their looks").

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

## Phase 1 — Graph, profiles, and status ✅ shipped 2026-07-27

### Schema (`db/020_add_social.sql`)

A dedicated `follows` table — **not** a reuse of `friendships` as originally sketched
below (kept for the record — this was a real near-miss caught during implementation):

> ~~`friendships` stores two rows per friendship — `acceptInvite` and `addFriend`
> insert both to fake symmetry. Read a row `(A, B)` as A follows B... one-way follow
> is largely "stop inserting the second row."~~ **Wrong, caught before shipping:**
> `friendships.tier` is documented as "the row owner's grant to `friend_id`, gating
> the *owner's own* posts" — a different relationship than "follow," and different
> existing call sites (`lib/profile.ts` vs `lib/feedQueries.ts`) checked different
> directions of that table. That was only safe because every insert was always
> paired. A genuinely one-directional row would have made those call sites diverge
> silently. Fixed with a dedicated `follows` table instead — unambiguous by
> construction, `friendships` untouched.

```sql
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS influencer_since TIMESTAMPTZ;
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_follower';
-- 'public' was also added to feed_visibility here, then abandoned — see below.
```

**Privacy guardrail — held.** The migration never touched an existing `feed_posts`
row.

### Influencer threshold

Evaluated inline after each new follow (`lib/follows.ts` `maybePromoteToInfluencer`),
same pattern as the build plan's badge queries — not a background job. Sets
`influencer_since` once, on first crossing, and leaves it set. Threshold is currently
a placeholder constant (50) pending real distribution data.

### Profiles (`app/profile/[id]/page.tsx`)

Shipped: the ladder, enforced via the feed query (not a separate check); a new
`azure` (`#9BAAB4`) palette token — the one deliberately cool colour in an all-warm
system — for the influencer card tint + badge chip; follower/following/friend counts;
a `FollowButton`.

**Same-day reversal:** a `public` feed_visibility value and a "followers see public
posts" rule were built and verified live, then the user rejected the whole tier —
reach already works via search-and-friend, a fourth tier was unwanted clutter. Removed
from the TS types, composer, legend, and the feed query same day. The `public` enum
value is still technically present in the live Postgres enum (dropping a value
cleanly requires recreating the type) but nothing will ever write it again.

---

## Phase 2 — Cold start and discovery ✅ shipped 2026-07-27 (reframed)

**Reframed from the original plan.** The `/explore` idea below depended entirely on
`public`-tier posts, which no longer exist. Asked the user how to solve cold start
instead of the dead approach; they chose **"just improve search"** over a
friends-of-friends suggestion surface. Original text, kept for context:

> ~~`/explore` — public-tier posts from across the member base... empty-feed
> backfill... onboarding ends in follows, not items.~~

**What shipped instead:**
1. Extracted `components/FriendSearch.tsx` (search input + result list + instant add)
   out of `FriendsModal.tsx` into a shared component — it was inline and duplicated
   nowhere else, now it's reusable.
2. Added a "Find your friends" card to onboarding
   (`components/OnboardingInteractive.tsx`), right after the username field, using
   the same shared component. Optional, no gating.

Cold start is helped by two things that already existed and needed no new building:
accepting an invite makes you instantly, mutually friends with your inviter (no
approval step), and search-and-add is unlimited and immediate.

---

## Phase 3 — Growth 🚧 in progress 2026-07-27

Invite-only has a visibility paradox: exclusivity only creates demand if people know
the thing exists and know they can't get in. That requires an *outbound* artifact.

Two items from the original list are dropped, since both depended on the removed
`public` tier and don't survive its removal:
- ~~Close friends as the creator ladder (public teaser → gated full look)~~ — no
  teaser tier exists for strangers to see anymore. The `friends → close_friends`
  gate among people who are *already* mutual friends still works exactly as before;
  it just can't be used to entice strangers.
- ~~Tagged non-members → invite prompt~~ — checked the composer's tag-friends UI
  (`FeedComposer.tsx`): it only picks from existing mutual friends, not an open
  search, so there's no "tag someone not yet a member" moment to hook. Would need a
  broader tagging redesign first; not attempted this pass.

**Remaining, ranked by leverage:**

1. **Share cards.** A rendered, downloadable outfit image carrying the wordmark, for
   an existing member to post externally (IG story, etc.). With closed signup this
   is the *only* acquisition channel — every invite-only success had one of these.
   Scoped to the poster's own posts only (`post.is_mine`) — generating an external,
   downloadable image of *someone else's* post cuts against "private by default,"
   even though a screenshot is always technically possible regardless.
2. **Scarce, countable invites.** `getOrCreateInviteCode` minted one unlimited
   reusable code per user; capped each code at a fixed number of uses instead.
   Milestone-based refills (posting streak, friend count) are **not** implemented —
   deliberately left as an open decision rather than an invented rule (see below).
3. **Make the invite landing sell.** Can no longer show "a few of their public
   fits" (no such thing exists) — reframed to show the inviter's name/avatar and a
   friendly line, so arriving feels like landing somewhere real rather than a bare
   signup form.
4. **Visible progress to influencer.** Shows the follower count remaining to the
   threshold, on the viewer's own profile only.
5. **Waitlist** for people without an invite — not attempted this pass, lower
   leverage than the above and meaningfully larger scope (needs its own storage,
   an admin release mechanism, and a landing page).

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
  landing path. Redirects handled (`/feed` → `/`).
- **`removeFriend` vs `unfollow`** — two operations that look alike and aren't
  (`removeFriend` deletes both `friendships` rows; `unfollow` deletes one `follows`
  row). Both now exist; still the likeliest place to introduce a confusion bug later.
- **Walkthrough copy** — `/welcome` still describes a closet-first app. Not yet
  revisited.

## Open decisions

- **Influencer threshold number** — needs distribution data. Currently 50, a
  placeholder constant in `lib/follows.ts`.
- **Badge naming in UI** — "influencer" sets a particular tone; shipped as-is for now.
- **Invite refill milestones** — a fixed per-user cap shipped in Phase 3; what (if
  anything) refills it beyond that is deliberately left open rather than invented.
- **Does the closet stay fully private?** Assumed yes — only posts are social.

## Sequencing

Phase 0 is a day and changes how the app feels immediately. Phase 1 is the schema
commitment. Phase 3's share card is the acquisition channel and should not wait for
Phase 4 — with closed signup, nothing else brings people in.
