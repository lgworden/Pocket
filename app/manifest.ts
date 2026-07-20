import type { MetadataRoute } from "next";

// Web app manifest — served at /manifest.webmanifest. Makes the app installable
// to the iOS/Android home screen with a name, icon, and full-screen (no browser
// chrome) launch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocket — your AI stylist",
    short_name: "Pocket",
    description: "Your AI personal stylist",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F3", // cream — matches the app background
    theme_color: "#FBF8F3",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon", sizes: "32x32", type: "image/png" },
    ],
  };
}
