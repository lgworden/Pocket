"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FeedCard from "./FeedCard";
import FeedComposer from "./FeedComposer";
import FriendsModal from "./FriendsModal";
import { VISIBILITY_OPTIONS, VISIBILITY_STYLES, type FeedPost } from "@/lib/feed";
import type { Friend } from "@/lib/friends";

// Client shell for the feed: hosts the composer modal and renders posts in a
// Pinterest-style masonry (CSS columns — cards keep their natural photo height
// and stagger, no JS layout pass needed).
export default function FeedCollage({
  posts,
  friends,
}: {
  posts: FeedPost[];
  friends: Friend[];
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-ui font-semibold text-slate uppercase tracking-wide">
          Feed
        </p>
        <div className="flex items-center gap-2">
          <button
            aria-label="Friends"
            className="w-9 h-9 rounded-full bg-ink/10 text-ink flex items-center justify-center hover:bg-ink/15 transition"
            onClick={() => setFriendsOpen(true)}
          >
            {/* people glyph */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button className="btn-primary" onClick={() => setComposerOpen(true)}>
            +
          </button>
        </div>
      </div>

      {/* Color legend dots only — no labels. */}
      <div className="flex gap-2">
        {VISIBILITY_OPTIONS.map((opt) => (
          <span
            key={opt.value}
            className={`w-2.5 h-2.5 rounded-full border ${VISIBILITY_STYLES[opt.value].card}`}
          />
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="card text-center text-sm text-ink/60 py-10">
          No looks yet — tap <span className="font-medium">+ Share</span> to post your first outfit.
        </div>
      ) : (
        <div className="columns-2 gap-2 [column-fill:_balance]">
          {posts.map((post) => (
            <div key={post.id} className="break-inside-avoid mb-2">
              <FeedCard post={post} />
            </div>
          ))}
        </div>
      )}

      <FeedComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={() => {
          setComposerOpen(false);
          router.refresh();
        }}
      />

      <FriendsModal
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        friends={friends}
      />
    </div>
  );
}
