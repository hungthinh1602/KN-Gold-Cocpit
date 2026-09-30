/**
 * Cấu hình server — biến môi trường + các file khóa trong thư mục dữ liệu.
 *
 * Thư mục dữ liệu (DATA_DIR, mặc định server/data) chứa:
 *   web_password.txt     mật khẩu vào web (có file này → mở ra Internet + bắt đăng nhập)
 *   tv_webhook_token.txt token webhook TradingView
 *   ai_push_key.txt      khóa đẩy bài phân tích từ chat (header X-AI-Key)
 *   orders.json          lịch sử Lệnh Live
 *   ai_note.json         bài phân tích Claude viết
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(here, "../data"));
fs.mkdirSync(dataDir, { recursive: true });

/** Đọc dòng đầu của 1 file trong thư mục dữ liệu ("" nếu không có). Đọc mỗi lần gọi → đổi file không cần khởi động lại. */
export function readSecret(file: string): string {
  try {
    return fs.readFileSync(path.join(dataDir, file), "utf8").split(/\r?\n/)[0].trim();
  } catch {
    return "";
  }
}

export const config = {
  /** Cổng web (bản Python cũ đang dùng 8787 → bản mới dev chạy 8788 để chạy song song). */
  port: Number(process.env.PORT ?? 8788),
  /** Địa chỉ cầu nối MT5 (mt5-bridge/bridge.py). */
  bridgeUrl: process.env.BRIDGE_URL ?? "http://127.0.0.1:8790",
  /** Thời gian chờ tối đa mỗi lần gọi bridge (ms). */
  bridgeTimeoutMs: Number(process.env.BRIDGE_TIMEOUT_MS ?? 40_000),
  /** Mở thêm cổng 80 chỉ để nhận webhook TradingView (TradingView chỉ bắn 80/443). 0 = không mở. */
  webhookPort: Number(process.env.WEBHOOK_PORT ?? 80),
  dataDir,
  webPassword: () => process.env.GOLD_WEB_PASS?.trim() || readEnv("GOLD_WEB_PASS") || readSecret("web_password.txt"),
  tvToken: () => process.env.TV_WEBHOOK_TOKEN?.trim() || readEnv("TV_WEBHOOK_TOKEN") || readSecret("tv_webhook_token.txt"),
  aiPushKey: () => process.env.AI_PUSH_KEY?.trim() || readEnv("AI_PUSH_KEY") || readSecret("ai_push_key.txt"),
  /** MongoDB Atlas URI. Keep credentials out of tracked files. */
  mongoUri: () => process.env.MONGODB_URI?.trim() || readEnv("MONGODB_URI") || process.env.MONGO_URI?.trim() || readEnv("MONGO_URI"),
};

function readEnv(key: string): string {
  const files = new Set([
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "server/.env"),
    path.resolve(here, "../.env"),
    path.resolve(here, "../../.env"),
    path.resolve(here, "../../../.env"),
  ]);
  for (const file of files) {
    try {
      for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match?.[1] === key) return match[2].replace(/^['"]|['"]$/g, "").trim();
      }
    } catch { /* optional local env file */ }
  }
  return "";
}
