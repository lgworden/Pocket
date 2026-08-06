"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import PhotoEditor from "@/components/feed/PhotoEditor";
import { compressImage } from "@/lib/compressImage";
import { isNativePlatform, pickNativePhoto } from "@/lib/nativePhoto";
import { celebrate } from "@/lib/confetti";
import { VISIBILITY_OPTIONS, type FeedVisibility } from "@/lib/feed";
import type { Friend } from "@/lib/friends";

// Compose flow for a new feed post: pick a photo → choose who sees it →
// optional caption, location, and friend tags → share. Photo is compressed
// client-side and only uploaded on "Share", matching the Add Item flow's
// budget-conscious approach.
//
// Two separate file inputs back the photo step: `capture="environment"` opens
// the camera directly on mobile, but it also *blocks* the album picker, so the
// album option needs its own input without the attribute.
export default function FeedComposer({
  open,
  onClose,
  onPosted,
  friends,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  friends: Friend[];
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<{ base64: string; mediaType: string } | null>(null);
  // Unfiltered source (data URL) kept around so re-editing starts from the original,
  // not an already-baked frame. `editing` toggles the filter step.
  const [origSrc, setOrigSrc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [visibility, setVisibility] = useState<FeedVisibility>("friends");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [taggedFriendIds, setTaggedFriendIds] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setPayload(null);
    setOrigSrc(null);
    setEditing(false);
    setVisibility("friends");
    setCaption("");
    setLocation("");
    setTaggedFriendIds([]);
    setError(null);
    clearInputs();
  }

  // Both inputs get cleared together so re-picking the same file still fires
  // onChange, whichever source it came from.
  function clearInputs() {
    if (cameraRef.current) cameraRef.current.value = "";
    if (albumRef.current) albumRef.current.value = "";
  }

  function toggleFriend(id: string) {
    setTaggedFriendIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  function close() {
    reset();
    onClose();
  }

  // Hand the compressed original to the filter step; the baked result becomes
  // the actual upload payload once the user picks a look. Shared by the web
  // file-input path and the native picker so both land in the same flow.
  function acceptPhoto(compressed: { base64: string; mediaType: string }) {
    setOrigSrc(`data:${compressed.mediaType};base64,${compressed.base64}`);
    setEditing(true);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      acceptPhoto(await compressImage(file));
    } catch {
      setError("Couldn't read that photo — try another?");
    }
  }

  // The native check is deliberately synchronous: on the web we must call
  // .click() inside the original event handler, since awaiting first would
  // spend the transient user activation that lets a file picker open at all.
  function choosePhoto(
    source: "camera" | "album",
    webInput: HTMLInputElement | null
  ) {
    setError(null);
    if (!isNativePlatform()) {
      webInput?.click();
      return;
    }
    void (async () => {
      try {
        const result = await pickNativePhoto(source);
        if (result.status === "photo") acceptPhoto(result);
      } catch {
        setError("Couldn't read that photo — try another?");
      }
    })();
  }

  function handleEdited(result: { base64: string; mediaType: string; previewUrl: string }) {
    setPayload({ base64: result.base64, mediaType: result.mediaType });
    setPreview(result.previewUrl);
    setEditing(false);
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
          location,
          taggedFriendIds,
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

  // Filter/edit step takes over the whole modal while active.
  if (editing && origSrc) {
    return (
      <Modal open={open} onClose={close} title="Edit photo">
        <PhotoEditor
          src={origSrc}
          onCancel={() => {
            setEditing(false);
            // No baked result yet → drop back to the empty picker.
            if (!payload) {
              setOrigSrc(null);
              clearInputs();
            }
          }}
          onDone={handleEdited}
        />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title="Share fit">
      <div className="space-y-4">
        {/* Photo */}
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="outfit preview" className="w-full rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="absolute bottom-2 right-2 bg-ink/70 text-cream rounded-full px-3 h-8 flex items-center justify-center text-xs font-medium gap-1"
              aria-label="Edit photo"
            >
              ✎ Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setPayload(null);
                setOrigSrc(null);
                clearInputs();
              }}
              className="absolute top-2 right-2 bg-ink/70 text-cream rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="aspect-square bg-blue/10 rounded-xl border border-dashed border-slate/40 flex flex-col items-center justify-center gap-4 text-slate px-6">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            <input
              ref={albumRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <span className="text-sm">Add a photo</span>
            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={() => choosePhoto("camera", cameraRef.current)}
                className="w-full rounded-xl bg-ink text-cream text-sm font-ui font-semibold py-2.5 flex items-center justify-center gap-2"
              >
                capture
              </button>
              <button
                type="button"
                onClick={() => choosePhoto("album", albumRef.current)}
                className="w-full rounded-xl bg-transparent border border-slate/30 text-ink text-sm font-ui font-semibold py-2.5 flex items-center justify-center gap-2 hover:border-slate/50 transition-colors"
              >
                album
              </button>
            </div>
          </div>
        )}

        {/* Visibility */}
        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
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
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Caption
          </label>
          <textarea
            className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm resize-none"
            rows={2}
            placeholder="what's the fit story?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {/* Location */}
        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Location
          </label>
          <input
            type="text"
            className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
            placeholder="where was this?"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Tag friends */}
        {friends.length > 0 && (
          <div>
            <label className="text-xs font-ui font-semibold text-slate tracking-wide">
              Tag friends
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {friends.map((f) => {
                const active = taggedFriendIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleFriend(f.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      active
                        ? "bg-ink text-cream border-ink"
                        : "bg-transparent text-ink border-slate/25 hover:border-slate/45"
                    }`}
                  >
                    {active ? "✓ " : ""}
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
