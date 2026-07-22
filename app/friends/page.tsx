import { requireOnboarded } from "@/lib/auth";
import FriendSearchClient from "@/components/FriendSearchClient";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  await requireOnboarded();

  return (
    <main className="px-4 pt-6 space-y-4 pb-24">
      <header>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">
          Friends
        </p>
        <h1 className="text-2xl mt-1">Find friends</h1>
      </header>

      <FriendSearchClient />

      <BottomNav />
    </main>
  );
}
