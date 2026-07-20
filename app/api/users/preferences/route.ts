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
      bio,
      home_address,
      scheduling_preferences,
      style_profile,
      notification_preferences,
      onboarding_completed,
    } = await req.json();

    const query = `
      UPDATE users
      SET
        display_name = COALESCE($1, display_name),
        bio = CASE WHEN $2::boolean THEN $3 ELSE bio END,
        home_address = CASE WHEN $4::boolean THEN $5 ELSE home_address END,
        scheduling_preferences = COALESCE($6, scheduling_preferences),
        style_profile = COALESCE($7, style_profile),
        notification_preferences = COALESCE($8, notification_preferences),
        onboarding_completed = COALESCE($9, onboarding_completed)
      WHERE id = $10
      RETURNING id, display_name, bio, home_address, scheduling_preferences, style_profile,
                notification_preferences, onboarding_completed
    `;

    const result = await pool.query(query, [
      display_name || null,
      bio !== undefined,
      bio ? bio.trim() || null : null,
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
