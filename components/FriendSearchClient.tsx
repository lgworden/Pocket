"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type User = {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  is_friend: boolean;
};

export default function FriendSearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);

  useEffect(() => {
    async function search() {
      if (!query || query.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }

    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function addFriend(friendId: string) {
    setAddingFriend(friendId);
    try {
      const res = await fetch("/api/friends/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      if (!res.ok) throw new Error("Failed to add friend");
      setResults((prev) =>
        prev.map((u) => (u.id === friendId ? { ...u, is_friend: true } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add friend");
    } finally {
      setAddingFriend(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <input
          type="text"
          placeholder="Search by @username or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent border border-slate/20 rounded-lg p-3 text-sm"
        />
      </div>

      {error && <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>}

      {loading && (
        <div className="card text-center text-sm text-ink/60">Searching...</div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="card text-center text-sm text-ink/60">No users found</div>
      )}

      {!loading && !query && (
        <div className="card text-center text-sm text-ink/60">
          Search by username to find and add friends
        </div>
      )}

      <div className="space-y-2">
        {results.map((user) => (
          <div key={user.id} className="card flex items-center gap-3">
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={user.display_name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full shrink-0 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate/20 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{user.display_name}</p>
              <p className="text-xs text-slate">@{user.username}</p>
            </div>
            <button
              onClick={() => addFriend(user.id)}
              disabled={user.is_friend || addingFriend === user.id}
              className={`shrink-0 text-sm font-ui font-semibold px-3 py-1 rounded-full transition-colors ${
                user.is_friend
                  ? "bg-slate/10 text-slate"
                  : "btn-primary"
              }`}
            >
              {user.is_friend ? "friends" : addingFriend === user.id ? "..." : "add"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
