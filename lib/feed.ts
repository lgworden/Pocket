// Shared feed vocabulary — kept in one place so the composer, the cards, and the
// API all agree on the allowed visibility tiers and the fixed reaction set.
// No server-only imports here (no `pool`) — this file is imported by client
// components like FeedCard, and pulling in `pg` would break the browser bundle.
// The actual DB query lives in lib/feedQueries.ts (server-only).

// Three tiers only — reach/discovery is handled by search-and-friend (anyone
// can find and friend anyone, see lib/friends.ts), not by a broadcast tier.
// A "public" value briefly existed in the DB enum during social-pivot Phase 1
// planning; it's unused and nothing ever writes it — see feed_visibility in
// db/020_add_social.sql.
export type FeedVisibility = "friends" | "close_friends" | "private";
export type FeedReactionType = "cheers" | "fire" | "eyes";

export const VISIBILITY_OPTIONS: {
  value: FeedVisibility;
  label: string;
  sub: string;
}[] = [
  { value: "friends", label: "Friends", sub: "everyone you follow each other with" },
  { value: "close_friends", label: "Close friends", sub: "your inner circle only" },
  { value: "private", label: "Private", sub: "just for you — safe for later" },
];

// Reactions are deliberately limited to three warm, low-stakes emoji.
export const REACTIONS: {
  value: FeedReactionType;
  emoji: string;
  label: string;
}[] = [
  { value: "cheers", emoji: "🥂", label: "Cheers" },
  { value: "fire", emoji: "🔥", label: "Fire" },
  { value: "eyes", emoji: "🥺", label: "Aww" },
];

export const REACTION_VALUES: FeedReactionType[] = REACTIONS.map((r) => r.value);
export const VISIBILITY_VALUES: FeedVisibility[] = VISIBILITY_OPTIONS.map((v) => v.value);

// Background/border treatment per tier, doubling as the feed's color legend:
// friends → soft oat, close friends → caramel accent (reserved for the inner
// circle), private → neutral ivory with a dashed edge that reads as "vault".
export const VISIBILITY_STYLES: Record<
  FeedVisibility,
  { card: string; chip: string; chipLabel: string }
> = {
  friends: {
    card: "bg-pink border-transparent",
    chip: "bg-ink/10 text-ink",
    chipLabel: "friends",
  },
  close_friends: {
    card: "bg-blue/20 border-blue/40",
    chip: "bg-brown text-cream",
    chipLabel: "close friends",
  },
  private: {
    card: "bg-cream border-dashed border-slate/40",
    chip: "bg-slate/15 text-slate",
    chipLabel: "🔒 private",
  },
};

// Compact item info shown on a flipped card's back face. Only populated for
// posts created via "share a logged fit" (feed_posts.outfit_log_id set) —
// posts shared straight from the composer have no linked items.
export type FeedPostItem = {
  id: string;
  display_id: string;
  name: string;
  brand: string | null;
  category: string;
  colors: string[];
  tags: string[];
};

// A friend tagged as appearing in a post's photo.
export type FeedTaggedFriend = {
  id: string;
  name: string;
};

// A comment on a post — shown on the flipped card's back face, oldest first.
export type FeedComment = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type FeedPost = {
  id: string;
  photo: string;
  caption: string | null;
  visibility: FeedVisibility;
  created_at: string;
  author_id: string;
  author_name: string;
  is_mine: boolean;
  location: string | null;
  is_tagged: boolean;
  tagged_friends: FeedTaggedFriend[];
  reaction_counts: Partial<Record<FeedReactionType, number>>;
  my_reactions: FeedReactionType[];
  items: FeedPostItem[];
  comment_count: number;
  comments: FeedComment[];
};

// Photo tiles keep their own shape in the collage rather than a uniform crop,
// so the masonry reads as a pile of real polaroids. Ratios are width/height.
// The default is the old fixed 4:5 — used for the first paint and for any
// photo whose dimensions we haven't measured yet.
export const DEFAULT_PHOTO_RATIO = 4 / 5;

// Clamp to a polaroid-ish band: a panorama or an extreme 9:16 phone shot would
// otherwise leave one tile absurdly short or tall next to its neighbours.
// Anything outside the band is cropped by object-cover, not letterboxed.
const MIN_PHOTO_RATIO = 0.62; // taller than ~5:8
const MAX_PHOTO_RATIO = 1.35; // wider than ~4:3

export function clampPhotoRatio(width: number, height: number): number {
  if (!width || !height) return DEFAULT_PHOTO_RATIO;
  return Math.min(MAX_PHOTO_RATIO, Math.max(MIN_PHOTO_RATIO, width / height));
}
