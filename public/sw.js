// Push notification service worker. Registered from PushNotificationSetup.tsx.
// Scope is "/" (default for a file served from the public root), so it can
// receive pushes and handle clicks no matter which page sent the last request.

self.addEventListener("push", (event) => {
  let data = { title: "Pocket", body: "You have a new notification", link: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to the defaults above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.jpg",
      badge: "/icon.jpg",
      data: { link: data.link },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(link) && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "focus" in clients[0]) {
        clients[0].navigate(link);
        return clients[0].focus();
      }
      return self.clients.openWindow(link);
    })
  );
});
