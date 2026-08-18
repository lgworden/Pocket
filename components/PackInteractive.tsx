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

// Shown while a trip's outfits generate: a line-drawn carry-on that folded
// pieces settle into, one at a time. Same illustration idiom as
// WeatherIllustration — caramel line art on the warm-neutral palette.
function PackingLoader() {
  return (
    <div className="card flex flex-col items-center justify-center py-6">
      <svg viewBox="0 0 200 140" className="w-36 h-auto" aria-hidden>
        {/* handle */}
        <path
          d="M82 46V34a18 18 0 0 1 36 0v12"
          fill="none"
          stroke="#AD8A64"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* the case */}
        <rect
          x="40"
          y="46"
          width="120"
          height="80"
          rx="14"
          fill="#F3ECE1"
          stroke="#AD8A64"
          strokeWidth="2"
        />
        {/* folded pieces, stacking bottom-up */}
        <rect className="pack-fold" x="58" y="98" width="84" height="14" rx="7" fill="#EADFCF" />
        <rect
          className="pack-fold"
          style={{ animationDelay: "0.4s" }}
          x="58"
          y="80"
          width="84"
          height="14"
          rx="7"
          fill="#D9C7AE"
        />
        <rect
          className="pack-fold"
          style={{ animationDelay: "0.8s" }}
          x="58"
          y="62"
          width="84"
          height="14"
          rx="7"
          fill="#AD8A64"
        />
        {/* clasp, sitting on the top edge between the handle's legs */}
        <rect
          x="92"
          y="40"
          width="16"
          height="12"
          rx="3"
          fill="#F3ECE1"
          stroke="#AD8A64"
          strokeWidth="2"
        />
      </svg>
      <p className="text-xs text-slate/60 animate-pulse mt-2">packing your bags…</p>
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

// The export panel that closes out a finished plan: mails the whole thing to
// the user as a boarding pass. Self-send only — the field prefills from the
// account email when there is one (username accounts have none), and the copy
// promises we won't mail anyone else.
function EmailPassCard({ planId, defaultEmail }: { planId: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/pack/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "couldn't send that — try again?");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="card bg-blue/10 border-blue/30 text-center">
        <p className="text-2xl" aria-hidden>
          ✈
        </p>
        <p className="text-sm font-ui font-semibold text-brown mt-1">boarding pass sent</p>
        <p className="text-xs text-slate/70 mt-1">check {email} — it's on its way.</p>
        <button
          className="text-xs font-ui text-slate/60 hover:text-slate underline mt-3"
          onClick={() => setState("idle")}
        >
          send it again
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="text-xs font-ui font-semibold text-slate tracking-wide">
        take it with you
      </p>
      <p className="text-sm text-ink/70 mt-1">
        we'll package this whole plan as a boarding pass and email it to you.
      </p>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        className="w-full mt-3 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="btn-primary w-full mt-3"
        onClick={send}
        disabled={state === "sending" || !email.trim()}
      >
        {state === "sending" ? "sending…" : "✈ send my boarding pass"}
      </button>
      {error && <p className="text-xs text-rose mt-2">{error}</p>}
      <p className="text-[11px] text-slate/60 mt-2">we'll only ever mail this to you.</p>
    </div>
  );
}

export default function PackInteractive({ defaultEmail = "" }: { defaultEmail?: string }) {
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
            <span className="text-lg font-ui font-medium w-10 text-center">{days}</span>
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
                  {a.label}
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
            {status === "loading" ? "packing…" : "pack my bags"}
          </button>
        </div>
      )}

      {error && <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>}

      {status === "loading" && <PackingLoader />}

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
                ? ` · ${plan.weather.precipitationDays} rainy day${plan.weather.precipitationDays === 1 ? "" : "s"}`
                : ""}
            </p>
            {activities.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {activities.map((a) => (
                  <span key={a} className="tag tag-pink">
                    {activityLabel(a)}
                  </span>
                ))}
              </div>
            )}
            <p className="font-display italic text-ink/80 mt-3">"{plan.packing_tip}"</p>
          </div>

          <div className="card">
            <p className="text-xs font-ui font-semibold text-slate tracking-wide">
              What to pack — your 3·3·3 capsule
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
            {plan.outfits.length} outfits from one carry-on
          </p>
          {plan.outfits.map((outfit, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-ui font-semibold text-slate tracking-wide">
                  Outfit {i + 1}
                </p>
                {outfit.activity && (
                  <span className="tag tag-pink shrink-0">{activityLabel(outfit.activity)}</span>
                )}
              </div>
              <h3 className="text-lg font-display mt-1">{outfit.title}</h3>
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

          <EmailPassCard planId={plan.id} defaultEmail={defaultEmail} />

          <button className="btn-secondary w-full" onClick={reset}>
            plan another trip
          </button>
        </>
      )}
    </div>
  );
}
