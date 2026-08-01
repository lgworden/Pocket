import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    // Case-insensitive, matching the unique index on lower(username) that
    // actually enforces this (migration 022) — an exact-match check would call
    // "Nora" available when "nora" already holds it.
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE lower(username) = lower($1)",
      [username]
    );

    return NextResponse.json({ available: rows.length === 0 });
  } catch (err) {
    console.error("Error checking username:", err);
    return NextResponse.json({ error: "Failed to check username" }, { status: 500 });
  }
}
