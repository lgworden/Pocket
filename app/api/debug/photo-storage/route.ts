import { NextResponse } from "next/server";
import { mkdir, writeFile, readdir, readFile } from "fs/promises";
import path from "path";

// Temporary diagnostic route for the "photo doesn't save" bug — safe to delete once resolved.
export async function GET() {
  const cwd = process.cwd();
  const uploadDir = path.join(cwd, "public", "uploads");
  const result: Record<string, unknown> = { cwd, uploadDir };

  try {
    await mkdir(uploadDir, { recursive: true });
    result.mkdirOk = true;
  } catch (err) {
    result.mkdirError = err instanceof Error ? err.message : String(err);
  }

  try {
    result.existingFiles = await readdir(uploadDir);
  } catch (err) {
    result.readdirError = err instanceof Error ? err.message : String(err);
  }

  const testFile = path.join(uploadDir, "debug-test.txt");
  try {
    await writeFile(testFile, "hello from debug route");
    result.writeOk = true;
  } catch (err) {
    result.writeError = err instanceof Error ? err.message : String(err);
  }

  try {
    result.readBack = (await readFile(testFile, "utf8"));
  } catch (err) {
    result.readBackError = err instanceof Error ? err.message : String(err);
  }

  try {
    result.publicDirContents = await readdir(path.join(cwd, "public"));
  } catch (err) {
    result.publicDirError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(result);
}
