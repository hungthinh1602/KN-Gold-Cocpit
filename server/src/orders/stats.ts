/**
 * Thống kê hiệu suất tín hiệu (GET /api/stats): winrate, tổng pip, profit factor, sụt giảm lớn nhất,
 * chuỗi thắng/thua, đường pip cộng dồn, theo tháng, theo chỉ báo/setup, chiều, khung, phiên.
 * Hàm thuần — chỉ đọc danh sách lệnh, không đổi gì.
 */
import type { Order } from "./types.js";

const VN_OFFSET = 7 * 3600;                       // giờ VN = UTC+7, không đổi giờ mùa hè
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface StatsOptions { from?: number; includeMt5?: boolean }

export interface Bucket { key: string; trades: number; win: number; loss: number; winrate: number | null; pips: number; avg: number | null; pf: number | null }

export interface StatsResult {
  from: number;
  trades: number; win: number; loss: number; cancel: number; running: number;
  winrate: number | null; pips: number; avg: number | null;
  avgWin: number | null; avgLoss: number | null;
  pf: number | null;                              // profit factor; null = chưa có lệnh thua (∞) hoặc chưa có lệnh
  maxDd: number;                                  // sụt giảm lớn nhất (pip, số dương)
  bestStreak: number; worstStreak: number;        // chuỗi thắng / thua dài nhất
  curve: { t: number; pips: number }[];           // pip cộng dồn sau mỗi lệnh đóng (t = giờ đóng, epoch giây)
  months: Bucket[]; setups: Bucket[]; sides: Bucket[]; tfs: Bucket[]; sessions: Bucket[];
}

/** Giờ đóng lệnh = sự kiện cuối. */
export const closeTs = (o: Order) => o.events.at(-1)?.ts ?? o.recv_ts;

/** Pip kết quả của lệnh đã đóng (lệnh "ẩn" khi đã thắng dùng số pip thắng). */
export function resultPip(o: Order): number {
  if (o.close_pip != null) return o.close_pip;
  if (o.result === "win") return o.win_pip ?? 0;
  return 0;
}

const vnMonth = (ts: number) => new Date((ts + VN_OFFSET) * 1000).toISOString().slice(0, 7);   // "2026-11"
const vnHour = (ts: number) => new Date((ts + VN_OFFSET) * 1000).getUTCHours();
/** Phiên theo giờ VN lúc nhận lệnh: Á 05–14h · Âu 14–19h · Mỹ 19–05h. */
export const sessionOf = (ts: number) => { const h = vnHour(ts); return h >= 5 && h < 14 ? "Á" : h >= 14 && h < 19 ? "Âu" : "Mỹ"; };

function bucketize(list: Order[], keyOf: (o: Order) => string): Bucket[] {
  const m = new Map<string, Order[]>();
  for (const o of list) { const k = keyOf(o) || "—"; m.set(k, [...(m.get(k) ?? []), o]); }
  return [...m].map(([key, os]) => {
    const pip = os.map(resultPip);
    const win = os.filter((o) => o.result === "win").length;
    const gw = pip.filter((x) => x > 0).reduce((s, x) => s + x, 0);
    const gl = -pip.filter((x) => x < 0).reduce((s, x) => s + x, 0);
    const pips = pip.reduce((s, x) => s + x, 0);
    return { key, trades: os.length, win, loss: os.length - win, winrate: os.length ? Math.round((win * 100) / os.length) : null,
      pips: r1(pips), avg: os.length ? r1(pips / os.length) : null, pf: gl > 0 ? Math.round((gw / gl) * 100) / 100 : null };
  });
}

export function signalStats(all: Order[], opts: StatsOptions = {}): StatsResult {
  const from = opts.from ?? 0;
  const mine = all.filter((o) => !o.test && (opts.includeMt5 || o.src !== "mt5") && o.recv_ts >= from);
  const closed = mine.filter((o) => o.result === "win" || o.result === "loss").sort((a, b) => closeTs(a) - closeTs(b));
  const cancel = mine.filter((o) => o.result === "cancel").length;
  const running = mine.filter((o) => o.state === "pending" || o.state === "open").length;

  let cum = 0, peak = 0, maxDd = 0, streak = 0, bestStreak = 0, worstStreak = 0;
  const curve: StatsResult["curve"] = [];
  for (const o of closed) {
    cum += resultPip(o);
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
    curve.push({ t: closeTs(o), pips: r1(cum) });
    const w = o.result === "win";
    streak = w ? Math.max(1, streak + 1) : Math.min(-1, streak - 1);
    bestStreak = Math.max(bestStreak, streak);
    worstStreak = Math.max(worstStreak, -streak);
  }

  const wins = closed.filter((o) => o.result === "win").map(resultPip);
  const losses = closed.filter((o) => o.result === "loss").map(resultPip);
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const gw = sum(wins.filter((x) => x > 0));
  const gl = -sum([...wins, ...losses].filter((x) => x < 0));
  const total = sum([...wins, ...losses]);

  const byKey = (k: (o: Order) => string, order?: string[]) => {
    const b = bucketize(closed, k);
    return order ? b.sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key)) : b.sort((x, y) => y.trades - x.trades || y.pips - x.pips);
  };

  return {
    from, trades: closed.length, win: wins.length, loss: losses.length, cancel, running,
    winrate: closed.length ? Math.round((wins.length * 100) / closed.length) : null,
    pips: r1(total), avg: closed.length ? r1(total / closed.length) : null,
    avgWin: wins.length ? r1(sum(wins) / wins.length) : null,
    avgLoss: losses.length ? r1(sum(losses) / losses.length) : null,
    pf: gl > 0 ? Math.round((gw / gl) * 100) / 100 : null,
    maxDd: r1(maxDd), bestStreak, worstStreak, curve,
    months: bucketize(closed, (o) => vnMonth(closeTs(o))).sort((a, b) => b.key.localeCompare(a.key)),
    setups: byKey((o) => o.indi),
    sides: byKey((o) => o.side, ["BUY", "SELL"]),
    tfs: byKey((o) => o.tf),
    sessions: byKey((o) => sessionOf(o.recv_ts), ["Á", "Âu", "Mỹ"]),
  };
}
