"use client";

import { useEffect, useState } from "react";
import { celebrate } from "@/lib/confetti";

type OutfitItem = { display_id: string; name: string };
type Outfit = { title: string; reasoning: string; items: OutfitItem[] };
type InitialRecommendation = { id: string; outfits: Outfit[]; gapQuestion: string | null };

// Per-outfit mockup state: a composed illustration is fetched automatically once
// an outfit renders. Keyed by the outfit's set of pieces so the cache is shared
// across cards and across "get outfits" / "shuffle favs" runs.
type MockupState = { status: "loading" | "ready" | "none"; url?: string };
function outfitKey(items: OutfitItem[]): string {
  return Array.from(new Set(items.map((i) => i.display_id))).sort().join(",");
}

export default function TodayInteractive({
  calendarConnected,
  initialRecommendation,
}: {
  calendarConnected: boolean;
  initialRecommendation?: InitialRecommendation | null;
}) {
  const [dayText, setDayText] = useState("");
  const [mood, setMood] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "results">(
    initialRecommendation ? "results" : "idle"
  );
  const [mode, setMode] = useState<"claude" | "favs">("claude");
  const [error, setError] = useState<string | null>(null);
  const [recommendationId, setRecommendationId] = useState<string | null>(
    initialRecommendation?.id ?? null
  );
  const [outfits, setOutfits] = useState<Outfit[]>(initialRecommendation?.outfits ?? []);
  const [gapQuestion, setGapQuestion] = useState<string | null>(
    initialRecommendation?.gapQuestion ?? null
  );
  const [wornTitle, setWornTitle] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<string[]>([]);
  const [shownLogIds, setShownLogIds] = useState<string[]>([]);
  // Composed outfit mockups, keyed by the outfit's set of pieces (outfitKey).
  const [mockups, setMockups] = useState<Record<string, MockupState>>({});

  useEffect(() => {
    if (!calendarConnected) return;
    fetch("/api/calendar/today")
      .then((res) => res.json())
      .then((data) => setCalendarEvents(data.events ?? []))
      .catch(() => setCalendarEvents([]));
  }, [calendarConnected]);

  // Auto-generate a mockup for every outfit as soon as it's on screen. Each key is
  // requested at most once (a cache hit on the server returns instantly); failures
  // fall back to "none" so a card just shows no illustration rather than an error.
  useEffect(() => {
    if (status !== "results") return;
    for (const outfit of outfits) {
      const key = outfitKey(outfit.items);
      if (!key || mockups[key]) continue;
      setMockups((m) => ({ ...m, [key]: { status: "loading" } }));
      fetch("/api/recommendations/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_ids: outfit.items.map((i) => i.display_id) }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) =>
          setMockups((m) => ({
            ...m,
            [key]: data.mockup ? { status: "ready", url: data.mockup } : { status: "none" },
          }))
        )
        .catch(() => setMockups((m) => ({ ...m, [key]: { status: "none" } })));
    }
  }, [status, outfits, mockups]);

  async function getOutfits() {
    setStatus("loading");
    setError(null);
    setWornTitle(null);
    setMode("claude");
    setShownLogIds([]);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayText: mood ? `${dayText}\nMood: ${mood}` : dayText,
        }),
      });
      if (!res.ok) throw new Error("Couldn't put together outfits — try again?");
      const data = await res.json();
      setRecommendationId(data.id);
      setOutfits(data.outfits ?? []);
      setGapQuestion(data.gap_question ?? null);
      setStatus("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  }

  async function shuffleFavs(excludeIds: string[] = []) {
    setStatus("loading");
    setError(null);
    setWornTitle(null);
    setMode("favs");
    try {
      const res = await fetch("/api/recommendations/favs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayText: mood ? `${dayText}\nMood: ${mood}` : dayText,
          excludeLogIds: excludeIds,
        }),
      });
      if (!res.ok) throw new Error("Couldn't shuffle your favorites — try again?");
      const data = await res.json();
      if (data.empty) {
        setError("Log a few outfits first — shuffle favs needs some history to work with.");
        setStatus("idle");
        return;
      }
      setRecommendationId(data.id);
      setOutfits(data.outfits ?? []);
      setGapQuestion(null);
      setShownLogIds(data.logId ? [...excludeIds, data.logId] : excludeIds);
      setStatus("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    }
  }

  async function woreIt(outfit: Outfit) {
    setWornTitle(outfit.title);
    celebrate();
    if (!recommendationId) return;
    await fetch(`/api/recommendations/${recommendationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome: "worn",
        itemDisplayIds: outfit.items.map((i) => i.display_id),
      }),
    });
  }

  async function skipAll() {
    if (recommendationId) {
      await fetch(`/api/recommendations/${recommendationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "skipped" }),
      });
    }
    if (mode === "favs") {
      shuffleFavs(shownLogIds);
    } else {
      getOutfits();
    }
  }

  return (
    <div className="space-y-4">
      {/* Daily Planner Table */}
      <div className="card bg-slate/5 border border-slate/20">
        {calendarEvents.length > 0 ? (
          <ul className="space-y-1">
            {calendarEvents.map((event, i) => (
              <li key={i} className="text-xs text-ink flex gap-1.5">
                <span className="text-slate/50">-</span>
                <span>{event}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-slate/60">
              {calendarConnected ? "no events scheduled" : <a href="/api/auth/google?mode=calendar" className="text-blue underline">connect google calendar</a>}
            </p>
          </div>
        )}
      </div>

      <div className="card">

        <label className="text-xs font-ui font-semibold text-slate tracking-wide">
          What's your plan?
        </label>
        <p className="text-xs text-slate/70 mt-1 mb-2">
          Tell me about your day and we'll find the perfect looks.
        </p>
        <textarea
          className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
          placeholder="Client meeting, then drinks after..."
          rows={2}
          value={dayText}
          onChange={(e) => setDayText(e.target.value)}
        />

        <label className="text-xs font-ui font-semibold text-slate tracking-wide mt-3 block">
          Mood (optional)
        </label>
        <input
          className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
          placeholder="Feeling bold, feeling cozy..."
          value={mood}
          onChange={(e) => setMood(e.target.value)}
        />

        <div className="flex gap-2 mt-3">
          <button className="btn-primary flex-1" onClick={getOutfits} disabled={status === "loading"}>
            {status === "loading" && mode === "claude" ? "thinking..." : "curate"}
          </button>
          <button
            className="btn-secondary flex-1"
            onClick={() => shuffleFavs([])}
            disabled={status === "loading"}
          >
            {status === "loading" && mode === "favs" ? "shuffling..." : "shuffle favs"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>
      )}

      {status === "results" && initialRecommendation && (
        <p className="text-xs text-slate/60 -mb-2">From your morning digest ☀️</p>
      )}

      {status === "results" &&
        outfits.map((outfit, i) => (
          <div key={i} className="card">
            <p className="text-xs font-ui font-semibold text-slate tracking-wide">
              Outfit {i + 1}
            </p>
            <h2 className="text-lg font-display mt-1">{outfit.title}</h2>
            <p className="font-display italic text-ink/80 mt-1">"{outfit.reasoning}"</p>
            {(() => {
              const mockup = mockups[outfitKey(outfit.items)];
              if (!mockup || mockup.status === "none") return null;
              return (
                <div className="mt-3 aspect-square bg-blue/10 rounded-lg overflow-hidden flex items-center justify-center">
                  {mockup.status === "ready" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mockup.url}
                      alt={`illustration of ${outfit.title}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <p className="text-xs text-slate/60 animate-pulse">sketching this look…</p>
                  )}
                </div>
              );
            })()}
            <div className="flex flex-wrap gap-2 mt-3">
              {outfit.items.map((item) => (
                <span key={item.display_id} className="tag tag-outline">
                  {item.display_id} · {item.name}
                </span>
              ))}
            </div>
            <button
              className="btn-primary mt-3"
              onClick={() => woreIt(outfit)}
              disabled={wornTitle !== null}
            >
              {wornTitle === outfit.title ? "✓ logged" : "wore it"}
            </button>
          </div>
        ))}

      {status === "results" && gapQuestion && (
        <div className="card bg-pink/20 border-pink/40 text-sm">{gapQuestion}</div>
      )}

      {status === "results" && (
        <button className="btn-secondary" onClick={skipAll}>
          {mode === "favs" ? "shuffle again" : "show me something else"}
        </button>
      )}
    </div>
  );
}
