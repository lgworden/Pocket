"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FeedCard from "./FeedCard";
import FeedComposer from "./FeedComposer";
import FriendsModal from "./FriendsModal";
import {
  DEFAULT_PHOTO_RATIO,
  VISIBILITY_OPTIONS,
  VISIBILITY_STYLES,
  type FeedPost,
  type FeedVisibility,
} from "@/lib/feed";
import type { Friend } from "@/lib/friends";

// Gap between polaroids, in px. Deliberately tight — the collage should read
// as a packed mosaic, not a list of spaced-out cards.
const GAP = 6;

// Everything on a card that isn't the photo: the name strip above it and the
// reaction/caption row below. Only used for the very first pack, before the
// cards have been measured for real — a caption that wraps to two lines makes
// this a guess, which is why measured heights take over as soon as they exist.
function estimateChromeHeight(post: FeedPost) {
  return post.caption ? 100 : 78;
}

// 2 across on a phone (the layout the feed is designed around), 3 on desktop
// and no more: the column the feed renders into is a fixed width (see
// app/page.tsx), so a wider window buys more backdrop, not more polaroids —
// which keeps a tile about the same size everywhere.
function columnsForWidth(width: number) {
  return width < 560 ? 2 : 3;
}

// Greedy shortest-column packing: walk the posts in date order (already
// newest-first) and drop each one into whichever column is currently shortest.
// This is what keeps the bottom edge close to level instead of leaving a long
// tail of white space under the short column — which a fixed left/right split
// can't do once every tile has its own height.
function packColumns(
  posts: FeedPost[],
  columnCount: number,
  columnWidth: number,
  ratios: Record<string, number>,
  measured: Record<string, number>,
): FeedPost[][] {
  const columns: FeedPost[][] = Array.from({ length: columnCount }, () => []);
  const heights = new Array<number>(columnCount).fill(0);

  for (const post of posts) {
    let target = 0;
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[target]) target = i;
    }
    columns[target].push(post);
    // A card's height doesn't depend on which column it lands in (every column
    // is the same width), so feeding the measured height back into the pack
    // settles instead of oscillating.
    const ratio = ratios[post.id] ?? DEFAULT_PHOTO_RATIO;
    const height =
      measured[post.id] ?? columnWidth / ratio + estimateChromeHeight(post);
    heights[target] += height + GAP;
  }

  return columns;
}

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

// Client shell for the feed: hosts the composer modal and renders posts as a
// masonry of polaroids — every tile keeps its photo's own aspect ratio, and
// columns are packed shortest-first so heights stay balanced (see the render
// below for why this isn't CSS `columns-N`).
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

  // Photo shapes aren't stored anywhere, so cards report them as their images
  // load and the columns repack. Until then everything falls back to the old
  // fixed 4:5, which is what the server renders too — so the first paint is
  // stable and only genuinely off-ratio photos shift.
  const [gridWidth, setGridWidth] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  // A callback ref, not an effect on a plain ref: the grid isn't in the tree at
  // all while the feed is empty, so an on-mount effect would never see it and
  // the first post would land in a stale column count.
  const gridObserver = useRef<ResizeObserver | null>(null);
  const measureGrid = useCallback((el: HTMLDivElement | null) => {
    gridObserver.current?.disconnect();
    gridObserver.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setGridWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setGridWidth(el.clientWidth));
    observer.observe(el);
    gridObserver.current = observer;
  }, []);

  const columnCount = columnsForWidth(gridWidth || 0);
  const columnWidth = gridWidth
    ? (gridWidth - GAP * (columnCount - 1)) / columnCount
    : 0;

  // Rendered card heights, keyed by post id. The photo ratio alone doesn't
  // predict a tile's height — a caption may wrap, a flipped card may not match
  // — so each card is measured and the pack re-runs against the real numbers,
  // which is what actually levels the bottom edge.
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const observedCards = useRef(new Map<string, Element>());
  const cardObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setCardHeights((prev) => {
        let next = prev;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.postId;
          if (!id) continue;
          const height = entry.target.getBoundingClientRect().height;
          // Ignore sub-pixel noise, or every scroll-driven reflow repacks.
          if (Math.abs((prev[id] ?? 0) - height) < 1) continue;
          if (next === prev) next = { ...prev };
          next[id] = height;
        }
        return next;
      });
    });
    cardObserver.current = observer;
    for (const el of observedCards.current.values()) observer.observe(el);
    return () => {
      observer.disconnect();
      cardObserver.current = null;
    };
  }, []);

  // Cards move between columns as the pack settles, which remounts them — so
  // the element is re-registered under the same post id each time.
  function registerCard(postId: string, el: HTMLDivElement | null) {
    const previous = observedCards.current.get(postId);
    if (previous && previous !== el) cardObserver.current?.unobserve(previous);
    if (el) {
      observedCards.current.set(postId, el);
      cardObserver.current?.observe(el);
    } else {
      observedCards.current.delete(postId);
    }
  }

  const columns = useMemo(
    () => packColumns(visiblePosts, columnCount, columnWidth, ratios, cardHeights),
    [visiblePosts, columnCount, columnWidth, ratios, cardHeights],
  );

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
      {/* The desktop column is nearly twice the phone's width, so the header
          scales with it — at phone sizing it read as a caption stranded above
          a much bigger grid. */}
      <div className="flex items-center justify-between md:pb-1">
        <p className="text-xs md:text-base font-ui font-semibold text-slate tracking-wide">
          Feed
        </p>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            aria-label="Friends"
            className="icon-btn md:w-12 md:h-12 bg-panel border border-slate/20 text-ink hover:bg-ink/5 transition"
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
            className="icon-btn md:w-12 md:h-12 bg-panel border border-slate/20 text-ink hover:bg-ink/5 transition"
            onClick={() => setComposerOpen(true)}
          >
            <CameraIcon />
          </button>
        </div>
      </div>

      {/* Color legend doubles as a filter: tap a tier to show only those
          posts, tap the active one again to clear it. */}
      <div className="flex items-center gap-3 md:gap-4">
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
                className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border shrink-0 ${VISIBILITY_STYLES[opt.value].card}`}
              />
              <span
                className={`text-[11px] md:text-[13px] ${isActive ? "text-ink font-semibold" : "text-ink/50"}`}
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
        // Explicit JS-packed columns rather than CSS `columns-N`: a CSS
        // multi-column layout fills the first column completely before
        // touching the next (and re-balances unpredictably as posts are
        // added), so newer posts piled up on the left instead of spreading by
        // date. Packing by hand puts post 0 top-left and post 1 in the next
        // column — flush at the top by construction — then keeps feeding each
        // post to the shortest column so the bottom edge stays level too.
        <div
          ref={measureGrid}
          className="flex items-start"
          style={{ gap: GAP }}
        >
          {columns.map((column, col) => (
            <div
              key={col}
              className="flex-1 min-w-0 flex flex-col"
              style={{ gap: GAP }}
            >
              {column.map((post) => (
                <div
                  key={post.id}
                  data-post-id={post.id}
                  ref={(el) => registerCard(post.id, el)}
                >
                  <FeedCard
                    post={post}
                    friends={friends}
                    onDeleted={(id) => setLivePosts((ps) => ps.filter((p) => p.id !== id))}
                    onPhotoRatio={(id, ratio) =>
                      setRatios((r) => (r[id] === ratio ? r : { ...r, [id]: ratio }))
                    }
                    photoRatioHint={ratios[post.id]}
                  />
                </div>
              ))}
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
