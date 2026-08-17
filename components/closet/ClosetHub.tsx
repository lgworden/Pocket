"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LoggedFit } from "@/components/closet/LogFitForm";
import AddToClosetModal from "@/components/closet/AddToClosetModal";
import FitDetailModal from "@/components/closet/FitDetailModal";

function DressIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path d="M7.3 3.2 8.3 6.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.7 3.2 11.7 6.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M8.3 6.3Q10 8 11.7 6.3L12.6 9.8 15.3 16.8H4.7L7.4 9.8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Closet tab shell: one icon-only add action up top (the dress button, which
// opens the combined "add to closet" sheet — a piece or a whole fit), a sticky
// vertical filter rail on the left (categoryNav), and a scrollable right pane
// that shows the recent-fits reel by default or the filtered item list
// (children) once a category is chosen.
export default function ClosetHub({
  initialFits,
  showMoodBoard,
  categoryNav,
  intro,
  children,
}: {
  initialFits: LoggedFit[];
  showMoodBoard: boolean;
  categoryNav: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [fits, setFits] = useState<LoggedFit[]>(initialFits);
  const [composerOpen, setComposerOpen] = useState(false);
  // Which branch the sheet lands on: the toolbar button asks, the empty fits
  // field already knows.
  const [composerMode, setComposerMode] = useState<"choose" | "fit">("choose");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = fits.find((f) => f.id === selectedId) ?? null;

  function handleSaved(fit: LoggedFit) {
    setFits((prev) => [fit, ...prev]);
    setComposerOpen(false);
  }

  function handleShared(id: string) {
    setFits((prev) => prev.map((f) => (f.id === id ? { ...f, shared_to_feed: true } : f)));
  }

  function handleDeleted(id: string) {
    setFits((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {intro && <div className="flex-1">{intro}</div>}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="add to closet"
            onClick={() => {
              setComposerMode("choose");
              setComposerOpen(true);
            }}
            className="icon-btn bg-panel border border-slate/20 text-ink"
          >
            <DressIcon />
          </button>
        </div>
      </div>

      <div className="flex gap-3 items-start">
        <div className="w-[92px] shrink-0 sticky top-4 flex flex-col gap-4 items-start">
          {categoryNav}
        </div>

        <div className="flex-1 min-w-0">
          {showMoodBoard ? (
            <div className="space-y-2.5">
              <p className="text-xs font-ui font-semibold text-slate tracking-wide">
                Recent fits
              </p>
              {fits.length === 0 ? (
                // Empty state is a tall color field, not a bordered card — as fits
                // get posted their photos fill it in from the top.
                <button
                  type="button"
                  onClick={() => {
                    setComposerMode("fit");
                    setComposerOpen(true);
                  }}
                  className="w-full min-h-[70vh] rounded-3xl bg-pink flex items-end justify-center p-6 text-sm text-brown/70"
                >
                  your fits show up here
                </button>
              ) : (
                <div className="max-h-[72vh] overflow-y-auto space-y-3 pr-0.5 -mr-0.5">
                  {fits.map((fit) => (
                    <button
                      key={fit.id}
                      type="button"
                      onClick={() => setSelectedId(fit.id)}
                      className="block w-full rounded-3xl overflow-hidden bg-slate/10 shadow-soft-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fit.photo}
                        alt="logged fit"
                        className="w-full aspect-[4/5] object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </div>

      <AddToClosetModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialMode={composerMode}
        onFitSaved={handleSaved}
        // Items are server-rendered (category counts, lists), so a saved piece
        // needs the route re-fetched rather than local state patched.
        onPieceSaved={() => router.refresh()}
      />
      <FitDetailModal
        fit={selected}
        onClose={() => setSelectedId(null)}
        onShared={handleShared}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
