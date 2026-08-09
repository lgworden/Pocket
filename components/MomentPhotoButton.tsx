"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/compressImage";
import { isNativePlatform, pickNativePhoto } from "@/lib/nativePhoto";
import type { MomentWithMembers } from "@/lib/moments";

// Small "+ add" affordance that captures/picks a photo (compressed client-side),
// POSTs it to `endpoint`, and hands the refreshed moment back to `onUploaded`.
// Shared by the moodboard (inspo) and "add your fit" (candidate) strips.
//
// Preserves the two photo-picker invariants (see lib/nativePhoto.ts):
//   1. the native check is synchronous, before the web input's click, so the
//      transient user-activation a file picker needs isn't spent on an await;
//   2. no static @capacitor import — pickNativePhoto dynamic-imports it.
export default function MomentPhotoButton({
  endpoint,
  label,
  onUploaded,
}: {
  endpoint: string;
  label: string;
  onUploaded: (m: MomentWithMembers) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(img: { base64: string; mediaType: string }) {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: img.base64, mediaType: img.mediaType }),
      });
      if (res.ok) onUploaded(await res.json());
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload(await compressImage(file));
  }

  function handleClick(e: React.MouseEvent) {
    if (!isNativePlatform()) return; // web: let the <label> open the input itself
    e.preventDefault();
    void (async () => {
      const result = await pickNativePhoto("prompt");
      if (result.status === "photo") await upload(result);
    })();
  }

  return (
    <label
      onClick={handleClick}
      className="shrink-0 w-14 h-14 rounded-xl border border-dashed border-slate/40 text-slate flex items-center justify-center text-xs text-center leading-tight cursor-pointer hover:border-ink hover:text-ink"
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {busy ? "…" : label}
    </label>
  );
}
