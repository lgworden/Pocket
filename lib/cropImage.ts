const MAX_DIMENSION = 800;

export type BoundingBox = { x: number; y: number; width: number; height: number };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

// Crops a normalized (0-1) region out of a data URL client-side via canvas.
// Used by the "log my items" flow to turn one full outfit photo into a
// per-item preview thumbnail from Claude's approximate bounding box.
export function cropImage(
  dataUrl: string,
  box: BoundingBox
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = clamp01(box.x) * img.naturalWidth;
      const sy = clamp01(box.y) * img.naturalHeight;
      const sw = clamp01(box.width) * img.naturalWidth;
      const sh = clamp01(box.height) * img.naturalHeight;
      if (sw < 4 || sh < 4) return reject(new Error("bounding box too small"));

      const scale = Math.min(1, MAX_DIMENSION / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const cropped = canvas.toDataURL("image/jpeg", 0.75);
      resolve({ base64: cropped.split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => reject(new Error("couldn't load image for cropping"));
    img.src = dataUrl;
  });
}
