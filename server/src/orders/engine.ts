/**
 * Bộ theo dõi lệnh theo từng nến M1 (giá MT5).
 * Luật: 1 pip = 0.1 · mốc 50/100 pip tính từ Entry1 · không xét TP/SL cùng nến khớp Entry ·
 * nến chạm cả SL lẫn TP → tính SL · chưa khớp mà chạm TP → Hủy ·
 * THẮNG = đạt TP hoặc +100 pip trước SL.
 */
import { PIP_SIZE, type Order } from "./types.js";

const r1 = (x: number) => Math.round(x * 10) / 10;
const f2 = (x: number) => x.toFixed(2);

export function orderEvent(o: Order, code: string, text: string, price: number | null = null) {
  o.events.push({ ts: Date.now() / 1000, code, text, price });
  o.status = code;
  o.status_text = text;
}

/** Giá vào trung bình của các Entry đã khớp. */
export function avgEntry(o: Order): number | null {
  const f = o.entries.filter((_, i) => o.filled[i]);
  return f.length ? f.reduce((s, x) => s + x, 0) / f.length : null;
}

/** Lệnh TradingView: xử lý 1 nến M1 (t = giờ server MT5). Trả true nếu trạng thái đổi. */
export function orderStep(o: Order, t: number, hi: number, lo: number): boolean {
  const buy = o.side === "BUY";
  const sgn = buy ? 1 : -1;
  const pip = o.pip || PIP_SIZE;
  let ch = false;
  // 1) khớp Entry
  o.entries.forEach((e, i) => {
    if (!o.filled[i] && lo <= e && e <= hi) {
      o.filled[i] = true;
      if (o.state === "pending") {
        o.state = "open";
        o.fill_bar_t = t;
      }
      const lbl = o.entries.length > 1 ? `Entry${i + 1}` : "Entry";
      orderEvent(o, `ENTRY${i + 1}`, `🎯 Khớp ${lbl} ${f2(e)}`, e);
      ch = true;
    }
  });
  if (o.state === "pending") {
    const tp1 = o.tps[0];
    if ((buy && hi >= tp1) || (!buy && lo <= tp1)) {
      o.state = "cancelled";
      o.result = "cancel";
      orderEvent(o, "CANCEL", "⛔ Hủy: chạm TP1 trước khi khớp Entry");
      return true;
    }
    return ch;
  }
  if (o.state !== "open" || t === o.fill_bar_t) return ch;   // không xét TP/SL cùng nến khớp Entry
  const e1 = o.entries[0] ?? avgEntry(o)!;
  const fav = (buy ? hi - e1 : e1 - lo) / pip;
  const adv = (buy ? e1 - lo : hi - e1) / pip;
  o.mae = r1(Math.max(o.mae, adv));
  const avg = avgEntry(o)!;
  // 2) SL trước (thận trọng)
  if ((buy && lo <= o.sl!) || (!buy && hi >= o.sl!)) {
    o.state = "closed";
    o.result = o.tp_hit || o.pip100 ? "win" : "loss";
    o.close_pip = r1(((o.sl! - avg) * sgn) / pip);
    orderEvent(o, "SL", "❌ Dính SL - Đóng lệnh", o.sl);
    return true;
  }
  // 3) mốc lời 50 / 100 pip
  o.mfe = r1(Math.max(o.mfe, fav));
  if (!o.pip50 && fav >= 50) { o.pip50 = true; orderEvent(o, "PIP50", "💰 Đạt +50 pip"); ch = true; }
  if (!o.pip100 && fav >= 100) { o.pip100 = true; orderEvent(o, "PIP100", "🏆 Đạt +100 pip (thắng)"); ch = true; }
  // 4) TP
  while (o.tp_hit < o.tps.length) {
    const tp = o.tps[o.tp_hit];
    if (!((buy && hi >= tp) || (!buy && lo <= tp))) break;
    o.tp_hit += 1;
    const pips = ((tp - avg) * sgn) / pip;
    if (o.tp_hit === o.tps.length) {
      o.state = "closed";
      o.result = "win";
      o.close_pip = r1(pips);
      orderEvent(o, "TP", "✅ Đạt TP - Đóng lệnh", tp);
      return true;
    }
    orderEvent(o, `TP${o.tp_hit}`, `✅ Đạt TP${o.tp_hit} ${f2(tp)} (${pips >= 0 ? "+" : ""}${pips.toFixed(0)} pip)`, tp);
    ch = true;
  }
  return ch;
}

/** Lệnh MT5 (anh tự đặt): chỉ tính lời tối đa + mốc 50/100 pip — TP/SL do MT5 quyết. */
export function mt5BarMfe(o: Order, hi: number, lo: number): boolean {
  const buy = o.side === "BUY";
  const e1 = o.entries[0];
  const pip = o.pip || PIP_SIZE;
  const fav = (buy ? hi - e1 : e1 - lo) / pip;
  o.mae = r1(Math.max(o.mae, (buy ? e1 - lo : hi - e1) / pip));
  o.mfe = r1(Math.max(o.mfe, fav));
  let ch = false;
  if (!o.pip50 && fav >= 50) { o.pip50 = true; orderEvent(o, "PIP50", "💰 Đạt +50 pip"); ch = true; }
  if (!o.pip100 && fav >= 100) { o.pip100 = true; orderEvent(o, "PIP100", "🏆 Đạt +100 pip"); ch = true; }
  return ch;
}
