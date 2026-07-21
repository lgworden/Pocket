import confetti from "canvas-confetti";

type ConfettiShape = ReturnType<typeof confetti.shapeFromPath>;

// Retro '70s daisy palette — corals, rose, marigold, terracotta, caramel and
// butter cream, pulled from the reference flower art. Warm and sunbaked, no
// pure primaries.
const RETRO_COLORS = [
  "#E27B5A", // coral
  "#E86D8A", // bubblegum rose
  "#F0A63C", // marigold
  "#C15A2B", // terracotta
  "#B0672F", // caramel
  "#F3D9A4", // butter cream
  "#E9A0AE", // soft rose
];

// Build a mod-flower silhouette as an SVG path: `petals` overlapping petal
// circles arranged in a ring, plus a center circle so the middle always fills
// solid (canvas-confetti paints each particle a single flat color).
function flowerPath(petals: number, petalRadius: number, ringRadius: number): string {
  const circle = (cx: number, cy: number, r: number) =>
    `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 `;

  let path = "";
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
    path += circle(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, petalRadius);
  }
  // Center filler keeps the middle solid regardless of petal overlap.
  path += circle(0, 0, petalRadius * 0.7);
  return path.trim();
}

// shapeFromPath rasterizes against a canvas, so it can't run during SSR — build
// the shapes lazily on first celebrate() (always a client-side user action) and
// cache them.
let shapes: ConfettiShape[] | null = null;

function getShapes(): ConfettiShape[] {
  if (!shapes) {
    const daisy = confetti.shapeFromPath({ path: flowerPath(6, 4.5, 6) });
    const bloom = confetti.shapeFromPath({ path: flowerPath(5, 5, 6) });
    // Weight flowers heavily; sprinkle a few round "centers" for a natural mix.
    shapes = [daisy, daisy, bloom, bloom, "circle"];
  }
  return shapes;
}

export function celebrate() {
  confetti({
    particleCount: 70,
    spread: 80,
    startVelocity: 38,
    origin: { y: 0.6 },
    colors: RETRO_COLORS,
    shapes: getShapes(),
    scalar: 1.6,
    gravity: 1.05,
    ticks: 240,
  });
}
