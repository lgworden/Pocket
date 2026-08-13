import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: "Pocket",
  title: "Pocket",
  description: "Your AI personal stylist",
  manifest: "/manifest.webmanifest",
  // Generates the apple-mobile-web-app-* meta tags so an iPhone "Add to Home
  // Screen" launches full-screen (no Safari address bar) with the right title.
  appleWebApp: {
    capable: true,
    title: "Pocket",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* pb-20 clears the bottom-docked nav; from md up that bar moves to the
          top (see BottomNav) and each page reserves the space with md:pt-24. */}
      <body className="max-w-md mx-auto min-h-screen pb-20 md:pb-0">{children}</body>
    </html>
  );
}
