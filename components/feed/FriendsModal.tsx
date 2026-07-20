"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/Modal";
import type { Friend, FriendTier } from "@/lib/friends";

// Manage friends. Close-friend is a per-viewer toggle, shown as a heart:
// turning it on lets that friend see your "close friends" posts.
export default function FriendsModal({
  open,
  onClose,
  friends,
}: {
  open: boolean;
  onClose: () => void;
  friends: Friend[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function toggleTier(friend: Friend) {
    const next: FriendTier = friend.tier === "close_friend" ? "friend" : "close_friend";
    setBusyId(friend.id);
    try {
      await fetch(`/api/friends/${friend.id}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: next }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeFriend(friendId: string) {
    setBusyId(friendId);
    try {
      await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Friends">
      {friends.length === 0 ? (
        <p className="text-sm text-ink/50 py-2">No friends yet.</p>
      ) : (
        <ul className="space-y-2">
          {friends.map((f) =>
            confirmId === f.id ? (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3"
              >
                <span className="text-sm text-ink/70">Remove {f.name}?</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setConfirmId(null)}
                    disabled={busyId === f.id}
                    className="text-xs font-ui font-semibold rounded-full px-3 py-1.5 bg-ink/10 text-ink/70 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => removeFriend(f.id)}
                    disabled={busyId === f.id}
                    className="text-xs font-ui font-semibold rounded-full px-3 py-1.5 bg-rose text-cream disabled:opacity-50"
                  >
                    {busyId === f.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3"
              >
                <Link href={`/profile/${f.id}`} onClick={onClose} className="text-sm font-medium hover:underline">
                  {f.name}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleTier(f)}
                    disabled={busyId === f.id}
                    aria-label={
                      f.tier === "close_friend"
                        ? `Remove ${f.name} as a close friend`
                        : `Mark ${f.name} as a close friend`
                    }
                    aria-pressed={f.tier === "close_friend"}
                    className="text-lg leading-none w-9 h-9 rounded-full flex items-center justify-center hover:bg-ink/10 transition disabled:opacity-50"
                  >
                    {f.tier === "close_friend" ? "❤️" : "🤍"}
                  </button>
                  <button
                    onClick={() => setConfirmId(f.id)}
                    disabled={busyId === f.id}
                    className="text-xs font-ui font-semibold rounded-full px-3 py-1.5 bg-ink/10 text-ink/40 disabled:opacity-50"
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </Modal>
  );
}
