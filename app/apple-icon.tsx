import { ImageResponse } from "next/og";

// iOS "Add to Home Screen" uses this as the app icon (auto-injected as
// <link rel="apple-touch-icon">). Full-bleed background — iOS masks it into a
// rounded square and ignores transparency.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#AD8A64", // caramel — the one brand accent
          color: "#FBF8F3", // cream
          fontSize: 100,
          fontWeight: 400,
          fontStyle: "italic",
        }}
      >
        pckt
      </div>
    ),
    { ...size },
  );
}
