/** ICT: OTE, Displacement, Killzone theo giờ VN (port patterns/ict.py). */
import type { Bar } from "../mt5/types.js";
import type { Swing } from "./structure.js";
import { atr, finding, isUp, type Finding } from "./util.js";

/** OTE 0.62–0.79 của nhịp xung lực gần nhất (2 swing cuối). */
export function ote(_bars: Bar[], swings: Swing[]): Finding[] {
  if (swings.length < 2) return [];
  const a = swings[swings.length - 2];
  const b = swings[swings.length - 1];
  const lo = Math.min(a.price, b.price);
  const hi = Math.max(a.price, b.price);
  const rng = hi - lo;
  if (rng <= 0) return [];
  if (b.type === "H") // nhịp tăng → OTE mua khi hồi về
    return [finding("ICT", "OTE", "OTE mua (0.62–0.79)", "bull", hi - 0.79 * rng, hi - 0.62 * rng, hi - 0.705 * rng, "Vùng vào lệnh tối ưu cho nhịp tăng")];
  return [finding("ICT", "OTE", "OTE bán (0.62–0.79)", "bear", lo + 0.62 * rng, lo + 0.79 * rng, lo + 0.705 * rng, "Vùng vào lệnh tối ưu cho nhịp giảm")];
}

/** Nến động lượng mạnh (> 1.5 ATR) trong 3 nến cuối. */
export function displacement(bars: Bar[]): Finding[] {
  const a = atr(bars);
  if (a <= 0) return [];
  const out: Finding[] = [];
  for (const b of bars.slice(-3)) {
    if (Math.abs(b.close - b.open) > 1.5 * a)
      out.push(finding("ICT", "DISP", "Displacement (đẩy mạnh)", isUp(b) ? "bull" : "bear", b.low, b.high, null,
        "Nến động lượng mạnh — xác nhận phe kiểm soát"));
  }
  return out.slice(-1);
}

/** Killzone theo GIỜ VIỆT NAM: [bắt đầu, kết thúc, tên]. */
const KZ: [number, number, string][] = [
  [6.0, 9.0, "Phiên Á (Tokyo)"],
  [14.0, 17.0, "London Open KZ"],
  [19.5, 22.5, "New York AM KZ"],
  [22.0, 24.0, "London Close"],
];

/** Giờ VN dạng số thập phân (vd 19.5 = 19:30). */
export function vnHourFloat(d = new Date()): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return g("hour") + g("minute") / 60;
}

export function killzone(hourVn: number): Finding | null {
  const hit = KZ.find(([s, e]) => s <= hourVn && hourVn < e);
  return hit ? finding("ICT", "KZ", "Killzone: " + hit[2], "neutral", null, null, null, "Đang trong khung giờ dễ có biến động mạnh") : null;
}
