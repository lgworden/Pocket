"use client";

import { useMemo, useState } from "react";
import type { MomentWithMembers } from "@/lib/moments";
import Modal from "./Modal";
import VibeCard from "./VibeCard";
import VibeComposer from "./VibeComposer";

// The "vibe check" block on the Today screen (app/stylist). Renders as a
// compact entry card — same idiom as the "where to next?" card beneath it —
// that opens a modal holding the "Invites", "Created by you" and "You're
// going" lists plus the create/edit composer. Seeded with server-fetched
// data; mutations update local state so the modal reflects changes without a
// full reload. `autoOpen` comes from a `/stylist?moment=<id>` deep link.
export default function VibeCheckSection({
  currentUserId,
  isDesigner,
  calendarConnected,
  initialCreated,
  initialInvited,
  autoOpen = false,
}: {
  currentUserId: string;
  isDesigner: boolean;
  calendarConnected: boolean;
  initialCreated: MomentWithMembers[];
  initialInvited: MomentWithMembers[];
  autoOpen?: boolean;
}) {
  const [created, setCreated] = useState(initialCreated);
  const [invited, setInvited] = useState(initialInvited);
  const [open, setOpen] = useState(autoOpen);
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
  const goingCount = created.length + active.length;

  // Card subtitle: surface pending invites first, then a plan count, then the
  // pitch for a first-time user.
  const subtitle =
    pending.length > 0
      ? `${pending.length} invite${pending.length === 1 ? "" : "s"} waiting`
      : goingCount > 0
      ? `${goingCount} in the works`
      : "plan a group fit for an upcoming event";

  return (
    <section>
      <button
        onClick={() => setOpen(true)}
        className="card block w-full text-left bg-blue/10 border-blue/30 hover:bg-blue/20 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-ui font-semibold text-ink">vibe check</p>
            <p className="text-xs text-slate/70 mt-0.5">{subtitle}</p>
          </div>
          {pending.length > 0 && (
            <span className="shrink-0 rounded-full bg-rose text-cream text-xs font-ui font-semibold px-2 py-0.5">
              {pending.length}
            </span>
          )}
        </div>
      </button>

      {/* Hidden while the composer is up so only one overlay / Escape handler
          is live at a time; it reappears when the composer closes. */}
      <Modal open={open && !composerOpen} onClose={() => setOpen(false)} title="vibe check">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreate}
              className="text-xs font-ui font-semibold rounded-full px-3 py-1.5 btn-primary"
            >
              + new vibe
            </button>
          </div>

          {nothing && (
            <p className="text-sm text-ink/50">
              Plan a group fit for an upcoming event — invite friends and coordinate looks in
              one place.
            </p>
          )}

          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-ui text-slate/80">Invites</p>
              {pending.map((m) => (
                <VibeCard
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
                <VibeCard
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
                <VibeCard
                  key={m.id}
                  moment={m}
                  currentUserId={currentUserId}
                  onEdit={m.user_role === "collaborator" ? openEdit : undefined}
                  onChanged={handleChanged}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      <VibeComposer
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
