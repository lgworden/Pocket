"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import LogFitComposer, { type LoggedFit } from "@/components/closet/LogFitComposer";
import FitDetailModal from "@/components/closet/FitDetailModal";

// Two top-level actions on the Closet tab — add to closet, log a fit — with
// curation (filters/category list, passed as children) in between and the
// recent-fits mood board pinned to the bottom.
export default function ClosetHub({
  initialFits,
  showMoodBoard,
  children,
}: {
  initialFits: LoggedFit[];
  showMoodBoard: boolean;
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
      <div className="grid grid-cols-2 gap-2">
        <Link href="/add-item" className="btn-primary text-center">
          + Add to closet
        </Link>
        <button type="button" className="btn-secondary" onClick={() => setComposerOpen(true)}>
          + Log a fit
        </button>
      </div>

      {children}

      {showMoodBoard && (
        <div className="space-y-3">
          <p className="text-xs font-ui font-semibold text-slate tracking-wide">
            Recent fits
          </p>
          {fits.length === 0 ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="card w-full aspect-[3/1] flex items-center justify-center text-sm text-slate/60 border border-dashed border-slate/30"
            >
              Snap today's fit to start your log
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {fits.map((fit) => (
                <button
                  key={fit.id}
                  type="button"
                  onClick={() => setSelectedId(fit.id)}
                  className="aspect-square rounded-xl overflow-hidden bg-slate/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fit.photo} alt="logged fit" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
