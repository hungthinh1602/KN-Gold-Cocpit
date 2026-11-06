/**
 * Gửi 1 tin thử tới các nhóm Telegram đã cấu hình (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID…) để kiểm tra bot.
 * Chạy trên máy server: npx tsx scripts/telegram-hello.ts
 */
import { config } from "../src/config.js";
import { telegramEnabled, telegramSend, telegramStatus } from "../src/notify/telegram.js";

if (!telegramEnabled()) {
  console.log("❌ Chưa cấu hình: cần TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID (trong .env hoặc biến môi trường).");
  process.exit(1);
}
const chats = [...new Set([config.telegramChatId(), config.telegramAlertChatId()].join(",").split(",").map((x) => x.trim()).filter(Boolean))];
telegramSend("✅ Bot <b>Buồng Lái Vàng</b> đã kết nối — tín hiệu Lệnh Live sẽ được gửi vào đây.", chats);
for (let i = 0; i < 60 && telegramStatus.sent + telegramStatus.failed < chats.length; i++) await new Promise((r) => setTimeout(r, 500));
console.log(telegramStatus.failed ? `❌ Lỗi: ${telegramStatus.lastErr}` : `✅ Đã gửi tới ${chats.join(", ")}`);
process.exit(telegramStatus.failed ? 1 : 0);
