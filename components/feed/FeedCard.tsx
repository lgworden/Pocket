"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  REACTIONS,
  VISIBILITY_STYLES,
  type FeedPost,
  type FeedReactionType,
} from "@/lib/feed";

// A single outfit post in the collage. The card background is tinted by
// visibility tier (see VISIBILITY_STYLES) so the feed reads as a color-coded
// mosaic. Reactions update optimistically, then reconcile with the server.
// The photo tile can flip to show the tagged items' brand/category/style —
// only populated when the post was shared from a logged outfit (post.items).
export default function FeedCard({ post }: { post: FeedPost }) {
  const style = VISIBILITY_STYLES[post.visibility];
  const [counts, setCounts] = useState(post.reaction_counts);
  const [mine, setMine] = useState<FeedReactionType[]>(post.my_reactions);
  const [pending, setPending] = useState<FeedReactionType | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // The browser starts fetching an SSR'd <img> before React hydrates, so a
  // fast local 404 can fire the (non-bubbling) error event before onError is
  // attached — catch that already-failed case on mount too.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth === 0) {
      setPhotoFailed(true);
    }
  }, []);

  async function react(reaction: FeedReactionType) {
    if (pending) return;
    setPending(reaction);

    // Optimistic flip
    const had = mine.includes(reaction);
    setMine((m) => (had ? m.filter((r) => r !== reaction) : [...m, reaction]));
    setCounts((c) => ({
      ...c,
      [reaction]: Math.max(0, (c[reaction] ?? 0) + (had ? -1 : 1)),
    }));

    try {
      const res = await fetch(`/api/feed/${post.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) throw new Error("react failed");
      const data = await res.json();
      setCounts(data.reaction_counts);
      setMine(data.my_reactions);
    } catch {
      // Roll back to server truth on failure
      setMine(post.my_reactions);
      setCounts(post.reaction_counts);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-soft-sm ${style.card}`}>
      <div className="relative w-full aspect-[4/5] [perspective:1000px]">
        <div
          className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* Front: photo (or a neutral placeholder if missing/broken) */}
          <div className="absolute inset-0 [backface-visibility:hidden]">
            {post.photo && !photoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={post.photo}
                alt={post.caption ?? "outfit"}
                className="w-full h-full object-cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-ui font-semibold text-ink/25 bg-ink/5">
                p
              </div>
            )}
          </div>

          {/* Back: tagged items' brand/category/style */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-cream p-2 overflow-y-auto">
            {post.items.length > 0 ? (
              <ul className="space-y-1.5">
                {post.items.map((item) => (
                  <li key={item.id} className="text-[11px] leading-snug">
                    <span className="font-medium text-ink">{item.name}</span>
                    <span className="block text-ink/50">
                      {[item.brand, item.category, ...item.tags.slice(0, 2)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-ink/40 italic">No outfit details for this post.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Show photo" : "Show outfit details"}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/50 text-cream flex items-center justify-center text-[11px] font-ui font-semibold backdrop-blur-sm"
        >
          {flipped ? "×" : "i"}
        </button>
      </div>

      <div className="p-2 space-y-1.5">
        <Link href={`/profile/${post.author_id}`} className="text-xs text-ink/60 truncate block hover:underline">
          {post.author_name}
        </Link>

        {post.caption && <p className="text-xs text-ink leading-snug">{post.caption}</p>}

        <div className="flex items-center gap-1 pt-0.5">
          {REACTIONS.map((r) => {
            const active = mine.includes(r.value);
            const count = counts[r.value] ?? 0;
            return (
              <button
                key={r.value}
                type="button"
                aria-label={r.label}
                aria-pressed={active}
                onClick={() => react(r.value)}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "bg-ink text-cream"
                    : "bg-cream/70 text-ink border border-slate/15 hover:border-slate/40"
                }`}
              >
                <span className="leading-none">{r.emoji}</span>
                {count > 0 && <span className="text-[10px] tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
