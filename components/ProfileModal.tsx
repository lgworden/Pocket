"use client";

import { useState } from "react";
import Modal from "./Modal";
import StylePicker from "./StylePicker";
import GoalsPicker from "./GoalsPicker";

interface User {
  name: string;
  display_name?: string;
  username?: string;
  bio?: string | null;
  location?: string | null;
  home_address?: string | null;
  style_profile?: Record<string, any>;
}

export default function ProfileModal({
  user,
  open,
  onClose,
}: {
  user: User;
  open: boolean;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name || user.name);
  const [username, setUsername] = useState(user.username || "");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [bio, setBio] = useState(user.bio || "");
  const [location, setLocation] = useState(user.location || "");
  const [homeAddress, setHomeAddress] = useState(user.home_address || "");
  const [styleTypes, setStyleTypes] = useState<string[]>(user.style_profile?.style_types || []);
  const [goals, setGoals] = useState<string[]>(user.style_profile?.goals || []);
  const [otherOn, setOtherOn] = useState(Boolean(user.style_profile?.goals_other));
  const [goalsOther, setGoalsOther] = useState(user.style_profile?.goals_other || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkUsername(value: string) {
    if (!value) return;
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (data.available) {
        setUsernameError(null);
      } else {
        setUsernameError("This username is taken");
      }
    } catch {
      setUsernameError("Couldn't check availability");
    } finally {
      setCheckingUsername(false);
    }
  }

  async function save() {
    if (username && usernameError) {
      setError("Please fix your username");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          username: username || null,
          bio: bio.trim(),
          location: location.trim(),
          home_address: homeAddress.trim(),
          style_profile: {
            style_types: styleTypes,
            goals,
            goals_other: otherOn ? goalsOther : "",
          },
        }),
      });
      if (!res.ok) throw new Error("Couldn't save — try again?");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Your info">
      <div className="space-y-5">
        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            What should we call you?
          </label>
          <input
            type="text"
            className="w-full mt-2 bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Username
          </label>
          <p className="text-xs text-slate/60 mt-1 mb-2">
            How friends will find you. Leave blank if you prefer not to share.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="username"
                className={`w-full bg-transparent border rounded-lg p-2 text-sm ${
                  usernameError ? "border-rose/50" : "border-slate/20"
                }`}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (e.target.value && e.target.value !== user.username) {
                    checkUsername(e.target.value);
                  }
                }}
              />
              {usernameError && (
                <p className="text-xs text-rose mt-1">{usernameError}</p>
              )}
            </div>
            {checkingUsername && (
              <div className="flex items-center text-xs text-slate/60">checking...</div>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Bio (optional)
          </label>
          <p className="text-xs text-slate/60 mt-1 mb-2">Shown on your profile.</p>
          <textarea
            className="w-full bg-transparent border border-slate/20 rounded-lg p-2 text-sm resize-none"
            rows={2}
            placeholder="a line about your style..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Location
          </label>
          <p className="text-xs text-slate/60 mt-1 mb-2">
            City used for weather, e.g. "Washington, DC".
          </p>
          <input
            type="text"
            placeholder="City, State"
            className="w-full bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            Home address (optional)
          </label>
          <p className="text-xs text-slate/60 mt-1 mb-2">
            Lets us tell when back-to-back events don't leave time to swing home and
            change, so we can suggest one outfit that works for both.
          </p>
          <input
            type="text"
            placeholder="123 Main St, Washington, DC"
            className="w-full bg-transparent border border-slate/20 rounded-lg p-2 text-sm"
            value={homeAddress}
            onChange={(e) => setHomeAddress(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            What's your vibe?
          </label>
          <p className="text-xs text-slate/60 mt-1 mb-3">
            How would you describe your personal style? (select all that apply)
          </p>
          <StylePicker value={styleTypes} onChange={setStyleTypes} />
        </div>

        <div>
          <label className="text-xs font-ui font-semibold text-slate tracking-wide">
            How can we help?
          </label>
          <p className="text-xs text-slate/60 mt-1 mb-3">
            Select everything you're hoping to get out of this. (select all that apply)
          </p>
          <GoalsPicker
            value={goals}
            onChange={setGoals}
            otherOn={otherOn}
            onOtherOnChange={setOtherOn}
            otherText={goalsOther}
            onOtherTextChange={setGoalsOther}
          />
        </div>

        {error && (
          <div className="bg-rose/10 border border-rose/30 rounded-lg p-3 text-sm text-rose">
            {error}
          </div>
        )}

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "saving..." : "save"}
        </button>
      </div>
    </Modal>
  );
}
