import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { getProfileAccess, getProfileUser, getProfileStats } from "@/lib/profile";
import { isFollowing, INFLUENCER_THRESHOLD } from "@/lib/follows";
import { getFeedPosts } from "@/lib/feedQueries";
import BottomNav from "@/components/BottomNav";
import FeedCard from "@/components/feed/FeedCard";
import AvatarUpload from "@/components/AvatarUpload";
import FollowButton from "@/components/FollowButton";

export const dynamic = "force-dynamic";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-display">{value}</p>
      <p className="text-[11px] font-ui text-slate tracking-wide">{label}</p>
    </div>
  );
}

// Copy for the "Shared looks" empty state — access-dependent because an empty
// grid means something different to a friend (they've posted nothing) than to
// a follower/stranger (there's no broadcast tier, so nothing is visible to
// either regardless of how much the author has actually posted). The query in
// getFeedPosts is the actual gate; this only picks the right explanation.
const EMPTY_COPY: Record<string, string> = {
  self: "Nothing shared yet.",
  friend: "Nothing shared yet.",
  follower: "Be friends to see their looks.",
  stranger: "Be friends to see their looks.",
};

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const viewer = await requireOnboarded();
  const profileUser = await getProfileUser(params.id);

  if (!profileUser) {
    return (
      <main className="px-4 pt-6 pb-24">
        <p className="text-sm text-ink/60">This profile doesn't exist.</p>
        <BottomNav />
      </main>
    );
  }

  const isSelf = viewer.id === profileUser.id;
  const [access, stats, posts, viewerFollows] = await Promise.all([
    isSelf ? Promise.resolve("self" as const) : getProfileAccess(viewer.id, profileUser.id),
    getProfileStats(profileUser.id),
    // Visibility is enforced by the query itself (friends/close_friends → the
    // friendships gate, private → author only) — a stranger or follower simply
    // gets back zero rows, no separate check needed here.
    getFeedPosts(viewer.id, { authorId: profileUser.id }),
    isSelf ? Promise.resolve(false) : isFollowing(viewer.id, profileUser.id),
  ]);

  const name = profileUser.display_name || profileUser.name;
  const isInfluencer = !!profileUser.influencer_since;

  return (
    <main className="px-4 pt-6 pb-24 space-y-6">
      <div
        className={`rounded-2xl border p-4 shadow-soft-sm ${
          isInfluencer ? "bg-azure/10 border-azure/40" : "bg-panel border-slate/10"
        }`}
      >
        <div className="flex items-center gap-4">
          <AvatarUpload avatar={profileUser.avatar} name={name} editable={isSelf} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl truncate">{name}</h1>
              {isInfluencer && (
                <span
                  className="text-[10px] font-ui font-semibold uppercase tracking-wide text-azure bg-azure/15 rounded-full px-2 py-0.5 shrink-0"
                  title="Reached the follower threshold"
                >
                  influencer
                </span>
              )}
            </div>
            {profileUser.bio && <p className="text-sm text-ink/60 mt-0.5">{profileUser.bio}</p>}
          </div>
          {!isSelf && (
            <FollowButton profileUserId={profileUser.id} initialFollowing={viewerFollows} />
          )}
        </div>

        <div className="flex items-center divide-x divide-slate/15 mt-4">
          <div className="flex-1">
            <Stat value={stats.follower_count} label="followers" />
          </div>
          <div className="flex-1">
            <Stat value={stats.following_count} label="following" />
          </div>
          <div className="flex-1">
            <Stat value={stats.friend_count} label="friends" />
          </div>
        </div>
      </div>

      <div className="flex items-center divide-x divide-slate/15">
        <div className="flex-1">
          <Stat value={stats.streak_days} label="day streak" />
        </div>
        <div className="flex-1">
          <Stat value={stats.outfit_count} label="outfits logged" />
        </div>
      </div>

      {isSelf && (
        <Link href="/preferences" className="text-sm font-ui font-semibold text-slate underline">
          Edit your info
        </Link>
      )}

      <div>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide mb-2">
          Shared looks
        </p>
        {posts.length === 0 ? (
          <p className="text-sm text-ink/50">{EMPTY_COPY[access]}</p>
        ) : (
          <div className="columns-2 gap-2 [column-fill:_balance]">
            {posts.map((post) => (
              <div key={post.id} className="break-inside-avoid mb-2">
                <FeedCard post={post} />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
