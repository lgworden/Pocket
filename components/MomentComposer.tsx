"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import type { MomentWithMembers } from "@/lib/moments";

// Curated vibe chips — tap to toggle, up to 5 (matches the spec's chip set).
const VIBE_WORDS = [
  "warm", "dressy", "casual", "autumnal", "glam", "cozy",
  "sporty", "edgy", "minimal", "playful", "elegant", "relaxed",
];
const MAX_VIBES = 5;

type SearchUser = {
  id: string;
  username: string | null;
  display_name: string;
  avatar?: string | null;
  is_mutual: boolean;
};

type PendingMember = { id: string; label: string; role: "invitee" | "collaborator" };

// Converts a datetime-local value ("2026-08-15T19:00") to an ISO string, or "".
function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

// ISO → datetime-local value in the viewer's local zone.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function MomentComposer({
  open,
  onClose,
  onSaved,
  onDeleted,
  isDesigner,
  calendarConnected,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (m: MomentWithMembers) => void;
  onDeleted?: (id: string) => void;
  isDesigner: boolean;
  calendarConnected: boolean;
  editing?: MomentWithMembers | null;
}) {
  const isEdit = !!editing;

  const [eventName, setEventName] = useState("");
  const [location, setLocation] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [formality, setFormality] = useState(5);
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [writeToGcal, setWriteToGcal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Re)seed the form whenever the modal opens or the target moment changes.
  useEffect(() => {
    if (!open) return;
    setEventName(editing?.event_name ?? "");
    setLocation(editing?.location ?? "");
    setMapsLink(editing?.google_maps_link ?? "");
    setStart(toLocalInput(editing?.event_date_time ?? null));
    setEnd(toLocalInput(editing?.event_end_time ?? null));
    // Default the GCal box on only when editing an already-linked moment.
    setWriteToGcal(calendarConnected && !!editing?.gcal_event_id);
    setVibes(editing?.vibe_words ?? []);
    setFormality(editing?.formality_level ?? 5);
    setPending([]);
    setQuery("");
    setResults([]);
    setError(null);
  }, [open, editing, calendarConnected]);

  // Debounced member search, scoped by designer status.
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const scope = isDesigner ? "all" : "mutual";
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query.trim())}&scope=${scope}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setResults(data.users || []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, open, isDesigner]);

  function toggleVibe(v: string) {
    setVibes((prev) =>
      prev.includes(v)
        ? prev.filter((x) => x !== v)
        : prev.length >= MAX_VIBES
        ? prev
        : [...prev, v]
    );
  }

  function addPending(u: SearchUser) {
    const label = u.username ? `@${u.username}` : u.display_name;
    setPending((prev) =>
      prev.some((p) => p.id === u.id) ? prev : [...prev, { id: u.id, label, role: "invitee" }]
    );
    setQuery("");
    setResults([]);
  }

  function setRole(id: string, role: "invitee" | "collaborator") {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSave() {
    setError(null);
    if (!eventName.trim()) return setError("Give your moment a name.");
    if (!start) return setError("Pick a date and time.");
    setSaving(true);
    try {
      const invitee_user_ids = pending.filter((p) => p.role === "invitee").map((p) => p.id);
      const collaborator_user_ids = pending
        .filter((p) => p.role === "collaborator")
        .map((p) => p.id);

      const details = {
        event_name: eventName.trim(),
        location: location.trim() || null,
        google_maps_link: mapsLink.trim() || null,
        event_date_time: toIso(start),
        event_end_time: toIso(end) || null,
        vibe_words: vibes,
        formality_level: formality,
      };

      let saved: MomentWithMembers;
      if (isEdit && editing) {
        if (invitee_user_ids.length || collaborator_user_ids.length) {
          const mr = await fetch(`/api/moments/${editing.id}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invitee_user_ids, collaborator_user_ids }),
          });
          if (!mr.ok) throw new Error((await mr.json()).error || "Couldn't add members");
        }
        const res = await fetch(`/api/moments/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(details),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Couldn't save changes");
        saved = await res.json();
      } else {
        const res = await fetch("/api/moments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...details, invitee_user_ids, collaborator_user_ids }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Couldn't create moment");
        saved = await res.json();
      }

      // Google Calendar write-back: push when the box is checked, or unlink when
      // an already-linked moment gets it unchecked. A sync failure must not lose
      // the just-saved moment, so propagate it before surfacing the error.
      const wasLinked = !!editing?.gcal_event_id;
      if (writeToGcal || (isEdit && wasLinked && !writeToGcal)) {
        const sres = await fetch(`/api/moments/${saved.id}/gcal-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ write: writeToGcal }),
        });
        if (sres.ok) {
          saved = await sres.json();
        } else {
          onSaved(saved);
          throw new Error((await sres.json()).error || "Saved, but Google Calendar sync failed");
        }
      }

      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing || !onDeleted) return;
    if (!confirm("Delete this moment? This can't be undone.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/moments/${editing.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Couldn't delete");
      onDeleted(editing.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const existingMembers = editing?.members.filter((m) => m.role !== "creator") ?? [];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit moment" : "New moment"}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-ui text-slate">Event name</label>
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Sara's birthday dinner"
            className="mt-1 w-full bg-cream border border-slate/20 rounded-xl px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-ui text-slate">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Address or place name"
            className="mt-1 w-full bg-cream border border-slate/20 rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            placeholder="Google Maps link (optional)"
            className="mt-2 w-full bg-cream border border-slate/20 rounded-xl px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-ui text-slate">Starts</label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full bg-cream border border-slate/20 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-ui text-slate">Ends (optional)</label>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full bg-cream border border-slate/20 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-ui text-slate">
            Vibe <span className="text-slate/60">({vibes.length}/{MAX_VIBES})</span>
          </label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {VIBE_WORDS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleVibe(v)}
                className={`tag ${vibes.includes(v) ? "tag-blue" : "tag-outline"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-ui text-slate">
            Formality <span className="text-slate/60">{formality}/10</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={formality}
            onChange={(e) => setFormality(Number(e.target.value))}
            className="mt-1 w-full accent-ink"
          />
          <div className="flex justify-between text-[10px] text-slate/60">
            <span>sweatpants</span>
            <span>black tie</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-ui text-slate">
            {isDesigner ? "Invite anyone" : "Invite mutual friends"}
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by @username or name..."
            className="mt-1 w-full bg-cream border border-slate/20 rounded-xl px-3 py-2 text-sm"
          />
          {results.length > 0 && (
            <ul className="mt-2 space-y-1">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => addPending(u)}
                    className="w-full text-left flex items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2 text-sm hover:bg-pink/40"
                  >
                    <span className="truncate">
                      {u.display_name}{" "}
                      {u.username && <span className="text-slate">@{u.username}</span>}
                    </span>
                    <span className="text-xs text-slate shrink-0">
                      {u.is_mutual ? "add" : "invite"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pending.length > 0 && (
            <ul className="mt-2 space-y-1">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-panel border border-slate/10 px-3 py-2 text-sm"
                >
                  <span className="truncate">{p.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={p.role}
                      onChange={(e) => setRole(p.id, e.target.value as "invitee" | "collaborator")}
                      className="bg-cream border border-slate/20 rounded-full text-xs px-2 py-1"
                    >
                      <option value="invitee">invitee</option>
                      <option value="collaborator">co-host</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removePending(p.id)}
                      className="text-slate/60 hover:text-rose text-lg leading-none"
                      aria-label="remove"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isEdit && existingMembers.length > 0 && (
            <p className="mt-2 text-xs text-slate">
              Already in: {existingMembers.map((m) => m.username ? `@${m.username}` : m.name).join(", ")}
            </p>
          )}
        </div>

        {/* Google Calendar write-back — enabled once the user's calendar is
            connected (with the write scope). Not connected → point them at the
            existing connect flow rather than a dead checkbox. */}
        {calendarConnected ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={writeToGcal}
              onChange={(e) => setWriteToGcal(e.target.checked)}
              className="accent-ink"
            />
            Add to Google Calendar
          </label>
        ) : (
          <p className="text-sm text-slate/70">
            <a href="/api/auth/google?mode=calendar" className="text-blue underline underline-offset-2">
              Connect Google Calendar
            </a>{" "}
            to add moments to your calendar.
          </p>
        )}

        {error && <p className="text-sm text-rose">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "saving..." : isEdit ? "save changes" : "create moment"}
          </button>
          {isEdit && onDeleted && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-sm text-rose font-ui ml-auto"
            >
              delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
