export default function BagIcon({ size = 180 }: { size?: number }) {
  const scale = size / 180;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        overflow: "visible",
      }}
    >
      {/* Background */}
      <rect width="180" height="180" fill="#f5f1ed" rx="45" />

      {/* Main bag body */}
      <g transform="translate(90, 90)">
        {/* Left side */}
        <path
          d="M -35 -10 L -35 40 Q -35 50 -25 50 L 25 50 Q 35 50 35 40 L 35 -10"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Top opening */}
        <path
          d="M -30 -10 Q -30 -15 -20 -15 L 20 -15 Q 30 -15 30 -10"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Left handle */}
        <path
          d="M -25 -15 Q -40 -25 -38 -5"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Right handle */}
        <path
          d="M 25 -15 Q 40 -25 38 -5"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Zipper pocket lines */}
        <path
          d="M -20 0 L 20 0"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="1.5"
          strokeDasharray="3,2"
          opacity="0.6"
        />

        {/* Small detail pocket */}
        <rect
          x="-12"
          y="8"
          width="24"
          height="15"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="1.5"
          rx="2"
          opacity="0.5"
        />

        {/* Scarf accent - left side */}
        <g transform="translate(-40, 5)">
          <path
            d="M 0 0 Q 5 8 8 15 M 2 2 Q 7 10 10 17"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      </g>
    </svg>
  );
}
