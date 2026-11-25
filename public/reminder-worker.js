self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (
    typeof url === "string" &&
    /^https:\/\/programs\.sigchi\.org\/chi\/\d{4}\/program\/session\/\d+$/.test(
      url,
    )
  ) {
    event.waitUntil(self.clients.openWindow(url));
  }
});
