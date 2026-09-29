/**
 * Kiểm tra bộ theo dõi lệnh (orders/engine.ts) bằng nến giả lập — cùng kịch bản đã dùng
 * để kiểm tra bản Python. Chạy: npx tsx scripts/test-engine.ts
 */
import { orderStep } from "../src/orders/engine.js";
import { parseSignal } from "../src/orders/parse.js";
import type { Order } from "../src/orders/types.js";

function mk(raw: string): Order {
  const s = parseSignal(raw);
  return {
    id: "t", indi: s.indi, side: s.side!, tf: s.tf, symbol: s.symbol, test: true, entries: s.entries,
    filled: s.entries.map(() => false), sl: s.sl, tps: s.tps, pip: s.pip, recv_ts: 0, state: "pending",
    fill_bar_t: null, last_t: null, tp_hit: 0, pip50: false, pip100: false, mfe: 0, mae: 0, cur_pip: null,
    result: null, close_pip: null, events: [], status: "", status_text: "",
  };
}

function run(name: string, raw: string, bars: [number, number][], expect: string) {
  const o = mk(raw);
  bars.forEach(([h, l], i) => orderStep(o, 1000 + 60 * i, h, l));
  const got = `${o.state}/${o.result}/${o.close_pip}`;
  console.log(`${got === expect ? "✅" : "❌"} ${name}: ${got} (mong đợi ${expect}) | ${o.events.map((e) => e.text).join(" > ")}`);
}

run("BUY khớp → 50/100 pip → TP", '{"indi":"KN","side":"BUY","entry":4280,"sl":4270,"tp":4295}',
  [[4281, 4279], [4286, 4281], [4291, 4284], [4296, 4290]], "closed/win/150");
run("SELL dính SL (chữ tự do)", "SELL XAUUSD M15 — KN B2 : Entry=4300 SL=4310 TP=4280",
  [[4299, 4295], [4301, 4296], [4305, 4298], [4311, 4300]], "closed/loss/-100");
run("Chạm TP trước khi khớp → hủy", '{"indi":"KN C","side":"BUY","entry":4270,"sl":4260,"tp":4290}',
  [[4285, 4275], [4291, 4280]], "cancelled/cancel/null");
run("Nến chạm cả SL lẫn TP → SL", '{"indi":"KN E","side":"BUY","entry":4280,"sl":4275,"tp":4290}',
  [[4281, 4279], [4291, 4274]], "closed/loss/-50");
try {
  parseSignal("hello");
  console.log("❌ tin rác phải báo lỗi");
} catch (e) {
  console.log(`✅ Tin rác bị từ chối: ${(e as Error).message}`);
}
