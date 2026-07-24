const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Single SENTRY_DSN env var (server-side) doubles as the client DSN — DSNs
  // aren't secret, so this avoids asking for a second NEXT_PUBLIC_ copy.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN,
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Source-map upload (readable stack traces in Sentry) is optional and only
  // activates once SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT are set —
  // silent: true keeps local/CI builds quiet without them.
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
});
