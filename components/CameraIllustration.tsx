export default function CameraIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-auto max-w-sm mx-auto mb-4">
      {/* Camera body */}
      <rect x="30" y="40" width="140" height="100" fill="#F3ECE1" stroke="#8F8577" strokeWidth="2" rx="10" />

      {/* Camera top plate */}
      <rect x="35" y="35" width="130" height="8" fill="#FBF8F3" stroke="#8F8577" strokeWidth="1.5" rx="3" />

      {/* Lens outer ring */}
      <circle cx="100" cy="90" r="42" fill="#7A5C3E" stroke="#2E2924" strokeWidth="2" />
      <circle cx="100" cy="90" r="38" fill="#8F8577" stroke="#7A5C3E" strokeWidth="1" />

      {/* Lens glass - animated */}
      <circle cx="100" cy="90" r="32" fill="#EADFCF" stroke="#AD8A64" strokeWidth="1.5" className="animate-pulse" />

      {/* Lens reflections */}
      <ellipse cx="88" cy="78" rx="8" ry="10" fill="white" opacity="0.6" />

      {/* Shutter button */}
      <circle cx="50" cy="50" r="6" fill="#AD8A64" stroke="#7A5C3E" strokeWidth="1.5" className="hover:animate-bounce" />

      {/* Viewfinder */}
      <rect x="120" y="45" width="12" height="16" fill="#7A5C3E" stroke="#8F8577" strokeWidth="1" rx="2" />

      {/* Camera details */}
      <rect x="40" y="115" width="120" height="3" fill="#8F8577" rx="1.5" />

      {/* Decorative aperture lines inside lens - animated */}
      <g stroke="#AD8A64" strokeWidth="1.5" opacity="0.5" className="animate-pulse">
        <line x1="100" y1="58" x2="100" y2="90" />
        <line x1="142" y1="90" x2="110" y2="90" />
        <line x1="100" y1="122" x2="100" y2="90" />
        <line x1="58" y1="90" x2="90" y2="90" />
      </g>
    </svg>
  );
}
