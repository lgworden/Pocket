"use client";

import { useState } from "react";
import { celebrate } from "@/lib/confetti";
import { TRIP_ACTIVITIES } from "@/lib/tripActivities";

type PieceRef = { display_id: string; name: string };
type Extra = PieceRef & { reason: string };
type Outfit = { title: string; activity: string; reasoning: string; items: PieceRef[] };
type Plan = {
  id: string;
  trip_title: string;
  packing_tip: string;
  capsule: { tops: PieceRef[]; bottoms: PieceRef[]; shoes: PieceRef[]; extras: Extra[] };
  outfits: Outfit[];
  dont_forget: string[];
  weather: {
    tempHighF: number;
    tempLowF: number;
    precipitationDays: number;
    conditions: string[];
    label: string;
    days: number;
  };
};

const activityLabel = (value: string) =>
  TRIP_ACTIVITIES.find((a) => a.value === value)?.label ?? value.replace(/_/g, " ");
const activityEmoji = (value: string) =>
  TRIP_ACTIVITIES.find((a) => a.value === value)?.emoji ?? "✨";

// The airplane-flying takeover shown while a trip's outfits generate.
function FlyingLoader() {
  return (
    <div className="card relative overflow-hidden bg-blue/10 border-blue/30 h-40 flex flex-col items-center justify-center">
      {/* drifting clouds */}
      <svg className="cloud-drift absolute top-4 left-8 text-cream/80" width="48" height="20" viewBox="0 0 48 20" fill="currentColor" aria-hidden>
        <ellipse cx="14" cy="12" rx="14" ry="8" /><ellipse cx="30" cy="10" rx="12" ry="9" /><ellipse cx="40" cy="13" rx="8" ry="6" />
      </svg>
      <svg className="cloud-drift absolute bottom-6 right-10 text-cream/70" width="40" height="16" viewBox="0 0 48 20" fill="currentColor" aria-hidden style={{ animationDelay: "0.6s" }}>
        <ellipse cx="14" cy="12" rx="14" ry="8" /><ellipse cx="30" cy="10" rx="12" ry="9" /><ellipse cx="40" cy="13" rx="8" ry="6" />
      </svg>

      {/* the plane, banking across with a dashed vapor trail */}
      <div className="plane-fly absolute top-1/2 left-0 -translate-y-1/2">
        <svg width="90" height="34" viewBox="0 0 90 34" fill="none" aria-hidden>
          <path className="plane-trail" d="M2 20 H50" stroke="#AD8A64" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M52 6c5-2 12-3 18-1 4 1 6 3 5 5s-4 3-8 3l-9 1-8 9c-1 1-3 1-3-1l1-6-7 1-3 4c-1 1-3 1-3-1l1-5-1-5c0-2 2-3 3-2l3 4 7-1-2-6c0-2 2-3 3-2l14 5z"
            fill="#7A5C3E"
          />
        </svg>
      </div>

      <p className="text-sm font-ui font-semibold text-ink mt-auto mb-2 z-10">packing your bags…</p>
    </div>
  );
}

