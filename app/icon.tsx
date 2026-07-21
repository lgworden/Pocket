import { ImageResponse } from "next/og";
import PocketMark from "@/components/PocketMark";

// Browser-tab favicon (auto-injected as <link rel="icon">) — a denim jeans
// back pocket, riffing on the app name "pckt".
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<PocketMark size={32} />, { ...size });
}
