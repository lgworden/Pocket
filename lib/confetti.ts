import confetti from "canvas-confetti";

// Flat colored squares (not the default round dots) to match the app's flat,
// no-gradient visual language — reads like scraps of paper, not plastic confetti.
const BRAND_COLORS = ["#93A8BB", "#6B5A4F", "#DCB8B5", "#C9908C", "#2E2A24"];

export function celebrate() {
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 35,
    origin: { y: 0.6 },
    colors: BRAND_COLORS,
    shapes: ["square"],
    scalar: 0.9,
    gravity: 1.1,
    ticks: 220,
  });
}
