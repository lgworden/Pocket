import { ImageResponse } from "next/og";
import BagIcon from "@/components/BagIcon";

// Browser-tab favicon (auto-injected as <link rel="icon">).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BagIcon size={32} />, { ...size });
}
