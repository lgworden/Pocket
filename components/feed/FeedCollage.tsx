"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FeedCard from "./FeedCard";
import FeedComposer from "./FeedComposer";
import FriendsModal from "./FriendsModal";
import { VISIBILITY_OPTIONS, VISIBILITY_STYLES, type FeedPost, type FeedVisibility } from "@/lib/feed";
import type { Friend } from "@/lib/friends";

// Brief per-tier descriptions for the stacked color legend.
const VISIBILITY_LEGEND_LABELS: Record<FeedVisibility, string> = {
  friends: "for friends",
  close_friends: "for besties",
  private: "for you",
};

// Same glyph as the closet tab's "log a fit" action, so sharing a fit reads
// as the same gesture everywhere in the app.
function CameraIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path
        d="M7 5.5 8 3.5h4l1 2h2.5A1.5 1.5 0 0 1 17 5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14V5a1.5 1.5 0 0 1 1.5-1.5H7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// Client shell for the feed: hosts the composer modal and renders posts in a
// Pinterest-style masonry (CSS columns — cards keep their natural photo height
// and stagger, no JS layout pass needed).
export default function FeedCollage({
  posts,
  friends,
  initialComposerOpen = false,
}: {
  posts: FeedPost[];
  friends: Friend[];
  initialComposerOpen?: boolean;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(initialComposerOpen);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [livePosts, setLivePosts] = useState(posts);
  const [activeFilter, setActiveFilter] = useState<FeedVisibility | null>(null);

  useEffect(() => {
    setLivePosts(posts);
  }, [posts]);

  const visiblePosts = activeFilter
    ? livePosts.filter((p) => p.visibility === activeFilter)
    : livePosts;

  // The nav's persistent compose button links here with ?compose=1 so it can
  // open the modal from any screen. Strip the query once we've consumed it so
  // a later refresh doesn't silently reopen the composer.
  useEffect(() => {
    if (initialComposerOpen) {
      router.replace("/", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">
          Feed
        </p>
        <div className="flex items-center gap-2">
          <button
            aria-label="Friends"
            className="icon-btn bg-panel border border-slate/20 text-ink hover:bg-ink/5 transition"
            onClick={() => setFriendsOpen(true)}
          >
            {/* people glyph */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button
            aria-label="share fit"
            className="icon-btn bg-panel border border-slate/20 text-ink hover:bg-ink/5 transition"
            onClick={() => setComposerOpen(true)}
          >
            <CameraIcon />
          </button>
        </div>
      </div>

      {/* Color legend doubles as a filter: tap a tier to show only those
          posts, tap the active one again to clear it. */}
      <div className="flex items-center gap-3">
        {VISIBILITY_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.value;
          const isDimmed = activeFilter !== null && !isActive;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveFilter((cur) => (cur === opt.value ? null : opt.value))}
              className={`flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded-md text-left transition ${
                isActive ? "bg-ink/8" : "hover:bg-ink/5"
              } ${isDimmed ? "opacity-40" : ""}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full border shrink-0 ${VISIBILITY_STYLES[opt.value].card}`}
              />
              <span
                className={`text-[11px] ${isActive ? "text-ink font-semibold" : "text-ink/50"}`}
              >
                {VISIBILITY_LEGEND_LABELS[opt.value]}
              </span>
            </button>
          );
        })}
      </div>

      {visiblePosts.length === 0 ? (
        <div className="card text-center text-sm text-ink/60 py-10">
          {activeFilter ? (
            <>No posts {VISIBILITY_LEGEND_LABELS[activeFilter]} yet.</>
          ) : (
            <>
              No looks yet — tap <span className="font-medium">+ Share</span> to post your first outfit.
            </>
          )}
        </div>
      ) : (
        <div className="columns-2 gap-2">
          {visiblePosts.map((post) => (
            <div key={post.id} className="break-inside-avoid mb-2">
              <FeedCard
                post={post}
                friends={friends}
                onDeleted={(id) => setLivePosts((ps) => ps.filter((p) => p.id !== id))}
              />
            </div>
          ))}
        </div>
      )}

      <FeedComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        friends={friends}
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
