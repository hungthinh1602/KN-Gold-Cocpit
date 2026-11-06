/**
 * Bot Telegram: gửi tín hiệu Lệnh Live + diễn biến lệnh (khớp, đạt pip, TP, SL, hủy) và cảnh báo giá đã chạm.
 *
 * Cấu hình (biến môi trường / .env, hoặc file trong DATA_DIR):
 *   TELEGRAM_BOT_TOKEN       token bot từ @BotFather          (file telegram_bot_token.txt)
 *   TELEGRAM_CHAT_ID         nhóm/kênh nhận tín hiệu, nhiều nơi cách nhau dấu phẩy (vd nhóm VIP)
 *   TELEGRAM_ALERT_CHAT_ID   nơi nhận cảnh báo giá (mặc định = TELEGRAM_CHAT_ID)
 *   TELEGRAM_SEND_TEST=1     gửi cả lệnh test (?test=1), có nhãn [TEST]
 * Chưa có token hoặc chat → không gửi gì.
 *
 * Chỉ gửi tín hiệu TradingView (không gửi lệnh MT5 cá nhân). Gửi tuần tự, cách nhau ~1,1 giây,
 * tự chờ lại khi Telegram báo 429 → không bị khóa vì gửi quá nhanh.
 */
import { config } from "../config.js";
import type { Order, OrderEvent } from "../orders/types.js";

const GAP_MS = 1100;                 // Telegram: ~20 tin/phút cho mỗi nhóm → giữ dưới mức này
const MAX_QUEUE = 200;
const MAX_TRIES = 4;
const EVENT_MAX_AGE_SEC = 15 * 60;   // sự kiện cũ hơn mức này không gửi (phòng gửi dồn sau khi khởi động lại)

interface Job { chat: string; text: string; tries: number }

export const telegramStatus: { enabled: boolean; sent: number; failed: number; lastErr: string | null; lastOk: number | null } =
  { enabled: false, sent: 0, failed: 0, lastErr: null, lastOk: null };

const queue: Job[] = [];
let busy = false;

const splitChats = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const signalChats = () => splitChats(config.telegramChatId());
const alertChats = () => { const a = splitChats(config.telegramAlertChatId()); return a.length ? a : signalChats(); };

export const telegramEnabled = () => Boolean(config.telegramToken()) && signalChats().length > 0;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (x: number) => x.toFixed(2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendNow(job: Job): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${config.telegramToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: job.chat, text: job.text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { description?: string; parameters?: { retry_after?: number } };
  const err = new Error(`Telegram ${res.status}: ${body.description ?? res.statusText}`) as Error & { retryAfter?: number; fatal?: boolean };
  if (res.status === 429) err.retryAfter = body.parameters?.retry_after ?? 5;
  else if (res.status >= 400 && res.status < 500) err.fatal = true;      // sai token / chat → thử lại vô ích
  throw err;
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const job = queue[0];
      try {
        await sendNow(job);
        queue.shift();
        telegramStatus.sent++;
        telegramStatus.lastOk = Date.now() / 1000;
        telegramStatus.lastErr = null;
      } catch (e) {
        const err = e as Error & { retryAfter?: number; fatal?: boolean };
        telegramStatus.lastErr = err.message;
        job.tries++;
        if (err.fatal || job.tries >= MAX_TRIES) {
          queue.shift();
          telegramStatus.failed++;
          console.warn(`[telegram] bỏ tin: ${err.message}`);
        } else {
          await sleep((err.retryAfter ?? 2 ** job.tries) * 1000);
          continue;
        }
      }
      await sleep(GAP_MS);
    }
  } finally {
    busy = false;
  }
}

/** Xếp 1 tin vào hàng gửi (HTML của Telegram). */
export function telegramSend(text: string, chats: string[] = signalChats()) {
  if (!config.telegramToken()) return;
  for (const chat of chats) {
    if (queue.length >= MAX_QUEUE) { telegramStatus.failed++; telegramStatus.lastErr = "hàng gửi đầy — bỏ bớt tin"; return; }
    queue.push({ chat, text, tries: 0 });
  }
  void pump();
}

// ─────────────────────────────  định dạng tin  ─────────────────────────────

function header(o: Order): string {
  const side = o.side === "BUY" ? "🟢 BUY" : "🔴 SELL";
  const bits = [o.symbol || "XAUUSD", o.tf, o.indi].filter(Boolean).map((x) => esc(String(x)));
  return `${o.test ? "[TEST] " : ""}<b>${side}</b> ${bits.join(" · ")}`;
}

function levels(o: Order): string {
  const parts: string[] = [];
  if (o.entries.length) parts.push(`Entry ${o.entries.map(f2).join(" / ")}`);
  if (o.sl != null) parts.push(`SL ${f2(o.sl)}`);
  if (o.tps.length) parts.push(`TP ${o.tps.map(f2).join(" / ")}`);
  return parts.join(" · ");
}

/** Nội dung 1 tin cho 1 sự kiện của lệnh. */
export function formatOrderEvent(o: Order, ev: OrderEvent): string {
  const lines = [header(o), esc(ev.text)];
  if (ev.code === "NEW") {
    const lv = levels(o);
    if (lv) lines.push(lv);
  } else if (ev.code === "TP" || ev.code === "SL" || ev.code === "HIDE" || ev.code === "CLOSE") {
    if (o.close_pip != null) lines.push(`Kết quả: <b>${o.close_pip >= 0 ? "+" : ""}${o.close_pip} pip</b>`);
  }
  if (ev.code !== "NEW" && o.entries.length) lines.push(`<i>Entry ${f2(o.entries[0])}</i>`);
  return lines.join("\n");
}

// ─────────────────────────────  theo dõi lệnh  ─────────────────────────────

const seen = new Map<string, number>();   // id lệnh → số sự kiện đã xử lý

const eligible = (o: Order) => o.src !== "mt5" && (!o.test || config.telegramSendTest());

/** Đánh dấu mọi sự kiện hiện có là đã xử lý (gọi khi khởi động / sau khi nạp lệnh từ MongoDB). */
export function primeOrderNotify(orders: Order[]) {
  seen.clear();
  for (const o of orders) seen.set(o.id, o.events.length);
}

/** Gửi các sự kiện mới phát sinh kể từ lần gọi trước. Gọi mỗi lần lưu lệnh. */
export function notifyOrders(orders: Order[]) {
  telegramStatus.enabled = telegramEnabled();
  const now = Date.now() / 1000;
  for (const o of orders) {
    const from = seen.get(o.id) ?? 0;
    if (from >= o.events.length) continue;
    seen.set(o.id, o.events.length);
    if (!telegramStatus.enabled || !eligible(o)) continue;
    for (const ev of o.events.slice(from)) {
      if (now - ev.ts > EVENT_MAX_AGE_SEC) continue;
      telegramSend(formatOrderEvent(o, ev));
    }
  }
}

/** Cảnh báo giá đã chạm. */
export function notifyAlertHit(hit: { price: number; hit: number; note: string; dir: "up" | "down" }) {
  if (!config.telegramToken() || !alertChats().length) return;
  const arrow = hit.dir === "up" ? "⬆️" : "⬇️";
  const note = hit.note ? `\n${esc(hit.note)}` : "";
  telegramSend(`🔔 <b>Cảnh báo giá</b> ${arrow} chạm ${f2(hit.price)} (giá ${f2(hit.hit)})${note}`, alertChats());
}
