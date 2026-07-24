import pool from "./db";

export type EventType =
  | "item_added"
  | "outfit_logged"
  | "recommendation_requested"
  | "packing_plan_generated"
  | "invite_accepted"
  | "friend_added"
  | "feed_post_created"
  | "onboarding_completed"
  | "walkthrough_completed";

// Fire-and-forget — never await this. Matches the existing
// analyzeUserBehavior(...) pattern used elsewhere in the app, but swallows its
// own errors so call sites don't each need their own .catch().
export function track(
  userId: string,
  eventType: EventType,
  metadata: Record<string, unknown> = {}
): void {
  pool
    .query(`INSERT INTO events (user_id, event_type, metadata) VALUES ($1, $2, $3)`, [
      userId,
      eventType,
      JSON.stringify(metadata),
    ])
    .catch((err) => console.error("[analytics] track failed:", eventType, err));
}
