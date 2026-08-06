// Native photo capture, used only when the app runs inside the Capacitor shell.
//
// Why this exists: a browser `<input type="file">` can't restrict the OS picker
// to "camera roll only" — the OS always offers a Files/Browse entry alongside
// Photos, and no attribute suppresses it. The native Camera plugin opens a
// genuine photo-library picker with no file-browser option, which is the only
// way to get that behavior.
//
// The app's own PhotoSourceSheet later reintroduced a Files option on native
// as a deliberate 2-choice menu (Photo Library / Choose File). @capacitor/camera
// has no Files source of its own, and falling back to the plain <input
// type="file"> for "Choose File" turned out to be the wrong call: on iOS that
// input's default action sheet bundles in "Take Photo" too, duplicating the
// separate capture button. @capawesome/capacitor-file-picker's pickFiles()
// opens the OS document picker on its own (UIDocumentPickerViewController on
// iOS, Storage Access Framework on Android) with no Photos/Camera mixed in,
// which is what actually gets a clean, non-redundant "Choose File".
//
// Deliberately dependency-free on the web path:
//   - platform detection reads the `window.Capacitor` global that the native
//     shell injects at runtime, rather than importing @capacitor/core, so the
//     web bundle gains nothing from this file being imported.
//   - @capacitor/camera, @capawesome/capacitor-file-picker, and @capacitor/core
//     are all loaded via dynamic import *after* the native check, so those
//     chunks are code-split and browser users never fetch them.
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

// The "Choose File" half of PhotoSourceSheet: opens the OS document picker
// directly, with no Photos/Camera options bundled in (unlike a plain web file
// input on iOS, which is exactly the redundancy this was built to avoid).
export async function pickNativeFileBlob(): Promise<NativeBlobResult> {
  if (!isNativePlatform()) return { status: "unsupported" };

  try {
    const { FilePicker } = await import("@capawesome/capacitor-file-picker");
    // No `limit` here: the plugin's own type declares that `types` is ignored
    // whenever `limit` is set, so passing both would silently drop the
    // image/* filter and let the user pick any file. Multi-select is still
    // possible without `limit`, so just take the first pick if there is one.
    const result = await FilePicker.pickFiles({ types: ["image/*"] });
    const file = result.files[0];
    if (!file) return { status: "cancelled" };

    // Web provides a Blob directly; native gives a path that needs converting
    // to a webview-loadable URL first. (PhotoSourceSheet only opens this on
    // native, but handling both keeps this function honest about its type.)
    if (file.blob) return { status: "photo", blob: file.blob };
    if (!file.path) return { status: "cancelled" };

    const { Capacitor } = await import("@capacitor/core");
    const blob = await fetch(Capacitor.convertFileSrc(file.path)).then((r) =>
      r.blob()
    );
    return { status: "photo", blob };
  } catch (err) {
    if (isCancellation(err)) return { status: "cancelled" };
    throw err;
  }
}

export async function pickNativeFile(): Promise<NativePhotoResult> {
  const result = await pickNativeFileBlob();
  if (result.status !== "photo") return result;
  const { base64, mediaType } = await compressImage(result.blob);
  return { status: "photo", base64, mediaType };
}

function isCancellation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /cancel/i.test(message);
}
