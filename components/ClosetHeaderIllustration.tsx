export default function ClosetHeaderIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto max-w-xs mx-auto mb-4">
      {/* Clothing rack/bar */}
      <rect x="20" y="60" width="160" height="8" fill="#8F8577" rx="4" />
      <rect x="30" y="65" width="4" height="35" fill="#7A5C3E" />
      <rect x="170" y="65" width="4" height="35" fill="#7A5C3E" />

      {/* Hanging clothes - animated */}
      <g className="animate-bounce" style={{ animationDuration: "2s" }}>
        {/* Left dress */}
        <path d="M 55 65 Q 50 75 50 90 L 50 105 Q 50 110 55 110 L 75 110 Q 80 110 80 105 L 80 90 Q 80 75 75 65" fill="#EADFCF" stroke="#AD8A64" strokeWidth="1.5" />
        {/* Dress details */}
        <circle cx="62" cy="85" r="3" fill="#AD8A64" />
      </g>

      <g className="animate-bounce" style={{ animationDuration: "1.8s", animationDelay: "0.2s" }}>
        {/* Middle top */}
        <path d="M 100 65 L 95 85 L 105 85 M 95 85 L 95 105 L 105 105 M 105 85 L 105 105" fill="#AD8A64" stroke="#7A5C3E" strokeWidth="1.5" />
        {/* Sleeves */}
        <path d="M 95 75 L 80 80" stroke="#7A5C3E" strokeWidth="2" strokeLinecap="round" />
        <path d="M 105 75 L 120 80" stroke="#7A5C3E" strokeWidth="2" strokeLinecap="round" />
      </g>

      <g className="animate-bounce" style={{ animationDuration: "2.2s", animationDelay: "0.4s" }}>
        {/* Right shirt */}
        <path d="M 145 65 L 140 85 L 150 85 M 140 85 L 140 105 L 150 105 M 150 85 L 150 105" fill="#B97A66" stroke="#7A5C3E" strokeWidth="1.5" />
        {/* Buttons */}
        <circle cx="145" cy="90" r="2" fill="#7A5C3E" />
        <circle cx="145" cy="100" r="2" fill="#7A5C3E" />
      </g>

      {/* Decorative hangers */}
      <g stroke="#8F8577" strokeWidth="1.5" fill="none">
        <path d="M 55 62 L 55 65 M 100 62 L 100 65 M 145 62 L 145 65" strokeLinecap="round" />
      </g>
    </svg>
  );
}
