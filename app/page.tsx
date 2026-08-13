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
    // On desktop the feed gets its own column, wider than the app-wide
    // `max-w-md` phone body (see app/layout.tsx) but nowhere near edge to edge:
    // three polaroids across, at roughly the size they are on a phone. The
    // negative margin is what escapes the body clamp — deliberately not a
    // transform, which would become the containing block for the `fixed`
    // overlays FeedCard renders (Modal, PhotoLightbox).
    // 640px at md, 760px at lg — a single wide step would have left the column
    // all but touching the window edges on a 768px tablet.
    <main className="px-4 pt-6 pb-32 md:mx-[calc(50%-320px)] lg:mx-[calc(50%-380px)]">
      {/* The wider column leaves real estate either side of the collage. A
          fine dot lattice keeps that from reading as dead space — pinned to
          the viewport so it doesn't scroll with the posts, and only on the
          breakpoints that actually have room for it. */}
      <div aria-hidden className="feed-backdrop hidden md:block fixed inset-0 -z-10" />

      <FeedCollage
        posts={posts}
        friends={friends}
        initialComposerOpen={searchParams.compose === "1"}
      />
      <BottomNav />
    </main>
  );
}
