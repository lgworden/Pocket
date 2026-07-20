import { requireOnboarded } from "@/lib/auth";
import { getFriends } from "@/lib/friends";
import { getFeedPosts } from "@/lib/feedQueries";
import BottomNav from "@/components/BottomNav";
import FeedCollage from "@/components/feed/FeedCollage";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireOnboarded();
  const [posts, friends] = await Promise.all([
    getFeedPosts(user.id),
    getFriends(user.id),
  ]);

  return (
    <main className="px-4 pt-6 pb-24">
      <FeedCollage posts={posts} friends={friends} />
      <BottomNav />
    </main>
  );
}
