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
- [ ] The dress icon is the *only* add button on `/closet`, and it opens a
      bottom sheet titled "add to closet" asking "a single piece" vs
      "a whole fit".
- [ ] Both branches show a "← what are you adding?" link back to the chooser;
      the × closes the whole sheet and nothing is left half-filled on reopen.
- [ ] "a single piece" in the sheet: capture → AI draft → save → the new item
      shows up in the closet behind the sheet without a manual reload, and the
      category count on the rail goes up.
- [ ] "a whole fit" in the sheet: photo → tag items → save → the fit appears
      at the top of the recent-fits reel.
- [ ] With no fits yet, tapping the "your fits show up here" field opens the
      sheet directly on the fit branch (not the chooser).
- [ ] Tick "save this fit to my favs" and save → run "shuffle favs" on
      `/stylist` a few times; the favourited combo comes up noticeably often
      and its card reads "One of your favorites" / mentions the fav.
- [ ] Leave the favs box unticked → the fit still logs and still counts as
      normal shuffle-favs history (weighted by wears only).
- [ ] Add item via `/add-item` (the standalone page, same flow): photo capture
      → AI draft fields populate → edit any field → save → item appears in
      closet under the right category. Time it — should feel well under 15s
      for a simple item.
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

## 3b. Moments (on the Today/Digest screen)
- [ ] `/stylist` shows the Moments block with a "+ new" button; with no
      moments it shows the empty "plan a group fit…" copy, not a broken list.
- [ ] "+ new" opens the composer; creating with a name + start time (and some
      vibe chips / formality) makes the moment appear under "Created by you"
      with an expiry pill, without a page reload.
- [ ] Regular user: composer search is labelled "mutual friends" and only
      returns mutual friends. Designer account: labelled "invite anyone" and
      returns all users.
- [ ] Invite a **mutual** friend → they appear accepted immediately. Regular
      user inviting a **non-mutual** → error, and no orphaned moment is left
      behind (nothing new under "Created by you").
- [ ] Designer inviting a non-mutual → the invitee sees it under "Invites"
      (pending) with accept / decline; accepting moves it to "You're going"
      live; declining removes it.
- [ ] Edit as creator or collaborator → changes reflected. Edit affordance is
      absent for a plain invitee (no edit button, and a hand-rolled PATCH 403s).
- [ ] Delete as the creator → the moment disappears from every list; a
      non-creator cannot delete (no control; hand-rolled DELETE 403s).
- [ ] Moment past `expires_at` drops out of `/stylist`; the cron tick soft-
      deletes it and (≤48h out, accepted members only) sends one non-duplicated
      "expires in 2 days" notification.
- [ ] Moodboard: an accepted participant can add a reference image (+ inspo) and
      it appears in the strip; the uploader or the creator can remove it, a
      different member cannot (no × control; hand-rolled DELETE 403s).
- [ ] "+ your fit": an accepted participant uploads an outfit candidate and it
      appears in the fits strip. A pending/declined invitee cannot add inspo or
      fits (hand-rolled POST 403s).
- [ ] A moment fit **never** appears in the main feed (`/`) for the author or
      anyone else, and posting one doesn't suppress the day's OOTD reminder or
      count in the weekly feed summary.
- [ ] Composer GCal control: when the calendar isn't connected it shows a
      "Connect Google Calendar" link (not a dead checkbox); when connected it's a
      live checkbox, pre-checked only when editing an already-linked moment.
- [ ] Checking "Add to Google Calendar" on save creates/updates a primary-calendar
      event (title, time, location, description w/ vibe/formality/attendees + a
      /stylist?moment= back-link); unchecking a linked moment unlinks it without
      deleting from GCal. Only creator/collaborator can sync (invitee POST 403s).
- [ ] An account connected before write-back shipped (read-only grant) gets a
      "reconnect to enable writing" message on write, and reconnecting fixes it.

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
- [ ] Follow a designer account — their posts (per visibility) start appearing
      in feed; unfollow removes them.
- [ ] A non-designer profile shows **no** follow button, and a hand-rolled
      `POST /api/follows/<their-id>` (curl/devtools) comes back 403 with no
      row written. The status must never be named or explained in the UI.
- [ ] Friend search finds an existing user by username; sending/accepting a
      friend request updates both accounts' friend lists.
- [ ] Visit another user's profile (`/profile/[id]`) — shows their public
      info only, no private data leak (e.g. no full closet if not a friend).
- [ ] Designer profile shows 4 stats (followers / friends / day streak /
      outfits logged) on the caramel-washed header; every other profile shows
      3 (no followers) on the standard panel.
- [ ] Tapping the friends count on either profile type opens a modal listing
      that person's mutual friends; each name links to their profile.
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

## 5b. Feedback
- [ ] `/feedback` (reached from the "Send feedback" row on `/preferences`)
      submits a note; the success state appears and "send another" resets it.
- [ ] Submitting with no message is blocked (button disabled / 400 from the API).
- [ ] The submission lands in the `feedback` table with the right `user_id`,
      `sentiment`, and `source` (`weekly_reminder` when arriving from the
      notification link, `app` otherwise).
- [ ] With `RESEND_API_KEY` set, the email arrives at `FEEDBACK_EMAIL_TO` and
      the row's `emailed_at` is populated.
- [ ] With `RESEND_API_KEY` unset, the submission still succeeds for the user
      and the row records `email_error` — feedback is never lost.
- [ ] Monday 09:00 ET cron tick creates one `feedback_request` notification per
      user, for *every* user regardless of notification preferences, and a
      second tick the same week creates no duplicates.

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
