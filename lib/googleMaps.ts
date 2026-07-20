// Google Distance Matrix — travel time between two addresses/place strings.
// Takes addresses directly (no separate geocoding step needed).

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

type DistanceMatrixResponse = {
  status: string;
  rows: { elements: { status: string; duration?: { value: number } }[] }[];
};

// Returns null (rather than throwing) whenever a time can't be determined —
// missing key, unmatched address, network hiccup — so callers can just skip
// the schedule-conflict check instead of failing the whole recommendation.
export async function getTravelMinutes(
  origin: string,
  destination: string
): Promise<number | null> {
  if (!API_KEY || !origin.trim() || !destination.trim()) return null;

  const params = new URLSearchParams({
    origins: origin,
    destinations: destination,
    mode: "driving",
    key: API_KEY,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
    );
    if (!res.ok) return null;
    const data: DistanceMatrixResponse = await res.json();
    if (data.status !== "OK") return null;

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== "OK" || !element.duration) return null;

    return Math.round(element.duration.value / 60);
  } catch {
    return null;
  }
}
