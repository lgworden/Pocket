"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compressImage";

// Circular profile photo. Read-only for everyone except the profile's owner,
// who can tap it to capture/upload a new one (compressed client-side, same
// pattern as AddPhotoButton).
export default function AvatarUpload({
  avatar,
  name,
  editable,
}: {
  avatar: string | null;
  name: string;
  editable: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = (() => {
    const parts = name.trim().split(/\s+/);
    const chars = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0]];
    return chars.join("").toUpperCase();
  })();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { base64, mediaType } = await compressImage(file);
      await fetch("/api/users/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      router.refresh();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const circle = (
    <div className="w-16 h-16 rounded-full bg-brown text-cream flex items-center justify-center text-xl font-display shrink-0 overflow-hidden">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{uploading ? "…" : initials}</span>
      )}
    </div>
  );

  if (!editable) return circle;

  return (
    <label className="relative shrink-0 cursor-pointer">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {circle}
      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center text-[11px] leading-none border-2 border-panel">
        +
      </span>
    </label>
  );
}
