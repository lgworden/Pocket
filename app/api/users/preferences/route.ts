import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import { track } from "@/lib/analytics";

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      display_name,
      username,
      bio,
      location,
      home_address,
      scheduling_preferences,
      style_profile,
      notification_preferences,
      onboarding_completed,
      walkthrough_completed,
    } = await req.json();

    // Check username uniqueness if provided
    if (username) {
      const existing = await pool.query("SELECT id FROM users WHERE username = $1 AND id != $2", [
        username,
        userId,
      ]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
    }

    // The CTE captures each flag's pre-update value in the same statement as
    // the UPDATE, so the completion trackers below can fire only on a genuine
    // false -> true transition rather than on every PATCH that happens to
    // re-send `true` (e.g. a client retry).
    const query = `
      WITH prev AS (
        SELECT onboarding_completed, walkthrough_completed FROM users WHERE id = $14
      )
      UPDATE users
      SET
        display_name = COALESCE($1, display_name),
        username = COALESCE($2, username),
        bio = CASE WHEN $3::boolean THEN $4 ELSE bio END,
        location = CASE WHEN $5::boolean THEN $6 ELSE location END,
        home_address = CASE WHEN $7::boolean THEN $8 ELSE home_address END,
        scheduling_preferences = COALESCE($9, scheduling_preferences),
        style_profile = COALESCE($10, style_profile),
        notification_preferences = COALESCE($11, notification_preferences),
        onboarding_completed = COALESCE($12, users.onboarding_completed),
        walkthrough_completed = COALESCE($13, users.walkthrough_completed)
      FROM prev
      WHERE users.id = $14
      RETURNING users.id, display_name, username, bio, location, home_address, scheduling_preferences, style_profile,
                notification_preferences, users.onboarding_completed, users.walkthrough_completed,
                prev.onboarding_completed AS prev_onboarding_completed,
                prev.walkthrough_completed AS prev_walkthrough_completed
    `;

    const result = await pool.query(query, [
      display_name || null,
      username || null,
      bio !== undefined,
      bio ? bio.trim() || null : null,
      location !== undefined,
      location ? location.trim() || null : null,
      home_address !== undefined,
      home_address ? home_address.trim() || null : null,
      scheduling_preferences ? JSON.stringify(scheduling_preferences) : null,
      style_profile ? JSON.stringify(style_profile) : null,
      notification_preferences ? JSON.stringify(notification_preferences) : null,
      typeof onboarding_completed === "boolean" ? onboarding_completed : null,
      typeof walkthrough_completed === "boolean" ? walkthrough_completed : null,
      userId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { prev_onboarding_completed, prev_walkthrough_completed, ...user } = result.rows[0];

    if (typeof onboarding_completed === "boolean" && onboarding_completed && !prev_onboarding_completed) {
      track(userId, "onboarding_completed", {});
    }
    if (typeof walkthrough_completed === "boolean" && walkthrough_completed && !prev_walkthrough_completed) {
      track(userId, "walkthrough_completed", {});
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("Error updating preferences:", err);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
