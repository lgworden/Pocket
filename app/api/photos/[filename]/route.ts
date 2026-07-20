import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/photos";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Serves photos saveBase64Photo wrote to disk. A route handler (not public/)
// because Next's static file server won't pick up files added after startup.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const filename = path.basename(params.filename);
  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!contentType) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }

  try {
    const buf = await readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
