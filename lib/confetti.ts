import confetti from "canvas-confetti";

type ConfettiShape = ReturnType<typeof confetti.shapeFromPath>;

// Retro '70s daisy palette — corals, rose, marigold, terracotta, caramel and
// butter cream, pulled from the reference flower art. Each petal color is
// paired with a contrasting center (cream, peach, rose or rust) so the flowers
// read two-tone like the reference, not as flat silhouettes.
const FLOWERS: { petal: string; center: string }[] = [
  { petal: "#E27B5A", center: "#F7E6C6" }, // coral / cream
  { petal: "#E86D8A", center: "#F7E6C6" }, // rose / cream
  { petal: "#F0A63C", center: "#C15A2B" }, // marigold / rust
  { petal: "#C15A2B", center: "#F4C6C0" }, // terracotta / peach
  { petal: "#B0672F", center: "#F3D9A4" }, // caramel / butter
  { petal: "#F3D9A4", center: "#E86D8A" }, // butter cream / rose
  { petal: "#E9A0AE", center: "#F7E6C6" }, // soft rose / cream
];

// Colors used for the plain round "center" dots sprinkled between flowers.
const DOT_COLORS = FLOWERS.map((f) => f.petal);

// Build a mod-flower silhouette as an SVG path: `petals` overlapping petal
// circles in a ring, plus a center filler. Used only for the no-OffscreenCanvas
// fallback (single flat color, no distinct center).
function flowerPath(petals: number, petalRadius: number, ringRadius: number): string {
  const circle = (cx: number, cy: number, r: number) =>
    `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 `;
  let path = "";
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
    path += circle(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, petalRadius);
  }
  path += circle(0, 0, petalRadius * 0.7);
  return path.trim();
}

// Rasterize a two-tone flower to an ImageBitmap and wrap it as a canvas-confetti
// bitmap shape. Bitmap shapes keep their own colors when drawn, so the petal +
// center coloring survives (particle `colors` are ignored for these).
function flowerBitmap(petals: number, petal: string, center: string): ConfettiShape {
  const size = 48;
  const c = size / 2;
  const petalRadius = petals === 5 ? 9 : 8;
  const ringRadius = 11;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = petal;
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(angle) * ringRadius, c + Math.sin(angle) * ringRadius, petalRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Petal-colored hub keeps the middle solid, then the contrasting center on top.
  ctx.beginPath();
  ctx.arc(c, c, petalRadius * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(c, c, petalRadius * 0.62, 0, Math.PI * 2);
  ctx.fill();

  return { type: "bitmap", bitmap: canvas.transferToImageBitmap(), matrix: new DOMMatrix() };
}

// shapeFromPath / OffscreenCanvas both touch the DOM, so build the shapes lazily
// on first celebrate() (always a client-side user action) and cache them.
let shapes: ConfettiShape[] | null = null;

function getShapes(): ConfettiShape[] {
  if (!shapes) {
    if (typeof OffscreenCanvas !== "undefined") {
      // Two-tone flower bitmaps (6- and 5-petal for each palette pair) plus a
      // couple of round dots for a natural scatter.
      shapes = FLOWERS.flatMap((f) => [
        flowerBitmap(6, f.petal, f.center),
        flowerBitmap(5, f.petal, f.center),
      ]);
      shapes.push("circle", "circle");
    } else {
      // Fallback: flat single-color flower silhouettes.
      const daisy = confetti.shapeFromPath({ path: flowerPath(6, 4.5, 6) });
      const bloom = confetti.shapeFromPath({ path: flowerPath(5, 5, 6) });
      shapes = [daisy, daisy, bloom, bloom, "circle"];
    }
  }
  return shapes;
}

export function celebrate() {
  confetti({
    particleCount: 70,
    spread: 80,
    startVelocity: 30,
    origin: { y: 0.6 },
    colors: DOT_COLORS, // applies to the round "circle" dots; ignored by bitmaps
    shapes: getShapes(),
    scalar: 1.4,
    gravity: 0.75,
    ticks: 320,
  });
}
