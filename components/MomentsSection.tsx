"use client";

import { useMemo, useState } from "react";
import type { MomentWithMembers } from "@/lib/moments";
import MomentCard from "./MomentCard";
import MomentComposer from "./MomentComposer";

// The Moments block on the Today screen (app/stylist). Holds the "Created by
// you" and "Invited to you" (pending / active) sections plus the create/edit
// composer. Seeded with server-fetched data; mutations update local state so
// the screen reflects changes without a full reload.
export default function MomentsSection({
  currentUserId,
  isDesigner,
  calendarConnected,
  initialCreated,
  initialInvited,
}: {
  currentUserId: string;
  isDesigner: boolean;
  calendarConnected: boolean;
  initialCreated: MomentWithMembers[];
  initialInvited: MomentWithMembers[];
}) {
  const [created, setCreated] = useState(initialCreated);
  const [invited, setInvited] = useState(initialInvited);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<MomentWithMembers | null>(null);

  const { pending, active } = useMemo(() => {
    return {
      pending: invited.filter((m) => m.user_status === "pending"),
      active: invited.filter((m) => m.user_status === "accepted"),
    };
  }, [invited]);

  function upsert(list: MomentWithMembers[], m: MomentWithMembers): MomentWithMembers[] {
    const i = list.findIndex((x) => x.id === m.id);
    if (i === -1) return [...list, m];
    const next = [...list];
    next[i] = m;
    return next;
  }

  function handleSaved(m: MomentWithMembers) {
    if (m.user_role === "creator") {
      setCreated((prev) => upsert(prev, m));
    } else {
      setInvited((prev) => upsert(prev, m));
    }
  }

  function handleDeleted(id: string) {
    setCreated((prev) => prev.filter((m) => m.id !== id));
    setInvited((prev) => prev.filter((m) => m.id !== id));
  }

  // A declined invite leaves the "invited" lists; anything else just updates.
  function handleChanged(m: MomentWithMembers) {
    if (m.user_status === "declined") {
      setInvited((prev) => prev.filter((x) => x.id !== m.id));
    } else {
      setInvited((prev) => upsert(prev, m));
    }
  }

  function openCreate() {
    setEditing(null);
    setComposerOpen(true);
  }

  function openEdit(m: MomentWithMembers) {
    setEditing(m);
    setComposerOpen(true);
  }

  const nothing = created.length === 0 && invited.length === 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-ui font-semibold uppercase tracking-wide text-slate">
          Moments
        </h2>
        <button
          onClick={openCreate}
          className="text-xs font-ui font-semibold rounded-full px-3 py-1.5 btn-primary"
        >
          + new
        </button>
      </div>

      {nothing && (
        <p className="text-sm text-ink/50">
          Plan a group fit for an upcoming event — invite friends and coordinate looks in one place.
        </p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-ui text-slate/80">Invites</p>
          {pending.map((m) => (
            <MomentCard
              key={m.id}
              moment={m}
              currentUserId={currentUserId}
              onChanged={handleChanged}
            />
          ))}
        </div>
      )}

      {created.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-ui text-slate/80">Created by you</p>
          {created.map((m) => (
            <MomentCard
              key={m.id}
              moment={m}
              currentUserId={currentUserId}
              onEdit={openEdit}
              onChanged={handleSaved}
            />
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-ui text-slate/80">You're going</p>
          {active.map((m) => (
            <MomentCard
              key={m.id}
              moment={m}
              currentUserId={currentUserId}
              onEdit={m.user_role === "collaborator" ? openEdit : undefined}
              onChanged={handleChanged}
            />
          ))}
        </div>
      )}

      <MomentComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSaved={handleSaved}
        onDeleted={editing?.user_role === "creator" ? handleDeleted : undefined}
        isDesigner={isDesigner}
        calendarConnected={calendarConnected}
        editing={editing}
      />
    </section>
  );
}
