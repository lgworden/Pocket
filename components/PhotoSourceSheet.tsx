"use client";

import Modal from "./Modal";

// Native-only sub-choice for the "album" action. @capacitor/camera has no
// "Files" source (only Camera/Photos/Prompt), so this sheet is the app-level
// way to offer a Files option there: "Library" hits the native Camera plugin's
// clean Photos-only picker, "Choose file" falls back to the plain <input
// type="file"> that the WebView already routes to the OS document picker.
// Web is unaffected — callers only open this when isNativePlatform() is true.
export default function PhotoSourceSheet({
  open,
  onClose,
  onChooseLibrary,
  onChooseFile,
}: {
  open: boolean;
  onClose: () => void;
  onChooseLibrary: () => void;
  onChooseFile: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add a photo" compact>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            onClose();
            onChooseLibrary();
          }}
          className="w-full text-left rounded-xl px-3 py-2.5 border border-slate/20 hover:border-slate/40 transition-colors text-sm font-medium"
        >
          Photo library
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onChooseFile();
          }}
          className="w-full text-left rounded-xl px-3 py-2.5 border border-slate/20 hover:border-slate/40 transition-colors text-sm font-medium"
        >
          Choose file
        </button>
      </div>
    </Modal>
  );
}
