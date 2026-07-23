// Pre-built photo filter presets for feed posts + the canvas "bake" that flattens
// a chosen look into the final JPEG that gets uploaded. The star of the set is the
// grainy point-and-shoot "digicam" look (grain + warm cast + optional date stamp) —
// the effect gen-z reaches for. Everything runs client-side on <canvas>, so no
// server-only imports here: this file is pulled into the composer's client bundle.

export type FilterPreset = {
  id: string;
  name: string;
  // A CSS/canvas `filter` string applied to the base image (the color grade).
  css: string;
  // Default film-grain amount, 0–1. Doubles as the grain slider's starting value.
  grain: number;
  // Darkened-edge vignette strength, 0–1.
  vignette: number;
  // Optional color cast, blended soft-light over the image.
  tint: string | null;
  tintAlpha: number;
  // Whether the orange camcorder date stamp is on by default (digicam vibe).
  dateStamp: boolean;
};

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "original",
    name: "Original",
    css: "none",
    grain: 0,
    vignette: 0,
    tint: null,
    tintAlpha: 0,
    dateStamp: false,
  },
  {
    id: "digicam",
    name: "Digicam",
    css: "contrast(1.15) saturate(1.18) brightness(1.05)",
    grain: 0.55,
    vignette: 0.28,
    tint: "255,214,150",
    tintAlpha: 0.08,
    dateStamp: true,
  },
  {
    id: "flash",
    name: "Flash",
    css: "contrast(1.28) brightness(1.12) saturate(0.95)",
    grain: 0.4,
    vignette: 0.42,
    tint: "180,200,255",
    tintAlpha: 0.05,
    dateStamp: false,
  },
  {
    id: "faded",
    name: "Faded",
    css: "contrast(0.9) saturate(0.88) brightness(1.08) sepia(0.14)",
    grain: 0.32,
    vignette: 0.16,
    tint: "255,224,190",
    tintAlpha: 0.06,
    dateStamp: false,
  },
  {
    id: "noir",
    name: "Noir",
    css: "grayscale(1) contrast(1.22) brightness(1.02)",
    grain: 0.6,
    vignette: 0.36,
    tint: null,
    tintAlpha: 0,
    dateStamp: false,
  },
  {
    id: "golden",
    name: "Golden",
    css: "sepia(0.35) saturate(1.35) contrast(1.06) brightness(1.05)",
    grain: 0.34,
    vignette: 0.22,
    tint: "255,178,88",
    tintAlpha: 0.1,
    dateStamp: false,
  },
  {
    id: "cyber",
    name: "Cyber",
    css: "hue-rotate(-8deg) saturate(1.24) contrast(1.12)",
    grain: 0.44,
    vignette: 0.24,
    tint: "120,160,255",
    tintAlpha: 0.08,
    dateStamp: false,
  },
  {
    id: "y2k",
    name: "Y2K",
    css: "saturate(1.5) contrast(1.15) brightness(1.06)",
    grain: 0.3,
    vignette: 0.12,
    tint: "255,120,200",
    tintAlpha: 0.09,
    dateStamp: false,
  },
  {
    id: "vhs",
    name: "VHS",
    css: "saturate(1.35) contrast(1.18) hue-rotate(6deg) brightness(1.04)",
    grain: 0.65,
    vignette: 0.4,
    tint: "120,255,220",
    tintAlpha: 0.07,
    dateStamp: true,
  },
  {
    id: "dreamy",
    name: "Dreamy",
    css: "contrast(0.92) brightness(1.12) saturate(1.08) blur(0.4px)",
    grain: 0.18,
    vignette: 0.1,
    tint: "255,180,215",
    tintAlpha: 0.08,
    dateStamp: false,
  },
  {
    id: "frost",
    name: "Frost",
    css: "saturate(0.72) contrast(1.08) brightness(1.05)",
    grain: 0.28,
    vignette: 0.2,
    tint: "150,190,230",
    tintAlpha: 0.1,
    dateStamp: false,
  },
  {
    id: "sunset",
    name: "Sunset",
    css: "saturate(1.28) contrast(1.06) brightness(1.04) sepia(0.12)",
    grain: 0.3,
    vignette: 0.24,
    tint: "255,140,90",
    tintAlpha: 0.12,
    dateStamp: false,
  },
  {
    id: "mocha",
    name: "Mocha",
    css: "sepia(0.28) saturate(1.1) contrast(1.12) brightness(0.96)",
    grain: 0.42,
    vignette: 0.34,
    tint: "150,100,60",
    tintAlpha: 0.12,
    dateStamp: false,
  },
];

export const DEFAULT_PRESET_ID = "digicam";

// A single reusable tile of monochrome noise. Generated once and shared between the
// live CSS preview (as a data URL) and the canvas bake (as a fill pattern) so the
// grain the user sees is the grain that gets saved.
let noiseTile: HTMLCanvasElement | null = null;
let noiseDataUrl: string | null = null;

function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

// Data URL of the noise tile — for the live-preview grain overlay's background-image.
export function getNoiseDataUrl(): string {
  if (noiseDataUrl) return noiseDataUrl;
  noiseDataUrl = getNoiseTile().toDataURL("image/png");
  return noiseDataUrl;
}

// Formats "today" the way a mid-2000s point-and-shoot burned it into the corner.
export function dateStampText(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${yy} ${mm} ${dd}`;
}

export type BakeOptions = {
  preset: FilterPreset;
  // Overrides preset.grain (the slider). 0–1.
  grain: number;
  // Whether to burn the date stamp in, independent of the preset default.
  dateStamp: boolean;
};

// Flattens the chosen look onto a fresh canvas and returns base64 JPEG (no data-URL
// prefix) plus its media type — the exact shape the feed upload/compress path uses.
export function bakeFilter(
  source: HTMLImageElement,
  { preset, grain, dateStamp }: BakeOptions
): { base64: string; mediaType: string } {
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // 1. Color grade.
  ctx.filter = preset.css === "none" ? "none" : preset.css;
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = "none";

  // 2. Color cast.
  if (preset.tint && preset.tintAlpha > 0) {
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = preset.tintAlpha;
    ctx.fillStyle = `rgb(${preset.tint})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // 3. Film grain, tiled across the frame.
  if (grain > 0) {
    const pattern = ctx.createPattern(getNoiseTile(), "repeat");
    if (pattern) {
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = grain * 0.5;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // 4. Vignette.
  if (preset.vignette > 0) {
    const grad = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${preset.vignette})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // 5. Date stamp.
  if (dateStamp) {
    const fontPx = Math.round(Math.max(w, h) * 0.032);
    ctx.font = `${fontPx}px "Courier New", monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const pad = fontPx;
    const text = dateStampText();
    ctx.shadowColor = "rgba(255,120,0,0.9)";
    ctx.shadowBlur = fontPx * 0.5;
    ctx.fillStyle = "#ffb200";
    ctx.fillText(text, w - pad, h - pad);
    ctx.shadowBlur = 0;
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}
