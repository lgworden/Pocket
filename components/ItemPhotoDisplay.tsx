"use client";

import { useState } from "react";
import AddPhotoButton from "./AddPhotoButton";

export default function ItemPhotoDisplay({
  itemId,
  photos,
  itemName,
}: {
  itemId: string;
  photos: string[];
  itemName: string;
}) {
  const [photoList, setPhotoList] = useState(photos);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemovePhoto = async (photo: string) => {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${itemId}/photos?photo=${encodeURIComponent(photo)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove photo");
      setPhotoList(photoList.filter((p) => p !== photo));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      {photoList.length > 0 ? (
        <div className="space-y-2">
          {photoList.map((photo, idx) => (
            <div key={idx} className="relative group">
              <div className="polaroid">
                <div className="aspect-square bg-blue/10 rounded-xl overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`${itemName} photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePhoto(photo)}
                disabled={removing}
                className="absolute top-2 right-2 bg-rose/90 hover:bg-rose text-white rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="polaroid">
          <div className="aspect-square bg-blue/10 rounded-xl flex items-center justify-center">
            <AddPhotoButton itemId={itemId} />
          </div>
        </div>
      )}

      {error && (
        <div className="card bg-rose/10 border-rose/30 text-sm text-rose">{error}</div>
      )}
    </div>
  );
}
