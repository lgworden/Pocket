"use client";

import { useState } from "react";
import Link from "next/link";
import ProfileModal from "./ProfileModal";
import NotificationsModal from "./NotificationsModal";

interface User {
  id: string;
  name: string;
  display_name?: string;
  bio?: string | null;
  location?: string;
  home_address?: string | null;
  style_profile?: Record<string, any>;
  scheduling_preferences?: Record<string, any>;
  notification_preferences?: Record<string, any>;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type RecurringLocation = {
  id: string;
  name: string;
  days: string[];
};

// Seed the table from stored recurring locations, migrating any legacy
// `office_days` into a dedicated "Office" row so the two day-pickers collapse
// into one table (rows = locations, columns = weekdays).
function initialLocations(user: User): RecurringLocation[] {
  const locs: RecurringLocation[] = user.scheduling_preferences?.recurring_locations || [];
  const officeDays: string[] = user.scheduling_preferences?.office_days || [];
  const hasOffice = locs.some((l) => l.name.trim().toLowerCase() === "office");
  if (officeDays.length && !hasOffice) {
    return [{ id: "office-seed", name: "Office", days: officeDays }, ...locs];
  }
  return locs;
}

export default function PreferencesInteractive({ user }: { user: User; userId: string }) {
  const [locations, setLocations] = useState<RecurringLocation[]>(() => initialLocations(user));
  const [newLocationName, setNewLocationName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const toggleCell = (locationId: string, day: string) => {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.id === locationId
          ? {
              ...loc,
              days: loc.days.includes(day)
                ? loc.days.filter((d) => d !== day)
                : [...loc.days, day],
            }
          : loc
      )
    );
  };

  const addLocation = () => {
    const name = newLocationName.trim();
    if (!name) return;
    setLocations((prev) => [...prev, { id: Date.now().toString(), name, days: [] }]);
    setNewLocationName("");
  };

  const removeLocation = (id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id));
  };

  async function savePreferences() {
    setSaving(true);
    try {
      // Keep `office_days` in sync (derived from the Office row) for any code
      // that still reads it, while the table itself lives in recurring_locations.
      const officeRow = locations.find((l) => l.name.trim().toLowerCase() === "office");
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduling_preferences: {
            recurring_locations: locations,
            office_days: officeRow?.days || [],
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving preferences:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Account */}
      <div className="space-y-2">
        <Link
          href={`/profile/${user.id}`}
          className="card w-full flex items-center justify-between"
        >
          <span className="text-sm font-medium">View profile</span>
          <span className="text-slate">→</span>
        </Link>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="card w-full flex items-center justify-between"
        >
          <span className="text-sm font-medium">My profile</span>
          <span className="text-slate">→</span>
        </button>
        <button
          type="button"
          onClick={() => setNotifOpen(true)}
          className="card w-full flex items-center justify-between"
        >
          <span className="text-sm font-medium">Notifications</span>
          <span className="text-slate">→</span>
        </button>
      </div>

      {/* Weekly location schedule */}
      <div className="card">
        <label className="text-xs font-ui font-semibold text-slate tracking-wide">
          Weekly schedule
        </label>
        <p className="text-xs text-slate/60 mt-1 mb-3">
          Tap a day to mark where you usually are. Rows are places, columns are days.
        </p>

        {locations.length > 0 ? (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="w-px"></th>
                  {DAY_SHORT.map((d) => (
                    <th
                      key={d}
                      className="text-[11px] font-ui font-semibold text-slate/70 pb-1"
                    >
                      {d}
                    </th>
                  ))}
                  <th className="w-px"></th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td className="pr-2 max-w-[84px]">
                      <span className="block text-sm text-ink truncate" title={loc.name}>
                        {loc.name}
                      </span>
                    </td>
                    {DAYS.map((day) => {
                      const on = loc.days.includes(day);
                      return (
                        <td key={day} className="text-center">
                          <button
                            type="button"
                            aria-pressed={on}
                            aria-label={`${loc.name} ${day}`}
                            onClick={() => toggleCell(loc.id, day)}
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs transition-colors ${
                              on
                                ? "bg-ink border-ink text-cream"
                                : "bg-transparent border-slate/25 text-transparent hover:border-slate/50"
                            }`}
                          >
                            {on ? "★" : "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="pl-1">
                      <button
                        type="button"
                        aria-label={`Remove ${loc.name}`}
                        onClick={() => removeLocation(loc.id)}
                        className="text-slate/40 hover:text-rose text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate/50 italic mb-3">
            No places yet — add one below to start your week.
          </p>
        )}

        {/* Add a location row */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate/15">
          <input
            type="text"
            placeholder="e.g., office, gym, studio"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLocation();
              }
            }}
            className="flex-1 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
          />
          <button
            type="button"
            onClick={addLocation}
            disabled={!newLocationName.trim()}
            className="btn-primary text-sm py-2 px-4 disabled:opacity-40"
          >
            add
          </button>
        </div>
      </div>

      {saved && (
        <div className="card bg-blue/10 border-blue/30 text-sm text-blue">
          ✓ Preferences saved
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={savePreferences}
        disabled={saving}
      >
        {saving ? "saving..." : "save preferences"}
      </button>

      <ProfileModal user={user} open={profileOpen} onClose={() => setProfileOpen(false)} />
      <NotificationsModal user={user} open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
