import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { listNotifications, getUnreadCount } from "@/lib/notifications";

export async function GET() {
  const userId = await getCurrentUserId();
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(userId),
    getUnreadCount(userId),
  ]);
  return NextResponse.json({ notifications, unreadCount });
}
