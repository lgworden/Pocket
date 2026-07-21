import { readFile } from "fs/promises";
import path from "path";
import pool from "./db";
import { saveBase64Photo, UPLOAD_DIR } from "./photos";

// The look we ask the image model for — a single hand-drawn fashion illustration
// of the WHOLE outfit assembled as one styled look, not separate item cut-outs.
// Kept as a constant so the aesthetic is tuned in one place and stays consistent.
const MOCKUP_PROMPT =
  "Combine these clothing items into a single outfit and draw them as one loose, " +
  "hand-drawn fashion illustration — the kind of quick pencil-and-ink croquis " +
  "you'd see in a designer's sketchbook. Arrange the pieces together as a styled " +
  "flat-lay of the complete look (top, bottom, shoes and any accessories laid out " +
  "as one outfit). Visible pencil strokes, light cross-hatching for shading, a few " +
  "soft watercolor washes hinting at the real colors, on an off-white paper " +
  "background. No model, no mannequin, no text or labels.";

export type MockupItem = { display_id: string; name: string; photos?: string[] };

// Stable cache key for a SET of pieces: sorted display_ids joined. Order-independent
// so the same outfit never regenerates just because Claude listed items differently.
export function outfitKey(displayIds: string[]): string {
  return Array.from(new Set(displayIds)).sort().join(",");
}

// Reads a locally-stored photo (/api/photos/xxx -> data/uploads/xxx on disk) back
// into a Blob so it can be posted to the image-edit endpoint. Photos live on disk
// in dev; when PHOTO_STORAGE_URL points at a bucket this is the one spot to swap.
async function loadPhotoBlob(photoUrl: string): Promise<Blob> {
  const filename = path.basename(photoUrl);
  const abs = path.join(UPLOAD_DIR, filename);
  const buf = await readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return new Blob([buf], { type });
}

// --- Provider seam -------------------------------------------------------
// Everything above the line is provider-agnostic. Only this function knows it's
// OpenAI; swapping to Replicate/fal/Stability is a change confined to here.
// Anthropic is intentionally NOT used — Claude reads images but can't draw them.
// gpt-image-1's edits endpoint accepts multiple input images (image[]), which is
// what lets us compose several garment photos into one outfit illustration.
async function renderMockupBase64(photoBlobs: Blob[], items: MockupItem[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Mockup generation isn't configured — set OPENAI_API_KEY to enable it."
    );
  }

  const form = new FormData();
  form.append("model", "gpt-image-1");
  photoBlobs.forEach((blob, i) => form.append("image[]", blob, `item-${i}.png`));
  const pieces = items.map((it) => it.name).join(", ");
  form.append("prompt", `${MOCKUP_PROMPT}\n\nThe pieces are: ${pieces}.`);
  form.append("size", "1024x1024");
  // 'low' keeps per-mockup cost down; the rough-sketch look doesn't need detail.
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

// Returns a composed outfit mockup URL for the given set of items, generating one
// only on a cache miss. Cache is keyed by the exact set of pieces per user, so
// repeat combinations (and every shuffle-favs replay) are free. Returns null when
// none of the items have a photo to draw from — the caller renders nothing then.
export async function composeOutfitMockup(
  userId: string,
  items: MockupItem[]
): Promise<string | null> {
  const displayIds = items.map((it) => it.display_id);
  if (displayIds.length === 0) return null;
  const key = outfitKey(displayIds);

  const cached = await pool.query<{ mockup_url: string }>(
    `SELECT mockup_url FROM outfit_mockups WHERE user_id = $1 AND item_key = $2`,
    [userId, key]
  );
  if (cached.rows[0]) return cached.rows[0].mockup_url;

  // Only items that actually carry a photo can be drawn.
  const withPhotos = items.filter((it) => it.photos && it.photos.length > 0);
  if (withPhotos.length === 0) return null;

  const blobs = await Promise.all(withPhotos.map((it) => loadPhotoBlob(it.photos![0])));
  const b64 = await renderMockupBase64(blobs, withPhotos);
  const mockupUrl = await saveBase64Photo(b64, "image/png");

  // ON CONFLICT guards against a race if the same outfit is requested twice at
  // once (auto-fetch fires per card); the second insert no-ops and we keep the
  // first URL rather than generating — and paying — twice.
  await pool.query(
    `INSERT INTO outfit_mockups (user_id, item_key, mockup_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, item_key) DO NOTHING`,
    [userId, key, mockupUrl]
  );
  return mockupUrl;
}

// Resolves the photos for a set of display_ids from the closet, so the mockup
// endpoint only needs the display_ids the recommendation already carries.
export async function loadMockupItems(
  userId: string,
  displayIds: string[]
): Promise<MockupItem[]> {
  if (displayIds.length === 0) return [];
  const { rows } = await pool.query<{ display_id: string; name: string; photos: string[] }>(
    `SELECT display_id, name, photos FROM items WHERE user_id = $1 AND display_id = ANY($2)`,
    [userId, displayIds]
  );
  return rows;
}
