"use client";

import { useState } from "react";
import type { MomentWithMembers } from "@/lib/moments";
import MomentPhotoButton from "./MomentPhotoButton";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// "expires in 2 days" / "expires in 5 hours" / "expiring soon".
function expiryLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.round(ms / 3_600_000);
  if (hours >= 48) return `expires in ${Math.round(hours / 24)} days`;
  if (hours >= 1) return `expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  return "expiring soon";
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function MomentCard({
  moment,
  currentUserId,
  onEdit,
  onChanged,
}: {
  moment: MomentWithMembers;
  currentUserId: string;
  onEdit?: (m: MomentWithMembers) => void;
  onChanged?: (m: MomentWithMembers) => void;
}) {
  const [busy, setBusy] = useState(false);
  const canEdit = moment.user_role === "creator" || moment.user_role === "collaborator";
  const isPendingInvite = moment.user_role !== null && moment.user_status === "pending";
  // Any accepted participant (creator/collaborator/accepted invitee) can pin
  // inspo and add their own fit.
  const isParticipant = moment.user_status === "accepted";

  async function deleteInspo(inspoId: string) {
    const res = await fetch(`/api/moments/${moment.id}/inspo/${inspoId}`, { method: "DELETE" });
    if (res.ok) onChanged?.(await res.json());
  }

  async function respond(status: "accepted" | "declined") {
    setBusy(true);
    try {
      const res = await fetch(`/api/moments/${moment.id}/members/${currentUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      onChanged?.(await res.json());
    } catch {
      // Leave the card as-is; the user can retry.
    } finally {
      setBusy(false);
    }
  }

  const attending = moment.members.filter((m) => m.status === "accepted");

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose" />
        <span className="text-[10px] font-ui font-semibold uppercase tracking-wide text-rose/90">
          {expiryLabel(moment.expires_at)}
        </span>
      </div>

      <div>
        <h3 className="text-lg font-display leading-tight">{moment.event_name}</h3>
        <p className="text-sm text-ink/60 mt-0.5">{formatWhen(moment.event_date_time)}</p>
        {moment.location &&
          (moment.google_maps_link ? (
            <a
              href={moment.google_maps_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue underline underline-offset-2"
            >
              {moment.location}
            </a>
          ) : (
            <p className="text-sm text-slate">{moment.location}</p>
          ))}
      </div>

      {moment.vibe_words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {moment.vibe_words.map((v) => (
            <span key={v} className="tag tag-outline">
              {v}
            </span>
          ))}
          {moment.formality_level != null && (
            <span className="tag tag-pink">formality {moment.formality_level}/10</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {attending.slice(0, 4).map((m) => (
            <span
              key={m.user_id}
              title={m.name}
              className="w-7 h-7 rounded-full bg-pink text-ink text-xs flex items-center justify-center border-2 border-panel overflow-hidden"
            >
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                initials(m.name)
              )}
            </span>
          ))}
        </div>
        <span className="text-xs text-slate">
          {attending.length} {attending.length === 1 ? "person" : "people"}
        </span>
      </div>

      {(moment.fit_inspo.length > 0 || isParticipant) && (
        <div>
          <p className="text-xs font-ui text-slate/80 mb-1">moodboard</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {moment.fit_inspo.map((i) => {
              const canRemove =
                i.uploaded_by_id === currentUserId || moment.user_role === "creator";
              return (
                <div key={i.id} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.image_url}
                    alt="inspo"
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                  {canRemove && (
                    <button
                      onClick={() => deleteInspo(i.id)}
                      aria-label="remove"
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-ink text-cream text-[10px] leading-none flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {isParticipant && onChanged && (
              <MomentPhotoButton
                endpoint={`/api/moments/${moment.id}/inspo`}
                label="+ inspo"
                onUploaded={onChanged}
              />
            )}
          </div>
        </div>
      )}

      {(moment.fits.length > 0 || isParticipant) && (
        <div>
          <p className="text-xs font-ui text-slate/80 mb-1">fits</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {moment.fits.map((f) => (
              <div key={f.id} className="shrink-0" title={f.author_name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.photo} alt={f.author_name} className="w-14 h-14 rounded-xl object-cover" />
              </div>
            ))}
            {isParticipant && onChanged && (
              <MomentPhotoButton
                endpoint={`/api/moments/${moment.id}/fits`}
                label="+ your fit"
                onUploaded={onChanged}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {isPendingInvite && (
          <>
            <button
              onClick={() => respond("accepted")}
              disabled={busy}
              className="btn-primary disabled:opacity-50"
            >
              accept
            </button>
            <button
              onClick={() => respond("declined")}
              disabled={busy}
              className="btn-secondary disabled:opacity-50"
            >
              decline
            </button>
          </>
        )}
        {canEdit && onEdit && (
          <button onClick={() => onEdit(moment)} className="btn-secondary">
            edit
          </button>
        )}
      </div>
    </div>
  );
}
