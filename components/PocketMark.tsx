// App icon mark, used for the browser favicon and the iOS home-screen icon.
// A plain text wordmark rasterized through next/og's Satori renderer.
export default function PocketMark({ size }: { size: number }) {
  const denim = "#4E6E8C";
  const thread = "#E7C89B";

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: denim,
      }}
    >
      <div
        style={{
          fontSize: size * 0.3,
          fontWeight: 700,
          color: thread,
          letterSpacing: -1,
          fontFamily: "sans-serif",
        }}
      >
        pckt
      </div>
    </div>
  );
}
