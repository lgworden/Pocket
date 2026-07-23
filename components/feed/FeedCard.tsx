"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  REACTIONS,
  VISIBILITY_STYLES,
  type FeedComment,
  type FeedPost,
  type FeedReactionType,
} from "@/lib/feed";

// A single outfit post in the collage. The card background is tinted by
// visibility tier (see VISIBILITY_STYLES) so the feed reads as a color-coded
// mosaic. Reactions update optimistically, then reconcile with the server.
// The photo tile can flip to show the tagged items' brand/category/style —
// only populated when the post was shared from a logged outfit (post.items) —
// plus the comment thread. Tapping the comment count (next to the reaction
// chips) flips the card; the comment box lives only on the back, so posting
// one always leaves you looking at the thread.
export default function FeedCard({
  post,
  onDeleted,
}: {
  post: FeedPost;
  onDeleted?: (id: string) => void;
}) {
  const style = VISIBILITY_STYLES[post.visibility];
  const [counts, setCounts] = useState(post.reaction_counts);
  const [mine, setMine] = useState<FeedReactionType[]>(post.my_reactions);
  const [pending, setPending] = useState<FeedReactionType | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>(post.comments);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
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

  async function submitComment() {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);

    // Optimistic bubble while the request is in flight; reconciled with the
    // server's full list (which has the real id + resolved author name) below.
    const optimistic: FeedComment = {
      id: `temp-${Date.now()}`,
      author_id: "me",
      author_name: "You",
      body,
      created_at: new Date().toISOString(),
    };
    setComments((c) => [...c, optimistic]);
    setCommentCount((n) => n + 1);
    setDraft("");

    try {
      const res = await fetch(`/api/feed/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("comment failed");
      const data = await res.json();
      setComments(data.comments);
      setCommentCount(data.comment_count);
    } catch {
      // Roll back to server truth on failure and give the text back.
      setComments(post.comments);
      setCommentCount(post.comment_count);
      setDraft(body);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/feed/${post.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      onDeleted?.(post.id);
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
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

          {/* Back: location, tagged friends, the outfit's items, and comments */}
          <div
            className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-cream flex flex-col ${
              post.is_mine ? "pl-8" : ""
            }`}
          >
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {post.location && (
                <div className="flex items-start gap-1 text-[11px] leading-snug text-ink">
                  {/* pin glyph */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-ink/50">
                    <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="font-medium">{post.location}</span>
                </div>
              )}

              {post.tagged_friends.length > 0 && (
                <div className="flex items-start gap-1 text-[11px] leading-snug text-ink">
                  {/* people glyph */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-ink/50">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>
                    with{" "}
                    {post.tagged_friends.map((f, i) => (
                      <span key={f.id}>
                        {i > 0 && ", "}
                        <Link href={`/profile/${f.id}`} className="font-medium hover:underline">
                          {f.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {post.items.length > 0 && (
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
              )}

              {!post.location &&
                post.tagged_friends.length === 0 &&
                post.items.length === 0 &&
                comments.length === 0 && (
                  <p className="text-[11px] text-ink/40 italic">No details for this post.</p>
                )}

              {comments.length > 0 && (
                <ul className="space-y-1.5 pt-0.5">
                  {comments.map((c) => (
                    <li key={c.id} className="text-[11px] leading-snug">
                      {/* Optimistic bubble has a placeholder author_id (not a real
                          profile) until it reconciles with the server — plain text
                          until then. */}
                      {c.id.startsWith("temp-") ? (
                        <span className="font-medium text-ink">{c.author_name}</span>
                      ) : (
                        <Link href={`/profile/${c.author_id}`} className="font-medium text-ink hover:underline">
                          {c.author_name}
                        </Link>
                      )}{" "}
                      <span className="text-ink/70">{c.body}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Comment composer — the only place a comment can be added, so posting
                one always leaves the viewer on the back, looking at the thread. */}
            <div className="shrink-0 flex items-center gap-1.5 border-t border-slate/15 p-1.5">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitComment();
                }}
                placeholder="Add a comment…"
                maxLength={500}
                disabled={posting}
                className="flex-1 min-w-0 bg-transparent border border-slate/25 rounded-full px-2.5 py-1 text-[11px] focus:outline-none focus:border-slate/50 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={!draft.trim() || posting}
                aria-label="Post comment"
                className="shrink-0 w-6 h-6 rounded-full bg-ink text-cream flex items-center justify-center disabled:opacity-30"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFlipped((f) => !f);
            setConfirmingDelete(false);
          }}
          aria-label={flipped ? "Show photo" : "Show outfit details"}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/50 text-cream flex items-center justify-center backdrop-blur-sm"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-500 ${flipped ? "rotate-180" : ""}`}
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </button>

        {post.is_mine && flipped && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete post"
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-ink/50 text-cream flex items-center justify-center text-[11px] backdrop-blur-sm"
          >
            🗑
          </button>
        )}

        {confirmingDelete && flipped && (
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3 text-center">
            <p className="text-xs text-cream font-ui font-semibold">Delete this post?</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-full bg-rose px-3 py-1 text-[11px] font-ui font-semibold text-cream disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full bg-cream/20 px-3 py-1 text-[11px] font-ui font-semibold text-cream disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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

          {/* Flip to the back to read/add comments — there's no other entry point. */}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-label="View comments"
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs bg-cream/70 text-ink border border-slate/15 hover:border-slate/40 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
            </svg>
            {commentCount > 0 && <span className="text-[10px] tabular-nums">{commentCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
