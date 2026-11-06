/**
 * Kiểm tra Lệnh Live THEO TIN TradingView (chỉ báo KN, tin có mã setup #…) — không cần MT5, không mở cổng.
 * Chạy: npx tsx scripts/test-kn.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kn-test-"));   // lưu orders.json vào thư mục tạm
// TUYỆT ĐỐI không đụng Mongo thật (.env gốc có MONGODB_URI): tắt hẳn đồng bộ Mongo trong bài test
const { mongo } = await import("../src/db/mongo.js");
Object.defineProperty(mongo, "configured", { get: () => false });
const { addSignal, ordersPayload } = await import("../src/orders/service.js");
const { parseKn } = await import("../src/orders/parse.js");

let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}${info ? " — " + info : ""}`);
};
const H = (id: number, side: "BUY" | "SELL") => `<b>KN 4A1</b> #${id} - ${side} : `;                 // mẫu mới: không còn (XAUUSD M5)
const SETUP = (id: number, side: "BUY" | "SELL", e: number, sl: number, tp: number) =>
  `<b>KN 4A1</b> #${id} — ${side === "BUY" ? "🟢 <b>BUY</b>" : "🔴 <b>SELL</b>"}\n🎯 Entry1=<b>${e}</b>\n🛑 SL=<b>${sl}</b>\nTP1=${tp}`;
const get = (n: number) => ordersPayload().orders.filter((o) => o.indi === "KN 4A1")[n]!;

// 1) Đọc tin
const s = parseKn(SETUP(29340111, "SELL", 4180.5, 4190, 4150));
check("đọc setup (mẫu mới, không symbol/khung)", !!s?.setup && s.setup.entry === 4180.5 && s.setup.sl === 4190 && s.setup.tp === 4150 && s.side === "SELL" && s.tf === "" && s.symbol === "XAUUSD", JSON.stringify(s));
const sOld = parseKn("<b>KN 4A1</b> #29340111 — <b>BUY</b> (XAUUSD M5)\nEntry1=4100\nSL=4090\nTP1=4140");   // mẫu cũ vẫn đọc được
check("đọc setup mẫu cũ có (XAUUSD M5)", sOld?.setup?.entry === 4100 && sOld.tf === "M5");
const ev = (txt: string) => parseKn(H(29340111, "SELL") + txt)?.event;
check("đọc Khớp Entry", ev("🎯 Khớp <b>Entry1</b> 4180.50")?.kind === "entry");
check("đọc mốc pip", JSON.stringify(ev("📈 Đạt mốc <b>+150 pip</b> 4165.50")) === '{"kind":"pip","pip":150,"price":4165.5}');
check("đọc THẮNG", JSON.stringify(ev("✅ Đạt Lợi nhuận 100 pip - THẮNG. Có thể dời SL hòa hoặc đóng một phần.")) === '{"kind":"win","pip":100}');
check("đọc TP", JSON.stringify(ev("✅ Đạt <b>TP</b> 4150.00")) === '{"kind":"tp","price":4150}');
check("đọc SL", JSON.stringify(ev("❌ Đóng lệnh tại <b>SL</b> 4190.00")) === '{"kind":"sl","price":4190}');
check("đọc Hủy (chỉ chữ Hủy)", JSON.stringify(ev("⛔ Hủy")) === '{"kind":"cancel"}');
check("đọc Hủy kiểu cũ có lý do vẫn nhận", ev("⛔ Hủy lệnh chờ — lý do: giá đã chạm Entry trong lúc chờ nến M15")?.kind === "cancel");
check("đọc Ẩn lệnh", ev("🙈 Ẩn lệnh")?.kind === "hide");
const hand = parseKn("<b>KN 4A1</b> - BUY - #29343005  : 🎯 Khớp <b>Entry1</b> 4180.50");   // dạng gõ tay
check("đọc dạng gõ tay 'KN 4A1 - BUY - #mã :'", hand?.event?.kind === "entry" && hand.side === "BUY" && hand.sid === "29343005" && hand.indi === "KN 4A1", JSON.stringify(hand));
check("tin cũ không mã → bỏ qua (null)", parseKn("BUY XAUUSD M15 — KN A1 : Entry=4280 SL=4270 TP=4290") === null && parseKn('{"side":"BUY"}') === null);

// 2) SELL: setup → khớp → +50 → +100 → THẮNG → TP
addSignal(SETUP(29340111, "SELL", 4180.5, 4190, 4150));
check("setup tạo lệnh chờ", get(0).state === "pending" && get(0).feed === "tv" && get(0).cur_pip === null);
check("setup gửi lại → bỏ qua", addSignal(SETUP(29340111, "SELL", 4180.5, 4190, 4150)).includes("bỏ qua") && ordersPayload().orders.length === 1);
addSignal(H(29340111, "SELL") + "🎯 Khớp <b>Entry1</b> 4180.50");
check("khớp Entry → đang chạy", get(0).state === "open" && get(0).filled[0] === true);
addSignal(H(29340111, "SELL") + "📈 Đạt mốc <b>+50 pip</b> 4175.50");
addSignal(H(29340111, "SELL") + "📈 Đạt mốc <b>+50 pip</b> 4175.50");   // trùng
addSignal(H(29340111, "SELL") + "✅ Đạt Lợi nhuận 100 pip - THẮNG. Có thể dời SL hòa hoặc đóng một phần.");
check("mốc 50 + THẮNG (không trùng)", JSON.stringify(get(0).ms) === "[50]" && get(0).win === true && get(0).state === "open" && get(0).pip100 === true);
addSignal(H(29340111, "SELL") + "📈 Đạt mốc <b>+150 pip</b> 4165.50");
addSignal(H(29340111, "SELL") + "✅ Đạt <b>TP</b> 4150.00");
check("TP → đóng thắng, pip = (4180.5-4150)/0.1", get(0).state === "closed" && get(0).result === "win" && get(0).close_pip === 305 && get(0).status === "TP", `${get(0).state}/${get(0).result}/${get(0).close_pip}`);
addSignal(H(29340111, "SELL") + "📈 Đạt mốc <b>+200 pip</b> 4160.50");   // tin muộn sau khi đóng
check("tin muộn sau khi đóng bị bỏ", JSON.stringify(get(0).ms) === "[50,150]");

// 3) BUY: tin đến LỘN thứ tự (Khớp + mốc + SL tới trước setup) → áp đúng sau khi có setup
addSignal(H(29340222, "BUY") + "❌ Đóng lệnh tại <b>SL</b> 4170.00");
addSignal(H(29340222, "BUY") + "📈 Đạt mốc <b>+50 pip</b> 4185.00");
addSignal(H(29340222, "BUY") + "🎯 Khớp <b>Entry1</b> 4180.00");
check("tin trước setup được giữ chờ", ordersPayload().orders.length === 1);
addSignal(SETUP(29340222, "BUY", 4180, 4170, 4220));
check("setup tới sau → áp Entry → mốc → SL", get(1).state === "closed" && get(1).result === "loss" && get(1).close_pip === -100 && JSON.stringify(get(1).ms) === "[50]",
  `${get(1).state}/${get(1).result}/${get(1).close_pip} · ${get(1).events.map((e) => e.code).join(">")}`);

// 4) Hủy (chỉ chữ Hủy, tới trước setup) + Hủy lệnh đã khớp thì bỏ qua
addSignal(H(29340333, "SELL") + "⛔ Hủy");
addSignal(SETUP(29340333, "SELL", 4200, 4210, 4170));
check("Hủy tới trước setup → lệnh hủy, hiện đúng chữ Hủy", get(2).state === "cancelled" && get(2).result === "cancel" && get(2).status_text === "⛔ Hủy", get(2).status_text);
addSignal(SETUP(29340444, "BUY", 4100, 4090, 4140));
addSignal(H(29340444, "BUY") + "🎯 Khớp <b>Entry1</b> 4100.00");
addSignal(H(29340444, "BUY") + "⛔ Hủy");
check("đã khớp thì tin Hủy không áp", get(3).state === "open");

// 5) THẮNG rồi Ẩn lệnh → thắng 100 pip; SL trước thắng → thua
addSignal(H(29340444, "BUY") + "✅ Đạt Lợi nhuận 100 pip - THẮNG. Có thể dời SL hòa hoặc đóng một phần.");
addSignal(H(29340444, "BUY") + "🙈 Ẩn lệnh");
check("THẮNG rồi Ẩn lệnh → đóng thắng +100", get(3).state === "closed" && get(3).result === "win" && get(3).close_pip === 100, `${get(3).state}/${get(3).result}/${get(3).close_pip}`);

// 6) Lệnh JSON kiểu cũ vẫn nhận (đi đường theo dõi bằng MT5)
addSignal('{"indi":"X","side":"BUY","entry":4280,"sl":4270,"tp":4295}');
const old = ordersPayload().orders.find((o) => o.indi === "X")!;
check("lệnh JSON cũ vẫn nhận, không đánh dấu feed", !!old && !old.feed && old.state === "pending");

// 7) ?test=1
addSignal(SETUP(29340555, "BUY", 4000, 3990, 4040), { test: true });
check("test=1 → lệnh test", get(4).test === true);

console.log(fail ? `\n❌ ${fail} lỗi` : "\n✅ Tất cả đạt");
process.exit(fail ? 1 : 0);
