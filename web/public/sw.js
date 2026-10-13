// Service worker tối thiểu để trình duyệt cho "Cài đặt ứng dụng" (PWA).
// KHÔNG lưu cache: dữ liệu giá/lệnh luôn lấy mới từ server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Bấm vào thông báo hệ thống → mở lại tab web.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow("/"))));
});
