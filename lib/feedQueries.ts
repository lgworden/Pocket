// Server-only feed queries — kept separate from lib/feed.ts (types/vocab)
// because that file is imported by client components; pulling `pg` in there
// would break the browser bundle.

import pool from "./db";
import type { FeedPost, FeedPostItem, FeedReactionType, FeedVisibility } from "./feed";

type PostRow = {
  id: string;
  photo: string;
  caption: string | null;
  visibility: FeedVisibility;
  created_at: string;
  author_id: string;
  author_name: string;
  reaction_counts: Record<string, number> | null;
  my_reactions: FeedReactionType[] | null;
  items: FeedPostItem[] | null;
};

// Shows `viewerId`'s own posts (all tiers, including private) plus friends'
// posts, filtered by how the AUTHOR categorized the viewer:
//   - visibility='friends'       → any accepted friend of the author
//   - visibility='close_friends' → only friends the author marked close_friend
//   - visibility='private'       → author only
// Pass `authorId` to scope to a single person's posts (e.g. a profile page) —
// still gated by the same visibility rules, just narrowed to one author.
export async function getFeedPosts(
  viewerId: string,
  opts?: { authorId?: string }
): Promise<FeedPost[]> {
  const { rows } = await pool.query<PostRow>(
    `SELECT
       p.id, p.photo, p.caption, p.visibility, p.created_at,
       COALESCE(u.display_name, u.name) AS author_name,
       p.user_id AS author_id,
       (
         SELECT COALESCE(jsonb_object_agg(t.reaction, t.cnt), '{}'::jsonb)
         FROM (
           SELECT reaction, COUNT(*)::int AS cnt
           FROM feed_reactions WHERE post_id = p.id GROUP BY reaction
         ) t
       ) AS reaction_counts,
       (
         SELECT COALESCE(array_agg(reaction), '{}')
         FROM feed_reactions WHERE post_id = p.id AND user_id = $1
       ) AS my_reactions,
       (
         SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'display_id', i.display_id,
           'name', i.name,
           'brand', i.brand,
           'category', i.category,
           'colors', i.colors,
           'tags', i.tags
         ) ORDER BY i.category), '[]'::jsonb)
         FROM outfit_logs ol
         JOIN items i ON i.id = ANY(ol.item_ids)
         WHERE ol.id = p.outfit_log_id
       ) AS items
     FROM feed_posts p
     JOIN users u ON u.id = p.user_id
     WHERE (
       p.user_id = $1
        OR (
          p.visibility <> 'private'
          AND EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.user_id = p.user_id AND f.friend_id = $1
              AND (p.visibility = 'friends' OR f.tier = 'close_friend')
          )
        )
     )
     AND ($2::uuid IS NULL OR p.user_id = $2)
     ORDER BY p.created_at DESC`,
    [viewerId, opts?.authorId ?? null]
  );

  return rows.map((r) => ({
    id: r.id,
    photo: r.photo,
    caption: r.caption,
    visibility: r.visibility,
    created_at: r.created_at,
    author_id: r.author_id,
    author_name: r.author_name,
    is_mine: r.author_id === viewerId,
    reaction_counts: (r.reaction_counts ?? {}) as FeedPost["reaction_counts"],
    my_reactions: r.my_reactions ?? [],
    items: r.items ?? [],
  }));
}
