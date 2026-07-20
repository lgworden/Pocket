import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Local-disk photo storage for the prototype (public/uploads, served statically).
// Swap for the Railway volume / S3 bucket named in PHOTO_STORAGE_URL when that's wired up.
export async function saveBase64Photo(base64Data: string, mediaType: string): Promise<string> {
  const ext = EXT_BY_MEDIA_TYPE[mediaType] ?? "jpg";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(base64Data, "base64"));
  return `/uploads/${filename}`;
}
