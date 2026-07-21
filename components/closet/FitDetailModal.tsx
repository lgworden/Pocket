"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { VISIBILITY_OPTIONS, type FeedVisibility } from "@/lib/feed";
import type { LoggedFit } from "@/components/closet/LogFitComposer";

const SHARE_OPTIONS = VISIBILITY_OPTIONS.filter((o) => o.value !== "private");

// Detail view for a single logged fit: full photo, tagged items (linking back
// into the closet), and an optional bridge to the public Feed. Private by
// default — sharing is an explicit, separate action, not automatic.
export default function FitDetailModal({
  fit,
  onClose,
  onShared,
}: {
  fit: LoggedFit | null;
  onClose: () => void;
  onShared: (id: string) => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [visibility, setVisibility] = useState<FeedVisibility>("friends");
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setSharing(false);
    setCaption("");
    setError(null);
    onClose();
  }

  async function share() {
    if (!fit) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/outfit-logs/${fit.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, visibility }),
      });
      if (!res.ok) throw new Error("share failed");
      onShared(fit.id);
      setSharing(false);
      setCaption("");
    } catch {
      setError("Couldn't share that — try again?");
    } finally {
      setPosting(false);
    }
  }

  if (!fit) return null;

  return (
    <Modal open={!!fit} onClose={close} title={sharing ? "Share to feed" : "Recent fit"}>
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fit.photo} alt="logged fit" className="w-full rounded-xl object-cover" />

        {!sharing ? (
          <>
            <p className="text-xs text-slate/60">
              {new Date(fit.created_at).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>

            {fit.notes && <p className="text-sm text-ink leading-snug">{fit.notes}</p>}

            {fit.tagged_items.length > 0 && (
              <div>
                <p className="text-xs font-ui font-semibold text-slate tracking-wide mb-2">
                  Wearing
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {fit.tagged_items.map((item) => (
                    <Link
                      key={item.id}
                      href={`/closet/${item.id}`}
                      className="tag tag-outline"
                    >
                      {item.display_id} · {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {fit.shared_to_feed ? (
              <div className="text-xs text-slate/60 text-center py-1">✓ shared to feed</div>
            ) : (
              <button className="btn-secondary w-full" onClick={() => setSharing(true)}>
                Share to feed
              </button>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              {SHARE_OPTIONS.map((opt) => {
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

            <textarea
              className="w-full bg-transparent border border-slate/20 rounded-lg p-2 text-sm resize-none"
              rows={2}
              placeholder="what's the fit story?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />

            {error && (
              <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => setSharing(false)}
                disabled={posting}
              >
                Back
              </button>
              <button
                className="btn-primary flex-1 disabled:opacity-50"
                onClick={share}
                disabled={posting}
              >
                {posting ? "Sharing..." : "Share"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
