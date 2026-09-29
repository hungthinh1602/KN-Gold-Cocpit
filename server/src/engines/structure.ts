/**
 * Cấu trúc thị trường theo fractal + lọc biên độ (port ai_engine/structure.py).
 * Dùng cho SMC/ICT/CRT và bài nhận định tự động. (Cấu trúc SÓNG tách riêng ở wave.ts.)
 */
import type { Bar } from "../mt5/types.js";

export interface Swing {
  type: "H" | "L";
  i: number;
  price: number;
  time: number;
}

export type Trend = "TANG" | "GIAM" | "SIDEWAY" | "KHONG RO" | "THIEU DL";

export interface StructureResult {
  close?: number;
  trend: Trend;
  pattern: string;
  event?: string;
  last_high?: number | null;
  last_low?: number | null;
  resistance?: number | null;
  support?: number | null;
  n_swings?: number;
  swings: Swing[];
}

/** Pivot thô: đỉnh/đáy cục bộ với `strength` nến mỗi bên. */
export function findFractals(bars: Bar[], strength = 2): Swing[] {
  const piv: Swing[] = [];
  for (let i = strength; i < bars.length - strength; i++) {
    const win = bars.slice(i - strength, i + strength + 1);
    const hi = bars[i].high;
    const lo = bars[i].low;
    const isHigh = win.every((b) => hi >= b.high);
    const isLow = win.every((b) => lo <= b.low);
    if (isHigh && !isLow) piv.push({ type: "H", i, price: hi, time: bars[i].time });
    else if (isLow && !isHigh) piv.push({ type: "L", i, price: lo, time: bars[i].time });
  }
  return piv;
}

/** Ép xen kẽ H/L, cùng loại giữ cái cực đoan hơn, khác loại chỉ nhận khi di chuyển >= minAmp. */
export function cleanSwings(raw: Swing[], minAmp = 0): Swing[] {
  const res: Swing[] = [];
  for (const p of raw) {
    const last = res[res.length - 1];
    if (!last) {
      res.push(p);
      continue;
    }
    if (p.type === last.type) {
      if ((p.type === "H" && p.price > last.price) || (p.type === "L" && p.price < last.price)) res[res.length - 1] = p;
    } else if (Math.abs(p.price - last.price) >= minAmp) {
      res.push(p);
    }
  }
  return res;
}

function trendFromSwings(swings: Swing[]): [Trend, string] {
  const highs = swings.filter((s) => s.type === "H");
  const lows = swings.filter((s) => s.type === "L");
  if (highs.length < 2 || lows.length < 2) return ["KHONG RO", ""];
  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
  if (hh && hl) return ["TANG", "HH-HL"];
  if (!hh && !hl) return ["GIAM", "LH-LL"];
  if (hh && !hl) return ["SIDEWAY", "HH-LL"];
  return ["SIDEWAY", "LH-HL"];
}

export function analyze(bars: Bar[], strength = 2, minAmp = 0): StructureResult {
  if (bars.length < strength * 2 + 3) return { trend: "THIEU DL", pattern: "", swings: [] };
  const swings = cleanSwings(findFractals(bars, strength), minAmp);
  const close = bars[bars.length - 1].close;
  const [trend, pattern] = trendFromSwings(swings);
  const lastHigh = [...swings].reverse().find((s) => s.type === "H") ?? null;
  const lastLow = [...swings].reverse().find((s) => s.type === "L") ?? null;
  let event = "Trong bien do";
  if (lastHigh && close > lastHigh.price) event = "PHA VO DINH gan nhat (BOS len)";
  else if (lastLow && close < lastLow.price) event = "PHA VO DAY gan nhat (BOS xuong)";
  const resistance = [...swings].reverse().find((s) => s.type === "H" && s.price > close)?.price ?? null;
  const support = [...swings].reverse().find((s) => s.type === "L" && s.price < close)?.price ?? null;
  return {
    close, trend, pattern, event,
    last_high: lastHigh?.price ?? null, last_low: lastLow?.price ?? null,
    resistance, support, n_swings: swings.length, swings,
  };
}
