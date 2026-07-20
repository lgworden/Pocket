import { ImageResponse } from "next/og";

// Browser-tab favicon (auto-injected as <link rel="icon">).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#AD8A64",
          color: "#FBF8F3",
          fontSize: 16,
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
