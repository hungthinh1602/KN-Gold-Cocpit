import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";
import "./styles/macro.css";
import "./styles/ai.css";
import "./styles/orders.css";

// Service worker cho "Cài đặt ứng dụng" + thông báo hệ thống — trình duyệt chỉ cho khi HTTPS hoặc localhost.
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
