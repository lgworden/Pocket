import { readFile } from "fs/promises";
import path from "path";
import pool from "./db";
import { saveBase64Photo } from "./photos";

// The look we ask the image model for — a loose, hand-drawn fashion croquis
// rather than a faithful product render. Kept as a constant so the aesthetic is
// tuned in one place and stays consistent across the whole closet.
const SKETCH_PROMPT =
  "Redraw this clothing item as a loose, hand-drawn fashion designer's sketch — " +
  "the kind of quick pencil-and-ink croquis you'd see in a fashion sketchbook. " +
  "Visible pencil strokes, light cross-hatching for shading, a few soft watercolor " +
  "washes hinting at the garment's real colors, on an off-white paper background. " +
  "Just the garment, centered, no model, no mannequin, no text or labels.";

export type SketchItemMeta = {
  name: string;
  category: string;
  colors: string[];
};

// Reads a locally-stored photo (public/uploads/xxx) back into a Blob so it can
// be posted to the image-edit endpoint. Photos live on disk in dev; when
// PHOTO_STORAGE_URL points at a bucket this is the one spot to swap for a fetch.
async function loadPhotoBlob(photoUrl: string): Promise<Blob> {
  const rel = photoUrl.replace(/^\//, "");
  const abs = path.join(process.cwd(), "public", rel);
  const buf = await readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return new Blob([buf], { type });
}

// --- Provider seam -------------------------------------------------------
// Everything above the line is provider-agnostic. Only this function knows it's
// OpenAI; swapping to Replicate/fal/Stability is a change confined to here.
// Anthropic is intentionally NOT used — Claude reads images but can't draw them.
async function renderSketchBase64(photoBlob: Blob, meta: SketchItemMeta): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Sketch generation isn't configured — set OPENAI_API_KEY to enable it."
    );
  }

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image", photoBlob, "item.jpg");
  form.append(
    "prompt",
    `${SKETCH_PROMPT}\n\nThe item is a ${meta.colors.join("/")} ${meta.category} ("${meta.name}").`
  );
  form.append("size", "1024x1024");
  // 'low' keeps per-sketch cost down; the rough-sketch look doesn't need detail.
  form.append("quality", "low");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Image model rejected the request (${res.status}). ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image model returned no image.");
  return b64;
}

// Generates a sketch from an item's stored photo, saves it to photo storage,
// and returns the public URL. Caller is responsible for persisting it on the
// item row. Throws (rather than returning null) so the route can surface a
// specific message — this is user-initiated, so silent failure would confuse.
export async function generateSketchForPhoto(
  photoUrl: string,
  meta: SketchItemMeta
): Promise<string> {
  const photoBlob = await loadPhotoBlob(photoUrl);
  const b64 = await renderSketchBase64(photoBlob, meta);
  return saveBase64Photo(b64, "image/png");
}

// Enriches recommendation outfits with each item's stored sketch (null when the
// user hasn't generated one). Used by both the Claude and shuffle-favs flows so
// recommendation cards can show sketches wherever they exist. One query for the
// whole set of display_ids rather than per-item.
export async function attachSketchesToOutfits<
  T extends { items: Array<{ display_id: string; name: string }> }
>(userId: string, outfits: T[]): Promise<Array<T & { items: Array<{ display_id: string; name: string; sketch: string | null }> }>> {
  const displayIds = Array.from(
    new Set(outfits.flatMap((o) => o.items.map((i) => i.display_id)))
  );
  if (displayIds.length === 0) return outfits as never;

  const { rows } = await pool.query<{ display_id: string; sketch: string | null }>(
    `SELECT display_id, sketch FROM items WHERE user_id = $1 AND display_id = ANY($2)`,
    [userId, displayIds]
  );
  const sketchByDisplayId = new Map(rows.map((r) => [r.display_id, r.sketch]));

  return outfits.map((o) => ({
    ...o,
    items: o.items.map((i) => ({
      ...i,
      sketch: sketchByDisplayId.get(i.display_id) ?? null,
    })),
  })) as never;
}
