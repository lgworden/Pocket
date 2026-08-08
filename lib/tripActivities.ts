// Shared, dependency-free list of trip activity chips. Lives apart from
// lib/packing.ts (which imports the db pool + auth) so the client bundle can use
// it without pulling server-only code in.
export const TRIP_ACTIVITIES = [
  { value: "beach_pool", label: "beach / pool" },
  { value: "sightseeing", label: "sightseeing" },
  { value: "gym_activewear", label: "gym / activewear" },
  { value: "hiking", label: "hiking / outdoors" },
  { value: "nightlife", label: "nightlife" },
  { value: "formal_dinner", label: "formal dinner" },
  { value: "wedding", label: "wedding" },
  { value: "work", label: "work / business" },
] as const;
