import { requireOnboarded } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import BottomNav from "@/components/BottomNav";
import NotificationsList from "@/components/NotificationsList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireOnboarded();
  const notifications = await listNotifications(user.id);

  return (
    <main className="px-4 pt-6 pb-24 space-y-6">
      <header>
        <p className="text-xs font-ui font-semibold text-slate tracking-wide">Alerts</p>
        <h1 className="text-2xl mt-1">Notifications</h1>
      </header>

      <NotificationsList initialNotifications={notifications} />

      <BottomNav />
    </main>
  );
}
