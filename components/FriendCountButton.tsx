"use client";

import { useState } from "react";
import Link from "next/link";
import Modal from "./Modal";
import type { Friend } from "@/lib/friends";

// The friends stat on a profile, tappable to reveal who those friends are.
// Read-only on purpose — managing friends (close-friend hearts, removal, the
// search box) stays in FriendsModal off the feed, so this stays usable on
// someone else's profile where none of those actions apply.
//
// Friendship is mutual — an accepted request, or an invite-link signup, writes
// both directed rows (lib/friends.ts) — so the list here is exactly the set the
// count above it describes, whoever is looking.
export default function FriendCountButton({
  count,
  friends,
  ownerName,
  isSelf,
}: {
  count: number;
  friends: Friend[];
  ownerName: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center rounded-lg py-1 hover:bg-ink/5 transition-colors"
        aria-haspopup="dialog"
      >
        <p className="text-lg font-display">{count}</p>
        <p className="text-[11px] font-ui text-slate tracking-wide">friends</p>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isSelf ? "Your friends" : `${ownerName}'s friends`}
      >
        {friends.length === 0 ? (
          <p className="text-sm text-ink/50 py-2">
            {isSelf ? "No friends yet." : `${ownerName} has no friends yet.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="rounded-2xl bg-cream px-4 py-3">
                <Link
                  href={`/profile/${f.id}`}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium hover:underline"
                >
                  {f.name}
                </Link>
                {f.username && (
                  <span className="text-xs text-slate ml-2">@{f.username}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
