import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";

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

    const query = `
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
        onboarding_completed = COALESCE($12, onboarding_completed)
      WHERE id = $13
      RETURNING id, display_name, username, bio, location, home_address, scheduling_preferences, style_profile,
                notification_preferences, onboarding_completed
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
      userId,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating preferences:", err);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
