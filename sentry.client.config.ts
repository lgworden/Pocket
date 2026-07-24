// Browser-side Sentry init. Runs whenever the app is loaded in a browser.
// See https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // No-ops cleanly with an empty dsn (local dev without SENTRY_DSN set).
});
