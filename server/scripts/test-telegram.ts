/**
 * Kiểm tra bot Telegram (notify/telegram.ts) bằng fetch giả — không gửi tin thật.
 * Chạy: npx tsx scripts/test-telegram.ts
 */
process.env.TELEGRAM_BOT_TOKEN = "TEST_TOKEN";
process.env.TELEGRAM_CHAT_ID = "-100111,-100222";
process.env.TELEGRAM_ALERT_CHAT_ID = "-100999";

const sent: { chat: string; text: string }[] = [];
let fail429 = 1;
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  const b = JSON.parse(init.body) as { chat_id: string; text: string };
  if (fail429-- > 0) return new Response(JSON.stringify({ ok: false, description: "Too Many Requests", parameters: { retry_after: 0 } }), { status: 429 });
  sent.push({ chat: b.chat_id, text: b.text });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as typeof fetch;

const { notifyOrders, primeOrderNotify, notifyAlertHit, telegramStatus } = await import("../src/notify/telegram.js");
const { orderEvent } = await import("../src/orders/engine.js");
type Order = import("../src/orders/types.js").Order;

const mk = (id: string, extra: Partial<Order> = {}): Order => ({
  id, indi: "KN", side: "BUY", tf: "M15", symbol: "XAUUSD", test: false, entries: [4280], filled: [false], sl: 4270, tps: [4300],
  pip: 0.1, recv_ts: Date.now() / 1000, state: "pending", fill_bar_t: null, last_t: null, tp_hit: 0, pip50: false, pip100: false,
  mfe: 0, mae: 0, cur_pip: null, result: null, close_pip: null, events: [], status: "", status_text: "", ...extra,
});

let ok = true;
const check = (name: string, cond: boolean, info = "") => { ok &&= cond; console.log(`${cond ? "✅" : "❌"} ${name}${info ? ` | ${info}` : ""}`); };
const waitIdle = async () => { for (let i = 0; i < 100 && (sent.length < expected); i++) await new Promise((r) => setTimeout(r, 100)); };
let expected = 0;

// lệnh cũ có sẵn lúc khởi động → không gửi lại
const old = mk("old"); orderEvent(old, "NEW", "⏳ Chờ khớp Entry");
const orders: Order[] = [old];
primeOrderNotify(orders);
notifyOrders(orders);

// lệnh mới + diễn biến
const o = mk("new1"); orderEvent(o, "NEW", "⏳ Chờ khớp Entry"); orders.push(o);
// lệnh test & lệnh MT5 cá nhân → không gửi
const t = mk("test1", { test: true }); orderEvent(t, "NEW", "⏳ Chờ khớp Entry"); orders.push(t);
const m = mk("mt5", { src: "mt5" }); orderEvent(m, "NEW", "Đặt lệnh"); orders.push(m);
notifyOrders(orders);
o.state = "closed"; o.result = "win"; o.close_pip = 200; orderEvent(o, "TP", "✅ Đạt TP - Đóng lệnh", 4300);
notifyOrders(orders);
notifyOrders(orders);                       // gọi lại không gửi trùng
notifyAlertHit({ price: 4321.5, hit: 4321.7, note: "đỉnh <cũ>", dir: "up" });

expected = 5;                               // 2 sự kiện × 2 nhóm + 1 cảnh báo
await waitIdle();
await new Promise((r) => setTimeout(r, 1500));

check("đủ 5 tin, không trùng", sent.length === 5, `đã gửi ${sent.length}`);
check("không gửi lệnh cũ / test / MT5", !sent.some((s) => /old|TEST|Đặt lệnh/.test(s.text)));
check("tin lệnh mới có Entry/SL/TP", sent[0]?.text.includes("Entry 4280.00 · SL 4270.00 · TP 4300.00") ?? false, sent[0]?.text.replace(/\n/g, " ⏎ "));
check("gửi cho cả 2 nhóm", new Set(sent.slice(0, 4).map((s) => s.chat)).size === 2);
check("tin TP có kết quả pip", sent.some((s) => s.text.includes("+200 pip")));
const alert = sent.find((s) => s.chat === "-100999");
check("cảnh báo giá vào nhóm riêng, đã escape HTML", Boolean(alert?.text.includes("đỉnh &lt;cũ&gt;")), alert?.text.replace(/\n/g, " ⏎ "));
check("tự thử lại sau 429", telegramStatus.sent === 5 && telegramStatus.failed === 0);
process.exit(ok ? 0 : 1);
