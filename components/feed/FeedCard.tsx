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
import type { Friend } from "@/lib/friends";
import Modal from "@/components/Modal";
import { celebrate } from "@/lib/confetti";

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
  // Candidates for "@" mentions in the comment box. Optional: callers that
  // don't have the viewer's friend list to hand (e.g. a profile page) still
  // render a working card, just without mention suggestions.
  friends = [],
  onDeleted,
}: {
  post: FeedPost;
  friends?: Friend[];
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
  const [mentionSuggestions, setMentionSuggestions] = useState<Friend[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [resharing, setResharing] = useState(false);
  const [resharePosting, setResharePosting] = useState(false);
  const [reshareError, setReshareError] = useState<string | null>(null);
  const [reshareCaption, setReshareCaption] = useState("");
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

  function handleCommentChange(text: string) {
    setDraft(text);

    const atIndex = text.lastIndexOf("@");
    if (atIndex === -1) {
      setShowMentions(false);
      return;
    }

    const afterAt = text.substring(atIndex + 1);
    if (afterAt.includes(" ")) {
      setShowMentions(false);
      return;
    }

    setMentionStartIndex(atIndex);
    const query = afterAt.toLowerCase();

    if (query.length === 0) {
      setMentionSuggestions(friends);
      setShowMentions(true);
    } else {
      const filtered = friends.filter((f) =>
        f.name.toLowerCase().includes(query)
      );
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
    }
  }

  // Replaces the partial "@que" the caret sits in with the full handle. Only
  // the text before the "@" is kept — handleCommentChange guarantees the
  // remainder is the (space-free) query itself.
  function insertMention(friend: Friend) {
    const beforeAt = draft.slice(0, mentionStartIndex);
    setDraft(`${beforeAt}@${friend.name} `);
    setShowMentions(false);
    setMentionSuggestions([]);
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

  async function handleReshare() {
    setResharePosting(true);
    setReshareError(null);
    try {
      // Fetch the image and convert to base64
      const imgRes = await fetch(post.photo);
      if (!imgRes.ok) throw new Error("failed to fetch image");
      const blob = await imgRes.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mediaType: blob.type || "image/jpeg",
          caption: reshareCaption.trim() || post.caption || null,
          visibility: post.visibility,
          location: post.location,
        }),
      });
      if (!res.ok) throw new Error("reshare failed");
      setResharing(false);
      setReshareCaption("");
      celebrate();
    } catch {
      setReshareError("Couldn't reshare that — try again?");
    } finally {
      setResharePosting(false);
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
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-cream flex flex-col">
            {/* pt-8 clears the delete/reshare icon (mutually exclusive: own vs.
                tagged posts) which floats over this top-right corner — without
                it, it sits on the first line of text. */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 pt-8 space-y-2">
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
            <div className="shrink-0 space-y-1 border-t border-slate/15 p-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0 relative">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => handleCommentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !showMentions) submitComment();
                    }}
                    placeholder="Add a comment…"
                    maxLength={500}
                    disabled={posting}
                    className="w-full bg-transparent border border-slate/25 rounded-full px-2.5 py-1 text-[11px] focus:outline-none focus:border-slate/50 disabled:opacity-60"
                  />
                  {showMentions && mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-panel border border-slate/20 rounded-lg shadow-soft-sm max-h-32 overflow-y-auto z-10">
                      {mentionSuggestions.map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => insertMention(friend)}
                          className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-ink/5 transition first:rounded-t-lg last:rounded-b-lg"
                        >
                          {friend.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!draft.trim() || posting}
                  aria-label="Post comment"
                  className="shrink-0 w-6 h-6 rounded-full bg-ink text-cream flex items-center justify-center disabled:opacity-30"
                >
                  {/* return/enter glyph — distinct from the card-flip arrow */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 10 4 15 9 20" />
                    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {post.is_mine && flipped && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete post"
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/50 text-cream flex items-center justify-center text-[11px] backdrop-blur-sm"
          >
            🗑
          </button>
        )}

        {!post.is_mine && post.is_tagged && flipped && (
          <button
            type="button"
            onClick={() => setResharing(true)}
            aria-label="Reshare this fit"
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/50 text-cream flex items-center justify-center backdrop-blur-sm"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
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
        <div className="flex items-center justify-between gap-2">
          <Link href={`/profile/${post.author_id}`} className="text-xs text-ink/60 truncate hover:underline">
            {post.author_name}
          </Link>

          <div className="flex items-center gap-1 shrink-0">
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
                  className={`flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] transition-colors ${
                    active
                      ? "bg-ink text-cream"
                      : "bg-cream/70 text-ink border border-slate/15 hover:border-slate/40"
                  }`}
                >
                  <span className="leading-none text-[11px]">{r.emoji}</span>
                  {count > 0 && <span className="text-[9px] tabular-nums">{count}</span>}
                </button>
              );
            })}

            {/* Flip to the back to read/add comments — there's no other entry point. */}
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? "Show photo" : "View comments"}
              className="flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] bg-cream/70 text-ink border border-slate/15 hover:border-slate/40 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
              </svg>
              {commentCount > 0 && <span className="text-[9px] tabular-nums">{commentCount}</span>}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {post.caption ? (
            <p className="flex-1 min-w-0 text-xs text-ink leading-snug">{post.caption}</p>
          ) : (
            <span className="flex-1" />
          )}

          <button
            type="button"
            onClick={() => {
              setFlipped((f) => !f);
              setConfirmingDelete(false);
            }}
            aria-label={flipped ? "Show photo" : "Show outfit details"}
            className="shrink-0 flex items-center justify-center rounded-full p-1 bg-cream/70 text-ink border border-slate/15 hover:border-slate/40 transition-colors"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 transition-transform duration-500 ${flipped ? "rotate-180" : ""}`}
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Reshare modal */}
      <Modal open={resharing} onClose={() => !resharePosting && setResharing(false)} title="Reshare this fit">
        <div className="space-y-4">
          {post.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.photo}
              alt="outfit preview"
              className="w-full rounded-xl object-cover max-h-64"
            />
          )}

          <div>
            <label className="text-xs font-ui font-semibold text-slate tracking-wide">
              Caption
            </label>
            <textarea
              className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm resize-none"
              rows={2}
              placeholder={post.caption || "add a note about resharing this..."}
              value={reshareCaption}
              onChange={(e) => setReshareCaption(e.target.value)}
              disabled={resharePosting}
            />
          </div>

          {reshareError && (
            <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
              {reshareError}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResharing(false)}
              disabled={resharePosting}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReshare}
              disabled={resharePosting}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {resharePosting ? "Resharing..." : "Reshare"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
