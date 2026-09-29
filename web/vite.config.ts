import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: web chạy ở 5173, mọi /api chuyển về server Node (8788).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8788" },
  },
});
