# Railway Deployment Guide

## Step 1: Railway Project Setup
1. Go to https://railway.app → New Project
2. Select "Deploy from GitHub" → authorize and select this repo
3. Once created, go to Project Settings

## Step 2: Add Postgres Database
1. Click "+ New" in your project
2. Select "Database" → "Postgres"
3. Railway automatically injects `DATABASE_URL` — no action needed

## Step 3: Set Environment Variables
Navigate to your project's Variables tab and add:

### API Keys (from your .env.local):
```
ANTHROPIC_API_KEY=<your-anthropic-api-key>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>
```
Get these from your local `.env.local` file.

### Generate new secrets:
```bash
# SESSION_SECRET (32+ bytes, hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output and paste into Railway

# CRON_SECRET (any random string)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
# Copy output and paste into Railway
```

### Production Google OAuth Redirect:
After Railway deploys (it'll give you a domain like `your-app.up.railway.app`):
```
GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN.up.railway.app/api/auth/google/callback
```

Then update your Google Cloud OAuth app to add this redirect URI.

## Step 4: Deploy
Click "Deploy" in Railway. The pre-deploy script (`npm run db:migrate`) runs automatically.

## Step 5: Update Google OAuth
1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 client
3. Add your Railway URL to "Authorized redirect URIs"
4. Redeploy or restart the service in Railway

## Step 6: Set Up Cron (for notifications)
1. Click "+ New" → "Cron Job"
2. Schedule: `*/15 * * * *`
3. Webhook URL: `https://YOUR-DOMAIN.up.railway.app/api/cron/tick`
4. HTTP headers: `Authorization: Bearer <YOUR_CRON_SECRET>`

## Photos
Currently stored on disk (ephemeral). For production, configure S3 or Railway volume via `PHOTO_STORAGE_URL` and `PHOTO_STORAGE_KEY`.
