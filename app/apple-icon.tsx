import { ImageResponse } from "next/og";
import PocketMark from "@/components/PocketMark";

// iOS "Add to Home Screen" uses this as the app icon (auto-injected as
// <link rel="apple-touch-icon">). Full-bleed denim so iOS masks it into a
// rounded square cleanly — a jeans back pocket, riffing on the name "pckt".
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<PocketMark size={180} />, { ...size });
}
