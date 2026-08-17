"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import AddPieceForm from "@/components/closet/AddPieceForm";
import LogFitForm, { type LoggedFit } from "@/components/closet/LogFitForm";

function DressIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
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

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
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

type Mode = "choose" | "piece" | "fit";

// The closet tab's single add entry point (the dress icon). Both ways of
// putting something in the closet — one piece at a time, or a whole logged fit
// — used to be separate controls sitting side by side with nothing explaining
// the difference; now they're two labelled choices inside one sheet.
export default function AddToClosetModal({
  open,
  onClose,
  onFitSaved,
  onPieceSaved,
  initialMode = "choose",
}: {
  open: boolean;
  onClose: () => void;
  onFitSaved: (fit: LoggedFit) => void;
  onPieceSaved?: () => void;
  // Openers that already imply an answer (the "your fits show up here" empty
  // state) skip the chooser; the back link still leads to it.
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  function close() {
    setMode("choose");
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="add to closet" compact>
      {mode === "choose" && (
        <div className="space-y-2">
          <p className="text-xs text-ink/60 mb-3">What are you adding?</p>

          <ChoiceRow
            icon={<DressIcon />}
            title="a single piece"
            blurb="snap one item — we'll draft the details for you"
            onClick={() => setMode("piece")}
          />
          <ChoiceRow
            icon={<CameraIcon />}
            title="a whole fit"
            blurb="log what you wore and tag the pieces in it"
            onClick={() => setMode("fit")}
          />
        </div>
      )}

      {mode === "piece" && (
        <AddPieceForm onBack={() => setMode("choose")} onSaved={onPieceSaved} />
      )}

      {mode === "fit" && (
        <LogFitForm
          active={open}
          onBack={() => setMode("choose")}
          onSaved={(fit) => {
            onFitSaved(fit);
            setMode("choose");
          }}
        />
      )}
    </Modal>
  );
}

function ChoiceRow({
  icon,
  title,
  blurb,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left rounded-2xl border border-slate/20 bg-panel p-3 hover:border-ink/40 transition-colors"
    >
      <span className="shrink-0 w-10 h-10 rounded-full bg-blue/15 text-ink flex items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-ui font-semibold text-ink lowercase">{title}</span>
        <span className="block text-xs text-slate/80">{blurb}</span>
      </span>
      <span className="ml-auto text-slate shrink-0">→</span>
    </button>
  );
}
