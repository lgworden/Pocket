// Native photo capture, used only when the app runs inside the Capacitor shell.
//
// Why this exists: a browser `<input type="file">` can't restrict the OS picker
// to "camera roll only" — the OS always offers a Files/Browse entry alongside
// Photos, and no attribute suppresses it. The native Camera plugin opens a
// genuine photo-library picker with no file-browser option, which is the only
// way to get that behavior.
//
// Deliberately dependency-free on the web path:
//   - platform detection reads the `window.Capacitor` global that the native
//     shell injects at runtime, rather than importing @capacitor/core, so the
//     web bundle gains nothing from this file being imported.
//   - @capacitor/camera is loaded via dynamic import *after* the native check,
//     so its chunk is code-split and browser users never fetch it.
// The native app loads the same deployed bundle as the web app (remote-server
// mode), so both paths have to coexist in one build — hence runtime detection
// rather than build-time branching.

import { compressImage } from "./compressImage";

// "prompt" is for the single-button pickers (avatar, outfit upload) that don't
// split capture/album — it opens the native sheet offering both, which still
// has no Files entry.
export type NativePhotoSource = "camera" | "album" | "prompt";

// Three outcomes the caller has to tell apart: "not native, go use the file
// input", "native but the user backed out, do nothing", and an actual photo.
// Collapsing cancel into unsupported would pop the web file picker right after
// the user dismissed the native one.
export type NativePhotoResult =
  | { status: "unsupported" }
  | { status: "cancelled" }
  | { status: "photo"; base64: string; mediaType: string };

export type NativeBlobResult =
  | { status: "unsupported" }
  | { status: "cancelled" }
  | { status: "photo"; blob: Blob };

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

// Raw picker. Callers that do their own compression (the outfit analyzer)
// use this directly so the image isn't JPEG-recompressed twice.
export async function pickNativeBlob(
  source: NativePhotoSource
): Promise<NativeBlobResult> {
  if (!isNativePlatform()) return { status: "unsupported" };

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );

    const photo = await Camera.getPhoto({
      quality: 90,
      // Uri keeps the big base64 payload off the JS bridge; we read the local
      // file into a Blob below instead.
      resultType: CameraResultType.Uri,
      // Photos = library only (no Files entry), Camera = straight to capture,
      // Prompt = native sheet offering both.
      source:
        source === "camera"
          ? CameraSource.Camera
          : source === "prompt"
            ? CameraSource.Prompt
            : CameraSource.Photos,
    });

    if (!photo.webPath) return { status: "cancelled" };

    const blob = await fetch(photo.webPath).then((r) => r.blob());
    return { status: "photo", blob };
  } catch (err) {
    // The plugin throws rather than resolving when the user dismisses the
    // sheet; that's a normal outcome, not an error worth surfacing.
    if (isCancellation(err)) return { status: "cancelled" };
    throw err;
  }
}

// Convenience wrapper for the majority of callers, which want the same
// {base64, mediaType} shape the web path produces via compressImage.
export async function pickNativePhoto(
  source: NativePhotoSource
): Promise<NativePhotoResult> {
  const result = await pickNativeBlob(source);
  if (result.status !== "photo") return result;
  const { base64, mediaType } = await compressImage(result.blob);
  return { status: "photo", base64, mediaType };
}

function isCancellation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /cancel/i.test(message);
}
