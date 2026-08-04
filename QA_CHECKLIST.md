# pckt — manual QA checklist

Source of truth for what to test is the "Feature inventory" section of
`CLAUDE.md` — update that first when a feature ships or changes, then update
this file to match. Run this pass before any deploy that touches more than a
single isolated fix, and after any dependency/infra change (Railway, DB
migration, VAPID keys, etc).

Check off `[ ]` → `[x]` as you go. Note the date and build/commit tested at
the top of a run.

Run date: ____________  Commit/deploy: ____________  Tester: ____________

## 1. Auth & onboarding
- [ ] Sign up with a new username/password — lands in onboarding, not the app.
- [ ] Sign in with existing username/password — wrong password is rejected
      with a clear error, correct password succeeds.
- [ ] Sign in with Google — succeeds for an existing linked account.
- [ ] Log out, then confirm protected pages (`/`, `/closet`, `/stylist`, etc.)
      redirect to `/login` when signed out.
- [ ] Brand-new account sees the 4-slide `/welcome` carousel exactly once;
      reloading or revisiting doesn't re-show it after completion.
- [ ] Onboarding questionnaire: skipping optional fields doesn't block
      completion; finishing writes a style profile and unlocks the app.

## 2. Closet
- [ ] `/closet` loads with category filter rail + recent-fits reel; filtering
      by category, occasion, color, provenance, and status each narrow the
      grid correctly (and combine correctly together).
- [ ] Category with zero items shows the "add photo" affordance, never a
      blank/broken placeholder.
- [ ] Add item via `/add-item`: photo capture → AI draft fields populate →
      edit any field → save → item appears in closet under the right
      category. Time it — should feel well under 15s for a simple item.
- [ ] Add item with cost left blank — saves fine, no validation error.
- [ ] `/add-item/from-outfit`: upload a photo with multiple visible items →
      Claude proposes multiple draft items with crops → skip one, save the
      rest → only the saved ones land in the closet.
- [ ] Item detail page (`/closet/[id]`): shows photo, display_id, wear count,
      last-worn date, and cost-per-wear that matches manual math
      (cost ÷ wear count).
- [ ] Remove an item — disappears from closet grid and from any outfit
      history references don't break.
- [ ] Newly added item's `display_id` follows `{PREFIX}-{padded number}` and
      doesn't collide with an existing one.

## 3. Stylist (Today screen)
- [ ] `/stylist` shows current weather for the signed-in user's saved
      location (not defaulting to some other country — regression check for
      the null-location-geocodes-to-France bug).
- [ ] Submitting a day summary (with and without the optional mood text)
      returns outfit recommendations pulling from real closet items only —
      no recently-worn items suggested again immediately.
- [ ] "Wore it" on a recommendation writes to outfit history and it shows up
      wherever recent fits are surfaced (closet reel, feed prompt, etc.).
- [ ] "Show me another" returns a different outfit; "skip" dismisses cleanly
      without logging a wear.
- [ ] Outfit mockup illustration renders for a recommended outfit; the same
      piece combination reuses the cached image on a second request instead
      of regenerating.
- [ ] "Shuffle favs" returns a previously-logged outfit matched to current
      weather/plan, with no Claude API call in the network log.
- [ ] Google Calendar autofill (if connected): today's events populate the
      day-summary context; if not connected, the field is still usable
      manually with no error.
- [ ] Self-styled logging: tap an item that isn't yet in the closet →
      prompted to add it (gap detection) rather than silently failing.

## 4. Feed & social
- [ ] Home feed (`/`) loads the masonry collage without layout breakage at
      mobile width.
- [ ] Share-fit composer offers both "take a photo" (opens the camera) and
      "choose from album" (opens the photo library) on a real phone.
- [ ] Bottom nav slides fully out of view when scrolling down and comes back
      opaque when scrolling up; always visible near the top of the page.
- [ ] Close-friend heart: white for a plain friend, red once promoted, with a
      brief "@user is now your close friend" confirmation on promotion.
- [ ] Create a feed post from a logged outfit with each visibility tier
      (friends / close friends / private) — confirm a second test account in
      the right tier can/can't see it accordingly.
- [ ] React to a post with each of the 3 emoji reactions; reacting twice
      toggles off rather than double-counting.
- [ ] Share card renders and downloads/shares correctly from a feed post.
- [ ] Follow another user — their posts (per visibility) start appearing in
      feed; unfollow removes them.
- [ ] Friend search finds an existing user by username; sending/accepting a
      friend request updates both accounts' friend lists.
- [ ] Visit another user's profile (`/profile/[id]`) — shows their public
      info only, no private data leak (e.g. no full closet if not a friend).
- [ ] Generate an invite link (`/invite`), open it signed out in a new
      session, and confirm it lands in signup pre-filled/linked correctly.

## 5. Notifications
- [ ] Trigger each of the 6 notification types (check `lib/notifications.ts`
      for the current list) and confirm each shows up in `/notifications`
      with correct copy and links to the right place.
- [ ] Friending a second test account fires a `new_friend` notification to the
      person who was added (both via friend search and via an invite link),
      and re-adding an existing friend does *not* fire a duplicate.
- [ ] "Mark all read" clears the unread badge/count.
- [ ] Cron tick (`/api/cron/tick`) run manually in a non-prod environment
      generates the expected notifications without duplicating existing ones.
- [ ] Web push: opt in via `PushNotificationSetup`, trigger a notification,
      confirm a real OS-level push arrives (prod only once VAPID keys are
      set — mark N/A on environments without them configured).
- [ ] Push opt-out (`/api/push/unsubscribe`) actually stops further pushes.

## 6. Pack My Bags
- [ ] `/pack`: enter a destination + date range → multi-day weather loads for
      each day.
- [ ] Selecting activity chips changes the suggested packing list.
- [ ] Generated list follows the 3-3-3 method constraints and only pulls from
      real closet items.
- [ ] Fly animation plays without blocking interaction/errors in console.

## 7. Preferences & profile
- [ ] Update "Your info" (including location) from `/preferences` — new
      location immediately affects weather shown on `/stylist`.
- [ ] Update notification preferences — respected by which notifications
      actually fire afterward.
- [ ] Upload/change avatar — displays correctly in feed, profile, and nav.
- [ ] Style/goals pickers save and are reflected in next recommendation
      request's context.

## 8. Admin & observability
- [ ] `/admin/metrics` is reachable for an `ADMIN_EMAILS` account and returns
      404/blocked for a non-admin account.
- [ ] Force an error path (e.g. bad input to an API route) and confirm it
      surfaces in Sentry rather than crashing the whole app silently.

## 9. Cross-cutting
- [ ] Full flow on a real mobile device (not just responsive resize):
      camera capture, photo compression, and touch interactions all work.
- [ ] No page in the app ever hard-blocks submission on optional fields
      (photo, cost, notes) — spot-check add-item and log-outfit.
- [ ] Every list/grid page has a sane empty state (new account, zero items,
      zero posts) — no raw errors or blank white screens.
- [ ] Sign out/in as a second seeded test account to confirm data is scoped
      per `user_id` and nothing leaks across accounts.

## Known not-yet-built (don't file bugs for these — see CLAUDE.md)
- Badges/gamification — schema exists, no UI or logic yet.
- Vision boards — schema exists, no UI or logic yet.
