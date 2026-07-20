import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { canViewProfile, getProfileUser, getProfileStats } from "@/lib/profile";
import { getFeedPosts } from "@/lib/feedQueries";
import BottomNav from "@/components/BottomNav";
import FeedCard from "@/components/feed/FeedCard";
import AvatarUpload from "@/components/AvatarUpload";

export const dynamic = "force-dynamic";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-display">{value}</p>
      <p className="text-[11px] font-ui text-slate uppercase tracking-wide">{label}</p>
    </div>
  );
}

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
  const allowed = isSelf || (await canViewProfile(viewer.id, profileUser.id));

  if (!allowed) {
    return (
      <main className="px-4 pt-6 pb-24">
        <p className="text-sm text-ink/60">
          You need to be friends with {profileUser.display_name || profileUser.name} to see their
          profile.
        </p>
        <BottomNav />
      </main>
    );
  }

  const [stats, posts] = await Promise.all([
    getProfileStats(profileUser.id),
    getFeedPosts(viewer.id, { authorId: profileUser.id }),
  ]);

  const name = profileUser.display_name || profileUser.name;

  return (
    <main className="px-4 pt-6 pb-24 space-y-6">
      <header className="flex items-center gap-4">
        <AvatarUpload avatar={profileUser.avatar} name={name} editable={isSelf} />
        <div className="min-w-0">
          <h1 className="text-xl truncate">{name}</h1>
          {profileUser.bio && <p className="text-sm text-ink/60 mt-0.5">{profileUser.bio}</p>}
        </div>
      </header>

      <div className="flex items-center divide-x divide-slate/15">
        <div className="flex-1">
          <Stat value={stats.friend_count} label="friends" />
        </div>
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
        <p className="text-xs font-ui font-semibold text-slate uppercase tracking-wide mb-2">
          Shared looks
        </p>
        {posts.length === 0 ? (
          <p className="text-sm text-ink/50">Nothing shared yet.</p>
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
