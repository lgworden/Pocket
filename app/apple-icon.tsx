import { ImageResponse } from "next/og";
import BagIcon from "@/components/BagIcon";

// iOS "Add to Home Screen" uses this as the app icon (auto-injected as
// <link rel="apple-touch-icon">).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BagIcon size={180} />, { ...size });
}
