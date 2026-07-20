# Deploying Closet Stylist to Railway (friends test)

This gets the app onto a public URL with a persistent database so friends can sign
in with Google and use their own closets. Steps marked **(you)** need your Google/
Railway accounts — I can't create accounts or click through consent on your behalf.

The app code is already deploy-ready: `railway.json` runs migrations before each
deploy, `lib/db.ts` enables SSL for the remote database automatically, and the first
real Google sign-in creates each user (no seeding in production).

---

## 1. Push the code to GitHub **(you)**

Railway deploys from a GitHub repo. Create a repo and push this project to it.
(`.env.local` is gitignored — secrets go in Railway's dashboard, step 4.)

## 2. Create the Railway project + database **(you)**

1. At [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. In the project, **New** → **Database** → **Add PostgreSQL**.
3. Railway auto-detects Next.js and builds it. The build will fail until env vars are
   set (step 4) — that's expected.

## 3. Add a volume for photos **(you)**

Item and outfit photos are written to `public/uploads`, which is wiped on every
redeploy unless it's on a volume.

- Select the **app service** → **Variables/Settings → Volumes** → **New Volume**,
  mount path: `/app/public/uploads`.

> Longer term you may move photos to S3-compatible storage (there are
> `PHOTO_STORAGE_*` env placeholders for it), but a volume is fine for a friends test.

## 4. Set environment variables on the app service **(you)**

Service → **Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Reference the Postgres plugin: `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | A random 32+ byte hex string. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `GOOGLE_CLIENT_ID` | From step 5 |
| `GOOGLE_CLIENT_SECRET` | From step 5 |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-APP.up.railway.app/api/auth/google/callback` (fill in your real domain — see service **Settings → Networking → Public Domain**) |
| `GOOGLE_MAPS_API_KEY` | Optional — enables the back-to-back-events feature |
| `CRON_SECRET` | Any random string (used by the notifications cron) |

Do **not** set `SEED_USER_*` in production — accounts are created on sign-in.

## 5. Configure Google Sign-In **(you)**

In [console.cloud.google.com](https://console.cloud.google.com), same project as your
existing OAuth client:

1. **APIs & Services → OAuth consent screen**
   - User type **External**, keep it in **Testing** mode.
   - Under **Test users**, add each friend's Google email (up to 100). In Testing
     mode only these emails can sign in — which is exactly what you want for a
     closed test, and it avoids Google's app-verification review.
   - Scopes needed: `openid`, `email`, `profile` (non-sensitive) and
     `calendar.readonly` (sensitive, but allowed for test users without verification).
2. **APIs & Services → Credentials → your OAuth 2.0 Client**
   - **Authorized redirect URIs** → add
     `https://YOUR-APP.up.railway.app/api/auth/google/callback` (exact match — same
     value as `GOOGLE_REDIRECT_URI`). Keep the localhost one too for local dev.
   - Copy the **Client ID** and **Client secret** into the step-4 variables.

## 6. Deploy

Trigger a redeploy (Railway does this automatically when variables change or on a new
push). On deploy, `railway.json`'s pre-deploy command runs `npm run db:migrate`,
which creates all tables on the fresh database. It's idempotent, so every later
deploy re-runs safely.

## 7. Smoke-test, then invite friends

1. Open `https://YOUR-APP.up.railway.app` → you should hit the **login** page.
2. **Continue with Google** as yourself → complete onboarding.
3. Go to **Feed → the people icon → Copy** your invite link and send it to a friend.
4. They open the link, sign in with Google (must be a test-user email), and land as
   your friend. Their `friends`-visibility posts now appear in your feed; mark someone
   **Close friend** to also see their close-friends posts.

---

## 8. Wire the notifications cron **(you)**

`/api/cron/tick` needs something hitting it every ~15 min with
`Authorization: Bearer $CRON_SECRET`, or daily digests/reminders never fire. The repo
now has everything needed for a second Railway service to do this — you just have to
create the service in the dashboard:

1. In the same Railway project: **+ New** → **GitHub Repo** → pick this same repo again
   (this creates a second service from the same source, not a copy of the app).
2. Name it something like `notifications-cron`.
3. **Settings → Config-as-code** → set the config path to `railway.cron.json` (this
   repo's root). That file sets `cronSchedule: "*/15 * * * *"` and points the service
   at `npm run cron:tick`, a small script (`scripts/cron-tick.mjs`) that POSTs to your
   app's `/api/cron/tick`.
4. **Variables** on this new service:

   | Variable | Value |
   |---|---|
   | `CRON_TICK_URL` | `https://YOUR-APP.up.railway.app/api/cron/tick` (your real domain) |
   | `CRON_SECRET` | Same value as the `CRON_SECRET` on the main app service |

5. Deploy. Railway runs `npm run cron:tick` on the schedule; each run is a fresh,
   short-lived invocation (that's why `restartPolicyType` is `NEVER` in
   `railway.cron.json` — a single tick either succeeds or fails, it doesn't get retried
   into a loop). Check this service's **Deployments** logs to confirm `200` responses.

### Notes
- **Local dev** still uses `/api/auth/dev-login` (disabled in production) to sign in
  without Google — see the auth memory / `start-db.mjs` for the local DB.
