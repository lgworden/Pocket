import type { CapacitorConfig } from "@capacitor/cli";

// Native shell config. The app is NOT bundled into the binary — the WebView
// loads the deployed site directly (server.url below), because pckt depends on
// SSR, session cookies, and API routes that a static export can't provide.
//
// The upside for releases: shipping to Railway updates the native app for
// everyone instantly, with no App Store / Play resubmission. A native rebuild
// is only needed when native surface changes — a new plugin, icons, or the
// permission strings below.
//
// PCKT_APP_URL lets a dev point the shell at a LAN address (e.g.
// http://192.168.1.20:3000) to test against a local dev server.
const serverUrl = process.env.PCKT_APP_URL ?? "https://pckt.up.railway.app";

const config: CapacitorConfig = {
  appId: "app.pckt.mobile",
  appName: "pckt",
  // Required by the CLI even in remote mode; nothing is served from it.
  webDir: "public",
  server: {
    url: serverUrl,
    // Keep the shell strict about TLS; only loosen for a local http:// dev URL.
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
