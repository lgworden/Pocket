"use client";

import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import AddPieceForm from "@/components/closet/AddPieceForm";

// Full-page host for the single-piece flow. The flow itself lives in
// AddPieceForm, which the closet tab's "add to closet" sheet renders too — this
// page is the deep-linkable / standalone way in.
export default function AddItemClient() {
  const router = useRouter();

  return (
    <main className="px-4 pt-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-ui font-semibold text-slate tracking-wide">
            Add item
          </p>
          <h1 className="text-2xl mt-1">Snap piece</h1>
        </div>
        <button onClick={() => router.push("/closet")} className="text-sm text-slate">
          Done →
        </button>
      </header>

      <AddPieceForm />

      <BottomNav />
    </main>
  );
}
