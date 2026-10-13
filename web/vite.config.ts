import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: web chạy ở 5173, mọi /api chuyển về server Node (8788).
// 2 trang: index.html = buồng lái (cần đăng nhập) · landing.html = trang giới thiệu công khai (/gioi-thieu).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { input: { main: "index.html", landing: "landing.html" } },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8788" },
  },
});
