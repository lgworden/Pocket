import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Deliberately NOT under public/ — Next's production static-file server snapshots
// public/ at startup and 404s anything written there afterward, even though the
// file is genuinely on disk. Served instead via app/api/photos/[filename], a route
// handler that reads the file fresh on every request.
export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Local-disk photo storage for the prototype, served via /api/photos/[filename].
// Swap for the Railway volume / S3 bucket named in PHOTO_STORAGE_URL when that's wired up.
export async function saveBase64Photo(base64Data: string, mediaType: string): Promise<string> {
  const ext = EXT_BY_MEDIA_TYPE[mediaType] ?? "jpg";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(base64Data, "base64"));
  return `/api/photos/${filename}`;
}
