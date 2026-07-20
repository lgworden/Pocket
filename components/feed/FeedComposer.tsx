"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import { compressImage } from "@/lib/compressImage";
import { celebrate } from "@/lib/confetti";
import { VISIBILITY_OPTIONS, type FeedVisibility } from "@/lib/feed";

// Compose flow for a new feed post: pick a photo → choose who sees it →
// optional caption → share. Photo is compressed client-side and only uploaded
// on "Share", matching the Add Item flow's budget-conscious approach.
export default function FeedComposer({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<{ base64: string; mediaType: string } | null>(null);
  const [visibility, setVisibility] = useState<FeedVisibility>("friends");
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setPayload(null);
    setVisibility("friends");
    setCaption("");
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImage(file);
      setPayload(compressed);
      setPreview(`data:${compressed.mediaType};base64,${compressed.base64}`);
    } catch {
      setError("Couldn't read that photo — try another?");
    }
  }

  async function share() {
    if (!payload) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: payload.base64,
          mediaType: payload.mediaType,
          caption,
          visibility,
        }),
      });
      if (!res.ok) throw new Error("post failed");
      celebrate();
      reset();
      onPosted();
    } catch {
      setError("Couldn't share that — try again?");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Share an outfit">
      <div className="space-y-4">
        {/* Photo */}
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="outfit preview" className="w-full rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setPayload(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="absolute top-2 right-2 bg-ink/70 text-cream rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="aspect-square bg-blue/10 rounded-xl border border-dashed border-slate/40 flex flex-col items-center justify-center gap-2 cursor-pointer text-slate">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            <span className="text-3xl leading-none">＋</span>
            <span className="text-sm">Add a photo</span>
          </label>
        )}

        {/* Visibility */}
        <div>
          <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
            Who can see this?
          </label>
          <div className="mt-2 space-y-2">
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                    active
                      ? "bg-ink text-cream border-ink"
                      : "bg-transparent border-slate/20 hover:border-slate/40"
                  }`}
                >
                  <span className="text-sm font-medium block">{opt.label}</span>
                  <span className={`text-xs ${active ? "text-cream/70" : "text-slate/70"}`}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Caption */}
        <div>
          <label className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
            Caption (optional)
          </label>
          <textarea
            className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm resize-none"
            rows={2}
            placeholder="what's the fit story?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
            {error}
          </div>
        )}

        <button
          className="btn-primary w-full disabled:opacity-50"
          onClick={share}
          disabled={!payload || posting}
        >
          {posting ? "Sharing..." : "Share"}
        </button>
      </div>
    </Modal>
  );
}
