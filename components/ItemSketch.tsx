"use client";

import { useState } from "react";

// Fashion-sketchbook croquis of an item, drawn from its photo on demand. Shows
// the sketch once it exists; otherwise offers to generate one (only when the
// item has a photo to draw from). Deliberately optional — never nags.
export default function ItemSketch({
  itemId,
  initialSketch,
  hasPhoto,
}: {
  itemId: string;
  initialSketch: string | null;
  hasPhoto: boolean;
}) {
  const [sketch, setSketch] = useState<string | null>(initialSketch);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!hasPhoto && !sketch) return null;

  async function generate() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/sketch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate a sketch — try again?");
      setSketch(data.sketch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-2">
      {sketch && (
        <div className="polaroid">
          <div className="aspect-square bg-blue/10 rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sketch} alt="sketch of item" className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {hasPhoto && (
        <button className="btn-secondary w-full" onClick={generate} disabled={status === "loading"}>
          {status === "loading"
            ? "sketching..."
            : sketch
              ? "redraw sketch"
              : "✎ sketch this item"}
        </button>
      )}

      {error && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>
      )}
    </div>
  );
}
