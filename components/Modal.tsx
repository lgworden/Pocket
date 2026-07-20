"use client";

import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-t-3xl sm:rounded-2xl shadow-soft w-full sm:max-w-md max-h-[88vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display">{title}</h2>
          <button
            type="button"
            aria-label="close"
            onClick={onClose}
            className="text-slate/60 hover:text-ink text-2xl leading-none px-1"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
