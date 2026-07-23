"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import LogFitComposer, { type LoggedFit } from "@/components/closet/LogFitComposer";
import FitDetailModal from "@/components/closet/FitDetailModal";

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <path
        d="M7 5.5 8 3.5h4l1 2h2.5A1.5 1.5 0 0 1 17 5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14V5a1.5 1.5 0 0 1 1.5-1.5H7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// Closet tab shell: icon-only add actions up top, a sticky vertical filter
// rail on the left (categoryNav), and a scrollable right pane that shows the
// recent-fits reel by default or the filtered item list (children) once a
// category is chosen.
export default function ClosetHub({
  initialFits,
  showMoodBoard,
  categoryNav,
  topBanner,
  children,
}: {
  initialFits: LoggedFit[];
  showMoodBoard: boolean;
  categoryNav: ReactNode;
  topBanner?: ReactNode;
  children: ReactNode;
}) {
  const [fits, setFits] = useState<LoggedFit[]>(initialFits);
  const [composerOpen, setComposerOpen] = useState(false);
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
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/add-item"
          aria-label="add to closet"
          className="icon-btn bg-ink text-cream"
        >
          <PlusIcon />
        </Link>
        <button
          type="button"
          aria-label="log a fit"
          onClick={() => setComposerOpen(true)}
          className="icon-btn bg-panel border border-slate/20 text-ink"
        >
          <CameraIcon />
        </button>
      </div>

      {topBanner}

      <div className="flex gap-3 items-start">
        <div className="w-[92px] shrink-0 sticky top-4 flex flex-col gap-1.5">
          {categoryNav}
        </div>

        <div className="flex-1 min-w-0">
          {showMoodBoard ? (
            <div className="space-y-2.5">
              <p className="text-xs font-ui font-semibold text-slate tracking-wide">
                Recent fits
              </p>
              {fits.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="card w-full aspect-[4/5] flex items-center justify-center text-sm text-slate/60 border border-dashed border-slate/30"
                >
                  Snap today's fit to start your log
                </button>
              ) : (
                <div className="max-h-[64vh] overflow-y-auto space-y-3 pr-0.5 -mr-0.5">
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

      <LogFitComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSaved={handleSaved}
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
