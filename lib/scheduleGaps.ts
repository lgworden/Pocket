import { getTravelMinutes } from "./googleMaps";
import type { CalendarEventDetail } from "./googleCalendar";

// Rough time to actually swap an outfit once home — not just walk in the door.
const CHANGE_BUFFER_MINUTES = 15;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Flags consecutive timed events where there isn't enough gap to travel home,
// change, and get to the next one — so the recommendation can propose a
// single outfit that works across both instead of assuming a wardrobe change.
// Degrades to an empty list (no constraint) whenever it can't be computed:
// no home address on file, an event is missing a location, or Maps is
// unavailable — this is a nice-to-have signal, never a blocker.
export async function detectTightTransitions(
  events: CalendarEventDetail[],
  homeAddress: string | null
): Promise<string[]> {
  if (!homeAddress) return [];

  const timed = events.filter((e) => e.start && e.end && e.location);
  const notes: string[] = [];

  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i];
    const b = timed[i + 1];
    const gapMinutes = (new Date(b.start!).getTime() - new Date(a.end!).getTime()) / 60000;
    if (gapMinutes <= 0) continue; // overlapping/back-to-back with literally no gap

    const [toHome, fromHome] = await Promise.all([
      getTravelMinutes(a.location!, homeAddress),
      getTravelMinutes(homeAddress, b.location!),
    ]);
    if (toHome === null || fromHome === null) continue; // can't assess — skip quietly

    const neededMinutes = toHome + fromHome + CHANGE_BUFFER_MINUTES;
    if (gapMinutes < neededMinutes) {
      notes.push(
        `"${a.summary}" (ends ${formatTime(a.end!)}) and "${b.summary}" (starts ${formatTime(
          b.start!
        )}) are back-to-back with only ~${Math.round(gapMinutes)} min between them — not enough ` +
          `time to go home and change. Pick one outfit that works for both.`
      );
    }
  }

  return notes;
}
