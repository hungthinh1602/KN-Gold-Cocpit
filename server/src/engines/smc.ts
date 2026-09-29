/** Smart Money Concepts: FVG, Order Block, thanh khoản (EQH/EQL + sweep), Premium/Discount (port patterns/smc.py). */
import type { Bar } from "../mt5/types.js";
import type { Swing } from "./structure.js";
import { atr, finding, isDown, isUp, type Finding, pyFixed } from "./util.js";

/** FVG chưa lấp (mẫu 3 nến). */
export function fvgs(bars: Bar[], lookback = 60, maxOut = 3): Finding[] {
  const out: Finding[] = [];
  const n = bars.length;
  for (let i = Math.max(2, n - lookback); i < n; i++) {
    const a = bars[i - 2];
    const c = bars[i];
    if (a.high < c.low) {
      const low = a.high;
      const high = c.low;
      if (!bars.slice(i + 1).some((b) => b.low <= low))
        out.push(finding("SMC", "FVG", "FVG tăng (gap cầu)", "bull", low, high, null, "Vùng cầu chưa lấp — hỗ trợ tiềm năng"));
    } else if (a.low > c.high) {
      const low = c.high;
      const high = a.low;
      if (!bars.slice(i + 1).some((b) => b.high >= high))
        out.push(finding("SMC", "FVG", "FVG giảm (gap cung)", "bear", low, high, null, "Vùng cung chưa lấp — kháng cự tiềm năng"));
    }
  }
  return out.slice(-maxOut);
}

/** Order Block: nến đối lập cuối cùng trước cú đẩy mạnh (> 0.8 ATR). */
export function orderBlocks(bars: Bar[], lookback = 60, maxOut = 2): Finding[] {
  const out: Finding[] = [];
  const a = atr(bars);
  if (a <= 0) return out;
  const n = bars.length;
  for (let i = n - 1; i > Math.max(2, n - lookback); i--) {
    const moved = bars[i].close - bars[i].open;
    if (moved > 0.8 * a) {
      for (let j = i - 1; j > Math.max(0, i - 6); j--) {
        if (isDown(bars[j])) {
          out.push(finding("SMC", "OB", "Order Block tăng", "bull", bars[j].low, bars[j].high, null, "Nến giảm cuối trước cú đẩy tăng — vùng cầu"));
          break;
        }
      }
    } else if (moved < -0.8 * a) {
      for (let j = i - 1; j > Math.max(0, i - 6); j--) {
        if (isUp(bars[j])) {
          out.push(finding("SMC", "OB", "Order Block giảm", "bear", bars[j].low, bars[j].high, null, "Nến tăng cuối trước cú đẩy giảm — vùng cung"));
          break;
        }
      }
    }
    if (out.length >= maxOut) break;
  }
  return out.slice(0, maxOut);
}

/** EQH/EQL (đỉnh/đáy bằng nhau = thanh khoản) + sweep (quét râu). */
export function liquidity(bars: Bar[], swings: Swing[], maxOut = 3): Finding[] {
  const out: Finding[] = [];
  if (!swings.length) return out;
  const tol = 0.18 * atr(bars);
  const highs = swings.filter((s) => s.type === "H");
  const lows = swings.filter((s) => s.type === "L");
  for (let k = 0; k < highs.length - 1; k++) {
    if (Math.abs(highs[k].price - highs[k + 1].price) <= tol)
      out.push(finding("SMC", "LIQ", "Đỉnh đôi (EQH)", "bear", null, null, Math.max(highs[k].price, highs[k + 1].price),
        "Thanh khoản mua nằm trên — dễ bị quét rồi đảo"));
  }
  for (let k = 0; k < lows.length - 1; k++) {
    if (Math.abs(lows[k].price - lows[k + 1].price) <= tol)
      out.push(finding("SMC", "LIQ", "Đáy đôi (EQL)", "bull", null, null, Math.min(lows[k].price, lows[k + 1].price),
        "Thanh khoản bán nằm dưới — dễ bị quét rồi đảo"));
  }
  const recent = bars.slice(-5);
  for (const s of highs.slice(-3)) {
    if (recent.some((b) => b.high > s.price && b.close < s.price))
      out.push(finding("SMC", "SWEEP", "Quét đỉnh (sweep)", "bear", null, null, s.price,
        "Râu vượt đỉnh rồi đóng lại → gom thanh khoản, dễ đảo xuống"));
  }
  for (const s of lows.slice(-3)) {
    if (recent.some((b) => b.low < s.price && b.close > s.price))
      out.push(finding("SMC", "SWEEP", "Quét đáy (sweep)", "bull", null, null, s.price,
        "Râu thủng đáy rồi đóng lại → gom thanh khoản, dễ đảo lên"));
  }
  return out.slice(0, maxOut);
}

/** Vùng Premium / Discount theo range swing gần nhất. */
export function premiumDiscount(bars: Bar[], swings: Swing[]): Finding[] {
  const highs = swings.filter((s) => s.type === "H");
  const lows = swings.filter((s) => s.type === "L");
  if (!highs.length || !lows.length) return [];
  const hi = highs[highs.length - 1].price;
  const lo = lows[lows.length - 1].price;
  if (hi <= lo) return [];
  const eq = (hi + lo) / 2;
  const close = bars[bars.length - 1].close;
  return close > eq
    ? [finding("SMC", "P/D", "Premium (cao cấp)", "bear", eq, hi, eq, `Giá trên cân bằng ${pyFixed(eq, 2)} → ưu tiên tìm BÁN`)]
    : [finding("SMC", "P/D", "Discount (chiết khấu)", "bull", lo, eq, eq, `Giá dưới cân bằng ${pyFixed(eq, 2)} → ưu tiên tìm MUA`)];
}
