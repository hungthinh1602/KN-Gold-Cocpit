/**
 * Buồng Lái Vàng — server Node.js.
 * Phục vụ API (/api/*), webhook TradingView và giao diện React đã build (web/dist).
 */
import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { loginHandler, requireAuth } from "./auth/auth.js";
import { apiRouter } from "./routes/api.js";
import { marketRouter } from "./routes/market.js";
import { webhookRouter } from "./routes/webhook.js";
import { startMacro } from "./macro/service.js";
import { startOrders, webhookStatus } from "./orders/service.js";
import { startAiScan } from "./ai/service.js";

const app = express();
app.use(compression());                                        // nén gzip — dữ liệu nến nặng

app.use(webhookRouter);                                        // /webhook (khóa bằng token, trước lớp đăng nhập)
app.post("/login", express.urlencoded({ extended: false }), loginHandler);
app.use(requireAuth);                                          // mọi thứ sau đây cần đăng nhập
app.use("/api", marketRouter);
app.use("/api", apiRouter);

// Giao diện React (bản build). Khi dev, Vite chạy riêng ở cổng 5173 và proxy /api về đây.
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
app.use(express.static(webDist));
app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));

startMacro();
startOrders();
startAiScan();

// Có mật khẩu (VPS) → mở cho mọi IP; không có (máy dev) → chỉ máy này.
const isPublic = Boolean(config.webPassword());
app.listen(config.port, isPublic ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(`Buong Lai Vang (Node) chay tai http://localhost:${config.port}${isPublic ? " (mo Internet, co khoa)" : ""}`);
});

// Cổng 80 chỉ để nhận webhook TradingView (TradingView chỉ bắn 80/443).
if (isPublic && config.tvToken()) {
  const hook = express();
  hook.use(webhookRouter);
  hook.get("/", (_req, res) => res.json({ ok: true, service: "Buong Lai Vang webhook" }));
  hook.listen(config.webhookPort, "0.0.0.0")
    .on("listening", () => { webhookStatus.port80 = "ok"; })
    .on("error", (e) => { webhookStatus.port80 = `lỗi mở cổng ${config.webhookPort}: ${e.message}`; });
}