function PieceChips({ pieces }: { pieces: PieceRef[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {pieces.map((p) => (
        <span key={p.display_id} className="tag tag-outline">
          {p.display_id} · {p.name}
        </span>
      ))}
    </div>
  );
}

export default function PackInteractive() {
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(4);
  const [activities, setActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "results">("idle");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const toggleActivity = (value: string) =>
    setActivities((cur) =>
      cur.includes(value) ? cur.filter((a) => a !== value) : [...cur, value]
    );

  async function pack() {
    if (!destination.trim()) {
      setError("where are you headed? add a destination first.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, days, activities, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "couldn't pack your bags — try again?");
      setPlan(data);
      setStatus("results");
      celebrate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
      setStatus("idle");
    }
  }

  function reset() {
    setStatus("idle");
    setPlan(null);
  }

  return (
    <div className="space-y-4">
      {status !== "results" && (
        <div className="card">
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Where to?
          </label>
          <input
            className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
            placeholder="Lisbon, Portugal"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />

          <label className="text-xs font-ui font-semibold text-slate tracking-wide mt-4 block">
            How many days?
          </label>
          <div className="flex items-center gap-3 mt-2">
            <button
              className="btn-secondary w-9 h-9 flex items-center justify-center p-0"
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              aria-label="fewer days"
            >
              −
            </button>
            <span className="text-lg font-display w-10 text-center">{days}</span>
            <button
              className="btn-secondary w-9 h-9 flex items-center justify-center p-0"
              onClick={() => setDays((d) => Math.min(30, d + 1))}
              aria-label="more days"
            >
              +
            </button>
          </div>

          <label className="text-xs font-ui font-semibold text-slate tracking-wide mt-4 block">
            What's the vibe? (tap all that apply)
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {TRIP_ACTIVITIES.map((a) => {
              const on = activities.includes(a.value);
              return (
                <button
                  key={a.value}
                  onClick={() => toggleActivity(a.value)}
                  className={`tag transition-colors ${on ? "tag-blue" : "tag-outline"}`}
                >
                  {a.emoji} {a.label}
                </button>
              );
            })}
          </div>

          <label className="text-xs font-ui font-semibold text-slate tracking-wide mt-4 block">
            Anything else? (optional)
          </label>
          <textarea
            className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
            placeholder="staying with friends, one fancy dinner planned..."
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button
            className="btn-primary w-full mt-4"
            onClick={pack}
            disabled={status === "loading"}
          >
            {status === "loading" ? "packing…" : "pack my bags ✈️"}
          </button>
        </div>
      )}

      {error && <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>}

      {status === "loading" && <FlyingLoader />}

      {status === "results" && plan && (
        <>
          <div className="card bg-blue/10 border-blue/30">
            <p className="text-xs font-ui font-semibold text-slate tracking-wide">Your trip</p>
            <h2 className="text-xl font-display mt-1">{plan.trip_title}</h2>
            <p className="text-sm text-ink/60 mt-1">
              {plan.weather.label} · {plan.weather.days} day
              {plan.weather.days === 1 ? "" : "s"} · {plan.weather.tempHighF}°/
              {plan.weather.tempLowF}° · {plan.weather.conditions.join(", ").toLowerCase()}
              {plan.weather.precipitationDays > 0
                ? ` · ${plan.weather.precipitationDays} rainy day${plan.weather.precipitationDays === 1 ? "" : "s"} ☔`
                : ""}
            </p>
            {activities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {activities.map((a) => (
                  <span key={a} className="tag tag-pink">
                    {activityEmoji(a)} {activityLabel(a)}
                  </span>
                ))}
              </div>
            )}
            <p className="font-display italic text-ink/80 mt-3">"{plan.packing_tip}"</p>
          </div>

          <div className="card">
            <p className="text-xs font-ui font-semibold text-slate tracking-wide">
              🧳 What to pack — your 3·3·3 capsule
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-ui font-semibold text-ink/70">
                  tops ({plan.capsule.tops.length})
                </p>
                <PieceChips pieces={plan.capsule.tops} />
              </div>
              <div>
                <p className="text-xs font-ui font-semibold text-ink/70">
                  bottoms ({plan.capsule.bottoms.length})
                </p>
                <PieceChips pieces={plan.capsule.bottoms} />
              </div>
              <div>
                <p className="text-xs font-ui font-semibold text-ink/70">
                  shoes ({plan.capsule.shoes.length})
                </p>
                <PieceChips pieces={plan.capsule.shoes} />
              </div>
              {plan.capsule.extras.length > 0 && (
                <div>
                  <p className="text-xs font-ui font-semibold text-ink/70">
                    + extras for your plans
                  </p>
                  <div className="flex flex-col gap-2 mt-2">
                    {plan.capsule.extras.map((e) => (
                      <div key={e.display_id} className="flex flex-wrap items-center gap-2">
                        <span className="tag tag-brown">
                          {e.display_id} · {e.name}
                        </span>
                        <span className="text-xs text-slate/60">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs font-ui font-semibold text-slate tracking-wide px-1">
            👗 {plan.outfits.length} outfits from one carry-on
          </p>
          {plan.outfits.map((outfit, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-display">{outfit.title}</h3>
                {outfit.activity && (
                  <span className="tag tag-pink shrink-0">
                    {activityEmoji(outfit.activity)} {activityLabel(outfit.activity)}
                  </span>
                )}
              </div>
              <p className="font-display italic text-ink/80 mt-1">"{outfit.reasoning}"</p>
              <PieceChips pieces={outfit.items} />
            </div>
          ))}

          {plan.dont_forget.length > 0 && (
            <div className="card bg-pink/20 border-pink/40">
              <p className="text-xs font-ui font-semibold text-ink/70">don't forget to grab</p>
              <ul className="mt-2 space-y-1">
                {plan.dont_forget.map((d, i) => (
                  <li key={i} className="text-sm text-ink/80">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="btn-secondary w-full" onClick={reset}>
            plan another trip ✈️
          </button>
        </>
      )}
    </div>
  );
}
