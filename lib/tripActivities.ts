// Shared, dependency-free list of trip activity chips. Lives apart from
// lib/packing.ts (which imports the db pool + auth) so the client bundle can use
// it without pulling server-only code in.
export const TRIP_ACTIVITIES = [
  { value: "beach_pool", label: "beach / pool", emoji: "🏖️" },
  { value: "sightseeing", label: "sightseeing", emoji: "🚶" },
  { value: "gym_activewear", label: "gym / activewear", emoji: "🏃" },
  { value: "hiking", label: "hiking / outdoors", emoji: "🥾" },
  { value: "nightlife", label: "nightlife", emoji: "🌃" },
  { value: "formal_dinner", label: "formal dinner", emoji: "🥂" },
  { value: "wedding", label: "wedding", emoji: "💍" },
  { value: "work", label: "work / business", emoji: "💼" },
] as const;
