"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Soft-deletes the item (status -> archived) so wear history / cost-per-wear
// stats stay intact. Inline confirm rather than a bare destructive tap.
export default function RemoveItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove that item — try again?");
      router.push("/closet");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRemoving(false);
    }
  }

  if (confirming) {
    return (
      <div className="card space-y-3">
        <p className="text-sm text-ink/70">Remove {itemName} from your closet?</p>
        {error && <p className="text-sm text-rose">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={removing}
            className="btn-secondary flex-1 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex-1 rounded-full px-4 py-2 text-sm font-ui font-semibold bg-rose text-cream disabled:opacity-50"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-sm text-rose">
      Remove from closet
    </button>
  );
}
