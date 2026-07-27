"use client";

import { useEffect, useState } from "react";

type SearchUser = {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  is_friend: boolean;
};

// Search-by-username-or-name + instant add, shared between FriendsModal and
// onboarding. Anyone can search for and friend anyone — this is the app's
// only reach/discovery mechanism (see SOCIAL_PIVOT_PLAN.md), so it's worth
// having in more than one place rather than reinventing it per screen.
export default function FriendSearch({ onAdded }: { onAdded?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        setResults(data.users || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function addFriend(user: SearchUser) {
    setAddingId(user.id);
    try {
      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: user.id }),
      });
      if (!res.ok) throw new Error("failed to add");
      setAddedIds((prev) => new Set(prev).add(user.id));
      onAdded?.();
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by @username or name..."
        className="w-full bg-transparent border border-slate/20 rounded-full px-4 py-2 text-sm"
      />
      {query.trim().length >= 2 &&
        (searching ? (
          <p className="text-sm text-ink/50 py-1">Searching...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-ink/50 py-1">No users found.</p>
        ) : (
          <ul className="space-y-2">
            {results.map((u) => {
              const added = u.is_friend || addedIds.has(u.id);
              return (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.display_name}</p>
                    <p className="text-xs text-slate">@{u.username}</p>
                  </div>
                  <button
                    onClick={() => addFriend(u)}
                    disabled={added || addingId === u.id}
                    className="shrink-0 text-xs font-ui font-semibold rounded-full px-3 py-1.5 btn-primary disabled:opacity-50"
                  >
                    {added ? "added" : addingId === u.id ? "..." : "add"}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
