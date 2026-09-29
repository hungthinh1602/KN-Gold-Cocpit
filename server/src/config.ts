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
  webPassword: () => process.env.GOLD_WEB_PASS?.trim() || readSecret("web_password.txt"),
  tvToken: () => readSecret("tv_webhook_token.txt"),
  aiPushKey: () => readSecret("ai_push_key.txt"),
};
