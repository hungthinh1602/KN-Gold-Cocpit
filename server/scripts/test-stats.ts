/**
 * Kiểm tra thống kê hiệu suất (orders/stats.ts) trên bộ lệnh giả lập.
 * Chạy: npx tsx scripts/test-stats.ts
 */
import { signalStats } from "../src/orders/stats.js";
import type { Order } from "../src/orders/types.js";

const H = 3600, D = 86400;
const t0 = Date.UTC(2026, 9, 30, 2, 0) / 1000;   // 30/10/2026 09:00 giờ VN (phiên Á)
let n = 0;
const mk = (recv: number, result: Order["result"], pip: number | null, extra: Partial<Order> = {}): Order => ({
  id: `o${n++}`, indi: "KN A", side: "BUY", tf: "M15", symbol: "XAUUSD", test: false, entries: [4000], filled: [true], sl: 3990, tps: [4020],
  pip: 0.1, recv_ts: recv, state: result ? (result === "cancel" ? "cancelled" : "closed") : "open", fill_bar_t: null, last_t: null, tp_hit: 0,
  pip50: false, pip100: false, mfe: 0, mae: 0, cur_pip: null, result, close_pip: pip,
  events: [{ ts: recv + H, code: "X", text: "", price: null }], status: "", status_text: "", ...extra,
});

const orders: Order[] = [
  mk(t0, "win", 200),                                       // +200  → 200
  mk(t0 + D, "loss", -100, { side: "SELL" }),               // -100  → 100
  mk(t0 + 2 * D, "loss", -100, { indi: "KN B" }),           // -100  → 0      (sụt 200)
  mk(t0 + 3 * D + 8 * H, "win", 150, { tf: "H1" }),          // +150  → 150   (phiên Âu: 17h VN)
  mk(t0 + 4 * D, "win", null, { win_pip: 100 }),            // lệnh ẩn khi đã thắng → +100 → 250
  mk(t0 + 5 * D, "cancel", null),
  mk(t0 + 6 * D, null, null),                               // đang chạy
  mk(t0 + 6 * D, "win", 500, { test: true }),               // lệnh test → bỏ
  mk(t0 + 6 * D, "win", 500, { src: "mt5" }),               // lệnh MT5 cá nhân → bỏ (mặc định)
];

const s = signalStats(orders);
let ok = true;
const eq = (name: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  ok &&= pass;
  console.log(`${pass ? "✅" : "❌"} ${name}: ${JSON.stringify(got)}${pass ? "" : ` (mong đợi ${JSON.stringify(want)})`}`);
};
eq("số lệnh đóng / thắng / thua / hủy / chạy", [s.trades, s.win, s.loss, s.cancel, s.running], [5, 3, 2, 1, 1]);
eq("winrate, tổng pip, pip TB", [s.winrate, s.pips, s.avg], [60, 250, 50]);
eq("profit factor = 450/200", s.pf, 2.25);
eq("sụt giảm lớn nhất", s.maxDd, 200);
eq("chuỗi thắng / thua dài nhất", [s.bestStreak, s.worstStreak], [2, 2]);
eq("đường pip cộng dồn", s.curve.map((p) => p.pips), [200, 100, 0, 150, 250]);
eq("theo chiều", s.sides.map((b) => [b.key, b.trades, b.pips]), [["BUY", 4, 350], ["SELL", 1, -100]]);
eq("theo setup", s.setups.map((b) => [b.key, b.trades, b.winrate]), [["KN A", 4, 75], ["KN B", 1, 0]]);
eq("theo phiên", s.sessions.map((b) => [b.key, b.trades]), [["Á", 4], ["Âu", 1]]);
eq("theo tháng (mới trước)", s.months.map((b) => [b.key, b.trades, b.pips]), [["2026-11", 3, 150], ["2026-10", 2, 100]]);
eq("gồm MT5 khi mt5=1", signalStats(orders, { includeMt5: true }).trades, 6);
eq("lọc theo kỳ", signalStats(orders, { from: t0 + 3 * D }).trades, 2);
eq("chưa có lệnh", [signalStats([]).winrate, signalStats([]).pf, signalStats([]).curve.length], [null, null, 0]);
process.exit(ok ? 0 : 1);
