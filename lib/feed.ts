// Shared feed vocabulary — kept in one place so the composer, the cards, and the
// API all agree on the allowed visibility tiers and the fixed reaction set.
// No server-only imports here (no `pool`) — this file is imported by client
// components like FeedCard, and pulling in `pg` would break the browser bundle.
// The actual DB query lives in lib/feedQueries.ts (server-only).

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

export type FeedPost = {
  id: string;
  photo: string;
  caption: string | null;
  visibility: FeedVisibility;
  created_at: string;
  author_id: string;
  author_name: string;
  is_mine: boolean;
  reaction_counts: Partial<Record<FeedReactionType, number>>;
  my_reactions: FeedReactionType[];
  items: FeedPostItem[];
};
