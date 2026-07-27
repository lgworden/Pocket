import { requireOnboarded } from "@/lib/auth";
import { getFriends } from "@/lib/friends";
import { getFeedPosts } from "@/lib/feedQueries";
import BottomNav from "@/components/BottomNav";
import FeedCollage from "@/components/feed/FeedCollage";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireOnboarded();
  const [posts, friends] = await Promise.all([
    getFeedPosts(user.id),
    getFriends(user.id),
  ]);

  return (
    <main className="px-4 pt-6 pb-24">
      <FeedCollage
        posts={posts}
        friends={friends}
        initialComposerOpen={searchParams.compose === "1"}
      />
      <BottomNav />
    </main>
  );
}
