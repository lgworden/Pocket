"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compressImage";

// Compact tap target for items with no photo yet — deliberately not a blank
// image block. Captures, compresses, and uploads a photo inline from a list row.
export default function AddPhotoButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { base64, mediaType } = await compressImage(file);
      await fetch(`/api/items/${itemId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      router.refresh();
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="w-14 h-14 flex items-center justify-center rounded-xl border border-dashed border-slate/50 text-slate cursor-pointer"
      >
        <span className="text-lg leading-none">{uploading ? "…" : "+"}</span>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 w-40 card p-1 shadow-lg">
            <button
              type="button"
              className="w-full text-left text-sm px-2 py-2 rounded-lg hover:bg-blue/10"
              onClick={() => {
                setMenuOpen(false);
                cameraInputRef.current?.click();
              }}
            >
              capture
            </button>
            <button
              type="button"
              className="w-full text-left text-sm px-2 py-2 rounded-lg hover:bg-blue/10"
              onClick={() => {
                setMenuOpen(false);
                uploadInputRef.current?.click();
              }}
            >
              album
            </button>
          </div>
        </>
      )}
    </div>
  );
}
