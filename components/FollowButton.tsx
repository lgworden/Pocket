"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Standalone follow/unfollow toggle for a profile — separate from the
// existing "add friend" flow in FriendsModal, which stays a stronger, mutual
// action. Following is the lightweight, one-way action: anyone can follow
// anyone (see SOCIAL_PIVOT_PLAN.md), no approval needed.
export default function FollowButton({
  profileUserId,
  initialFollowing,
}: {
  profileUserId: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic

    try {
      const res = await fetch(`/api/follows/${profileUserId}`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) throw new Error("follow toggle failed");
      router.refresh();
    } catch {
      setFollowing(!next); // roll back
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={`text-sm font-ui font-semibold rounded-full px-4 py-2 transition-colors disabled:opacity-60 ${
        following
          ? "bg-transparent text-ink border border-slate/30"
          : "btn-primary"
      }`}
    >
      {following ? "following" : "follow"}
    </button>
  );
}
