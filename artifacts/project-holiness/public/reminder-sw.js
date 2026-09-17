self.addEventListener("push", event => {
  let data = { title: "Project Holiness", body: "Take a few minutes to record the practices you have completed" };
  try { data = event.data?.json() || data; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.svg", badge: "/favicon.svg" }));
});
self.addEventListener("notificationclick", event => { event.notification.close(); event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => { const existing = list.find(c => "focus" in c); return existing ? existing.focus() : clients.openWindow("/leader-standard-work"); })); });
