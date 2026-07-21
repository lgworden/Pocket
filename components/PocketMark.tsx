// A denim jeans back-pocket mark, used for the browser favicon and the iOS
// home-screen icon. Drawn as flat SVG (no external assets) so it rasterizes
// cleanly through next/og's Satori renderer at any size. The classic cues —
// pentagon pocket, tan topstitching, and the double-swoop "arcuate" stitch —
// keep it readable even at 32px.
export default function PocketMark({ size }: { size: number }) {
  const denim = "#4E6E8C"; // tile / denim wash
  const pocket = "#3F5F7D"; // pocket body, a touch deeper for shape
  const thread = "#E7C89B"; // warm tan topstitching thread

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* denim tile */}
      <rect x="0" y="0" width="100" height="100" fill={denim} />
      {/* pocket body */}
      <path
        d="M22 33 L78 33 L71 61 L50 77 L29 61 Z"
        fill={pocket}
        stroke={thread}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* inner topstitch line */}
      <path
        d="M27 39 L73 39 L66.5 59 L50 72 L33.5 59 Z"
        fill="none"
        stroke={thread}
        strokeWidth="1.3"
        strokeDasharray="3 2.4"
        strokeLinejoin="round"
      />
      {/* arcuate double-swoop stitch */}
      <path
        d="M30 45 Q40 56 50 49 Q60 56 70 45"
        fill="none"
        stroke={thread}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* rivets at the top corners */}
      <circle cx="24.5" cy="35.5" r="1.8" fill={thread} />
      <circle cx="75.5" cy="35.5" r="1.8" fill={thread} />
    </svg>
  );
}
