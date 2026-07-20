"use client";

import { useState } from "react";

interface ItemWearStatsProps {
  itemId: string;
  wearCount: number;
  lastWorn: string | null;
  cost: string | null;
}

export default function ItemWearStats({
  itemId,
  wearCount,
  lastWorn,
  cost,
}: ItemWearStatsProps) {
  const [count, setCount] = useState(wearCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPerWear =
    cost && count > 0 ? (Number(cost) / count).toFixed(2) : null;

  const handleMarkAsWorn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/wear`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as worn");
      setCount(count + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card grid grid-cols-3 gap-3 text-center">
      <div>
        <p className="text-2xl font-display">{count}</p>
        <p className="text-xs text-ink/60">times worn</p>
      </div>
      <div>
        <p className="text-2xl font-display">
          {lastWorn ? new Date(lastWorn).toLocaleDateString() : "—"}
        </p>
        <p className="text-xs text-ink/60">last worn</p>
      </div>
      <div>
        <p className="text-2xl font-display">{costPerWear ? `$${costPerWear}` : "—"}</p>
        <p className="text-xs text-ink/60">cost / wear</p>
      </div>

      <div className="col-span-3 mt-3 pt-3 border-t border-slate/15">
        <button
          type="button"
          onClick={handleMarkAsWorn}
          disabled={loading}
          className="w-full btn-primary text-sm py-2 disabled:opacity-50"
        >
          {loading ? "Marking..." : "I wore this today"}
        </button>
        {error && (
          <p className="text-xs text-rose mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
